import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

/**
 * A simple fixed-window counter backed by D1 — no extra infrastructure (Redis, etc.) beyond
 * what the app already runs on. Each bucketKey gets one row; once the window has elapsed, the
 * next check resets it. Returns true when the action is allowed (and records it against the
 * count), false when the caller should be blocked.
 *
 * The read-then-write isn't atomic, so a request racing right at the boundary could squeeze in
 * an extra attempt or two — an acceptable tradeoff for this app's scale and threat model (this
 * exists to blunt scripted brute-forcing and spam, not to be a hardened rate limiter).
 */
export async function checkRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const rows = await db.select().from(schema.rateLimits).where(eq(schema.rateLimits.bucketKey, bucketKey)).limit(1);
  const row = rows[0];

  if (!row || now - new Date(row.windowStart).getTime() >= windowSeconds * 1000) {
    await db
      .insert(schema.rateLimits)
      .values({ bucketKey, count: 1, windowStart: new Date(now) })
      .onConflictDoUpdate({ target: schema.rateLimits.bucketKey, set: { count: 1, windowStart: new Date(now) } });
    return true;
  }

  if (row.count >= limit) {
    return false;
  }

  await db
    .update(schema.rateLimits)
    .set({ count: row.count + 1 })
    .where(eq(schema.rateLimits.bucketKey, bucketKey));
  return true;
}
