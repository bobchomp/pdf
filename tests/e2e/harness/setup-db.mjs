// Builds a fresh test database from the repo's real migrations and seeds an admin and a member
// (password "testpass123"). Usage: node setup-db.mjs <db path>
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const [dbPath] = process.argv.slice(2);
rmSync(dbPath, { force: true });
const db = new DatabaseSync(dbPath);
for (const f of readdirSync(`${repo}/drizzle`).filter((f) => f.endsWith(".sql")).sort()) {
  for (const stmt of readFileSync(`${repo}/drizzle/${f}`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) db.exec(stmt);
}
const hash = bcrypt.hashSync("testpass123", 10);
const now = Math.floor(Date.now() / 1000);
const ins = db.prepare("INSERT INTO users (id,email,password_hash,name,role,must_reset_password,created_at) VALUES (?,?,?,?,?,0,?)");
ins.run("user_admin", "admin@test.local", hash, "Admin", "admin", now);
ins.run("user_member", "member@test.local", hash, "Member", "member", now);
// What migration 0010 does for admins that already exist.
db.exec("UPDATE users SET developer_access = 1 WHERE role = 'admin'");
