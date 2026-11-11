import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";

const KEY_PREFIX = "fbsk_"; // "flipbook secret key"
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 6;

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** A new random secret key (256 bits). Only its hash and first characters are ever stored. */
function generateApiKey() {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH), keyHash: hashApiKey(key) };
}

// ---------- Projects ----------

export async function listProjects() {
  const projects = await db.select().from(schema.apiProjects).orderBy(desc(schema.apiProjects.createdAt));
  const activeKeyCounts = await db
    .select({ projectId: schema.apiKeys.projectId, value: count() })
    .from(schema.apiKeys)
    .where(isNull(schema.apiKeys.revokedAt))
    .groupBy(schema.apiKeys.projectId);
  const countByProject = new Map(activeKeyCounts.map((row) => [row.projectId, row.value]));
  return projects.map((p) => ({ ...p, activeKeyCount: countByProject.get(p.id) ?? 0 }));
}

export async function getProject(id: string) {
  const rows = await db.select().from(schema.apiProjects).where(eq(schema.apiProjects.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createProject(input: { name: string; allowedOrigins: string[] }) {
  const now = new Date();
  const id = newId("proj");
  await db.insert(schema.apiProjects).values({
    id,
    name: input.name,
    allowedOrigins: input.allowedOrigins,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return getProject(id);
}

export async function updateProject(
  id: string,
  patch: Partial<{ name: string; allowedOrigins: string[]; status: "active" | "disabled" }>
) {
  await db
    .update(schema.apiProjects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.apiProjects.id, id));
  return getProject(id);
}

export async function deleteProject(id: string) {
  await db.delete(schema.apiKeys).where(eq(schema.apiKeys.projectId, id));
  await db.delete(schema.apiProjects).where(eq(schema.apiProjects.id, id));
}

// ---------- Keys ----------

export async function listKeys(projectId: string) {
  return db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      createdAt: schema.apiKeys.createdAt,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      revokedAt: schema.apiKeys.revokedAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.projectId, projectId))
    .orderBy(desc(schema.apiKeys.createdAt));
}

/** Creates a key and returns it in full — the only time it's ever available. */
export async function createKey(projectId: string, name: string) {
  const { key, keyPrefix, keyHash } = generateApiKey();
  const id = newId("key");
  await db.insert(schema.apiKeys).values({ id, projectId, name, keyPrefix, keyHash, createdAt: new Date() });
  return { id, name, keyPrefix, key };
}

/** Revokes a key belonging to the given project. Returns false if there's no such key. */
export async function revokeKey(projectId: string, keyId: string) {
  const rows = await db
    .select({ id: schema.apiKeys.id, revokedAt: schema.apiKeys.revokedAt })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.projectId, projectId)))
    .limit(1);
  if (!rows[0]) return false;
  if (!rows[0].revokedAt) {
    await db.update(schema.apiKeys).set({ revokedAt: new Date() }).where(eq(schema.apiKeys.id, keyId));
  }
  return true;
}

/**
 * Looks up the project and key behind a presented secret key. Returns null for an unknown or
 * revoked key, and reports a disabled project separately so the caller can say why.
 */
export async function findActiveKey(presentedKey: string) {
  if (!presentedKey.startsWith(KEY_PREFIX)) return null;
  // Two lookups rather than a join: D1 returns rows keyed by column name, so the columns both
  // tables share (id, name, created_at) would overwrite each other in a joined row.
  const keys = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, hashApiKey(presentedKey))).limit(1);
  const key = keys[0];
  if (!key || key.revokedAt) return null;
  const project = await getProject(key.projectId);
  if (!project) return null;
  return { key, project };
}

/** Records that a key was used, at most once a minute so busy keys don't write on every call. */
export async function touchKey(key: { id: string; lastUsedAt: Date | null }) {
  const now = Date.now();
  if (key.lastUsedAt && now - new Date(key.lastUsedAt).getTime() < 60_000) return;
  await db.update(schema.apiKeys).set({ lastUsedAt: new Date(now) }).where(eq(schema.apiKeys.id, key.id));
}
