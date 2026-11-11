// Test-only: answers the app's Cloudflare D1 HTTP queries from a local SQLite file.
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.env.MOCK_D1_PATH);
const realFetch = globalThis.fetch;
const D1 = /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/d1\/database\/[^/]+\/query$/;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (!D1.test(url)) return realFetch(input, init);
  const { sql, params } = JSON.parse(init.body);
  try {
    const args = (params ?? []).map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
    const rows = db.prepare(sql).all(...args); // objects keyed by column name, like D1
    return Response.json({ success: true, errors: [], result: [{ results: rows, success: true }] });
  } catch (e) {
    return Response.json({ success: false, errors: [{ code: 7500, message: String(e.message) }], result: [] }, { status: 400 });
  }
};
