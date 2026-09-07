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

export async function createUser(input: { email: string; password: string; name: string; role?: "admin" | "member" }) {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw new Error(`A user with email ${input.email} already exists.`);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const id = newId("usr");
  await db.insert(schema.users).values({
    id,
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: input.role ?? "member",
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

const RESET_PASSWORD = "password";

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
