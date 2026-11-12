import { CopyButton } from "@/components/CopyButton";
import type { SchemaProblems } from "@/lib/schema-check";

/** Shown to admins when the database is missing tables or columns this version of the app uses. */
export function SchemaWarning({ problems }: { problems: SchemaProblems }) {
  const sql = problems.missingColumns.map((c) => c.sql).filter((s): s is string => s !== null).join("\n");
  const needsManualSql = problems.missingTables.length > 0 || problems.missingColumns.some((c) => c.sql === null);

  return (
    <div role="alert" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-6">
      <h2 className="text-[15px] font-semibold text-amber-900">The database needs an update</h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-800">
        This version of the site uses parts of the database that aren&apos;t there yet, so some features won&apos;t work properly
        until it&apos;s updated. Missing:
      </p>
      <ul className="mt-2 list-disc pl-5 font-mono text-[13px] text-amber-900">
        {problems.missingTables.map((t) => (
          <li key={t}>table {t}</li>
        ))}
        {problems.missingColumns.map((c) => (
          <li key={`${c.table}.${c.column}`}>
            column {c.table}.{c.column}
          </li>
        ))}
      </ul>
      {sql && (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-amber-900">Run this in the Cloudflare D1 console:</p>
            <CopyButton text={sql} label="Copy SQL" />
          </div>
          <pre className="mt-2 overflow-x-auto rounded-[9px] bg-white px-4 py-3 font-mono text-[12.5px] text-gray-800">{sql}</pre>
        </>
      )}
      {needsManualSql && (
        <p className="mt-3 text-sm text-amber-800">
          Some of this needs SQL that can&apos;t be generated here: run the newest files in the repository&apos;s drizzle folder that
          haven&apos;t been applied yet.
        </p>
      )}
      <p className="mt-3 text-xs text-amber-700">Only admins see this. It disappears once the database is up to date.</p>
    </div>
  );
}
