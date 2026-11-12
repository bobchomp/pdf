import "server-only";
import { is, SQL } from "drizzle-orm";
import { getTableConfig, SQLiteTable, type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db, schema } from "@/db/client";

export type SchemaProblems = {
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string; sql: string | null }>;
};

const OK_CACHE_MS = 10 * 60_000;
let lastOk = 0;

/** A column's SQL DEFAULT clause, or null when it has none we can write out. */
function defaultClause(column: SQLiteColumn) {
  if (!column.hasDefault || column.default === undefined || is(column.default, SQL)) return null;
  const value = column.default as unknown;
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

/** The statement that adds a missing column, or null if it can't be added on its own (NOT NULL without a default). */
function addColumnSql(table: string, column: SQLiteColumn) {
  const def = defaultClause(column);
  if (column.notNull && def === null) return null;
  return `ALTER TABLE \`${table}\` ADD \`${column.name}\` ${column.getSQLType()}${def !== null ? ` DEFAULT ${def}` : ""}${column.notNull ? " NOT NULL" : ""};`;
}

/**
 * Compares the database with the tables and columns the app's code expects. Database updates
 * are applied by hand, and SQLite reads a missing column named in double quotes as a plain
 * string rather than failing, so a forgotten update can otherwise go unnoticed. Null when it all
 * matches (or the check itself couldn't run); a passing result is remembered for 10 minutes.
 */
export async function checkSchema(): Promise<SchemaProblems | null> {
  if (Date.now() - lastOk < OK_CACHE_MS) return null;

  let rows: Array<{ table_name: string; column_name: string }>;
  try {
    rows = (await db.all(
      "SELECT m.name AS table_name, p.name AS column_name FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table'"
    )) as Array<{ table_name: string; column_name: string }>;
  } catch (err) {
    console.error("Schema check couldn't read the database's tables:", err);
    return null;
  }

  const actual = new Map<string, Set<string>>();
  for (const row of rows) {
    // db.all returns each row as an array in select order.
    const [table, column] = Array.isArray(row) ? (row as unknown as [string, string]) : [row.table_name, row.column_name];
    if (!actual.has(table)) actual.set(table, new Set());
    actual.get(table)!.add(column);
  }

  const problems: SchemaProblems = { missingTables: [], missingColumns: [] };
  for (const value of Object.values(schema)) {
    if (!is(value, SQLiteTable)) continue;
    const { name, columns } = getTableConfig(value);
    const existing = actual.get(name);
    if (!existing) {
      problems.missingTables.push(name);
      continue;
    }
    for (const column of columns) {
      if (!existing.has(column.name)) problems.missingColumns.push({ table: name, column: column.name, sql: addColumnSql(name, column) });
    }
  }

  if (problems.missingTables.length === 0 && problems.missingColumns.length === 0) {
    lastOk = Date.now();
    return null;
  }
  return problems;
}
