// The dashboard warns admins when the database is missing tables or columns the app expects
// (database updates are applied by hand). Runs on a fresh server, before anything has checked.
const fs = require("node:fs");
const path = require("node:path");
const { BASE, ROOT, check, launch, login, openDb, run } = require("../harness/helpers.cjs");
const db = openDb();

run(async () => {
  // Undo two updates, as if they'd never been run: a column and a whole table.
  db.exec("ALTER TABLE api_viewer_tokens DROP COLUMN page_url");
  db.exec("DROP TABLE api_webhook_deliveries");

  const browser = await launch();
  const admin = await (await browser.newContext()).newPage();
  await login(admin, "admin@test.local");
  await admin.goto(`${BASE}/dashboard`);
  const banner = await admin.waitForSelector('[role="alert"]:has-text("The database needs an update")', { timeout: 10000 }).catch(() => null);
  check("admin sees the warning", !!banner);
  const text = banner ? await banner.textContent() : "";
  check("names the missing column and table", text.includes("column api_viewer_tokens.page_url") && text.includes("table api_webhook_deliveries"), text.slice(0, 200));
  const sql = banner ? (await banner.$eval("pre", (el) => el.textContent)).trim() : "";
  check("gives the SQL for the missing column", sql === "ALTER TABLE `api_viewer_tokens` ADD `page_url` text;", sql);
  check("explains a missing table needs the migration files", text.includes("drizzle folder"));

  const member = await (await browser.newContext()).newPage();
  await login(member, "member@test.local");
  check("members don't see it", !(await member.$('[role="alert"]:has-text("The database needs an update")')));

  // Run what it says (and the table's own migration), and it goes away.
  db.exec(sql);
  const migration = fs.readdirSync(path.join(ROOT, "drizzle")).filter((f) => f.endsWith(".sql")).map((f) => fs.readFileSync(path.join(ROOT, "drizzle", f), "utf8")).join("\n--> statement-breakpoint\n");
  for (const stmt of migration.split("--> statement-breakpoint")) {
    if (/CREATE (TABLE|INDEX) `api_webhook_deliveries/.test(stmt.trim()) || /ON `api_webhook_deliveries`/.test(stmt)) db.exec(stmt);
  }
  await admin.reload();
  check("warning gone once the database is up to date", !(await admin.$('[role="alert"]:has-text("The database needs an update")')));
  await browser.close();
});
