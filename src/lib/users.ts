import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";

export async function getUserByEmail(email: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listUsers() {
  return db.select().from(schema.users);
}

const RESET_PASSWORD = "password";

/**
 * If no password is given (the normal case — an admin adding a teammate from the Team page),
 * the account starts on the known default password and is flagged for a forced reset on first
 * login, same as an admin-triggered reset. Passing a password explicitly (e.g. the initial
 * setup flow, where someone is choosing their own password right there) skips that.
 */
export async function createUser(input: { email: string; password?: string; name: string; role?: "admin" | "member" }) {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw new Error(`A user with email ${input.email} already exists.`);
  }

  const requiresReset = input.password === undefined;
  const passwordHash = await bcrypt.hash(input.password ?? RESET_PASSWORD, 12);
  const id = newId("usr");
  await db.insert(schema.users).values({
    id,
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: input.role ?? "member",
    mustResetPassword: requiresReset,
    createdAt: new Date(),
  });
  return getUserById(id);
}

export async function verifyPassword(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

/** Sets a user's password to a known default and flags it for a forced reset on next login. */
export async function resetUserPassword(id: string) {
  const passwordHash = await bcrypt.hash(RESET_PASSWORD, 12);
  await db.update(schema.users).set({ passwordHash, mustResetPassword: true }).where(eq(schema.users.id, id));
  return getUserById(id);
}

/** Sets a user's own chosen password and clears the forced-reset flag. */
export async function updateUserPassword(id: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(schema.users).set({ passwordHash, mustResetPassword: false }).where(eq(schema.users.id, id));
  return getUserById(id);
}
