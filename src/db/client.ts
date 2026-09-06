import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const API_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN;

function assertConfigured() {
  if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
    throw new Error(
      "Cloudflare D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_D1_API_TOKEN. See SETUP.md."
    );
  }
}

const D1_QUERY_URL = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

type D1QueryResult = {
  success: boolean;
  errors: { code: number; message: string }[];
  result: { results: Record<string, unknown>[]; success: boolean }[];
};

async function runD1Query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  assertConfigured();

  const res = await fetch(D1_QUERY_URL(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const json = (await res.json()) as D1QueryResult;

  if (!res.ok || !json.success) {
    const message = json.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(`Cloudflare D1 query failed: ${message}\nSQL: ${sql}`);
  }

  return json.result?.[0]?.results ?? [];
}

export const db = drizzle(async (sql, params, method) => {
  const rows = await runD1Query(sql, params);

  if (method === "get") {
    const row = rows[0];
    return { rows: row ? Object.values(row) : [] };
  }

  return { rows: rows.map((row) => Object.values(row)) };
}, { schema });

export { schema };
