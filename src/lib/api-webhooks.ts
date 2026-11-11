import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { listEventRows, serializeEvents, type PublicEvent } from "@/lib/api-events";
import type { ApiProject } from "@/db/schema";

const BATCH_SIZE = 100;
const MAX_BATCHES_PER_RUN = 5;
const TIMEOUT_MS = 10_000;
const LOCK_SECONDS = 60;
// Wait before retrying after 1, 2, 3… consecutive failures. On Vercel Hobby nothing runs on a
// timer more than daily, so a retry actually happens at the first chance after this: the
// project's next event, the daily job, or "Retry now" on the project page.
const BACKOFF_MINUTES = [1, 5, 30, 120, 360, 720];

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/**
 * Header value `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. The receiver
 * recomputes it with its secret and should reject a mismatch or an old timestamp.
 */
export function signWebhook(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[::1\]|\[f[cd]|\[fe80)/i;

/** Webhooks go to public https addresses (plus local http while developing, outside production). */
export function validateWebhookUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Use a full https:// address.";
  }
  if (url.username || url.password) return "The address can't contain a username or password.";
  const local = PRIVATE_HOST.test(url.hostname);
  if (process.env.NODE_ENV !== "production" && local) {
    return url.protocol === "http:" || url.protocol === "https:" ? null : "Use a full https:// address.";
  }
  if (url.protocol !== "https:") return "Use a full https:// address.";
  if (local || !url.hostname.includes(".")) return "Use a public address — webhooks can't go to private networks.";
  return null;
}

async function post(project: ApiProject, events: PublicEvent[], isTest: boolean) {
  const body = JSON.stringify({ project: { id: project.id }, test: isTest || undefined, events });
  const started = Date.now();
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(project.webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Flipbook-Webhooks/1.0",
        "Flipbook-Signature": signWebhook(project.webhookSecret!, body),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    statusCode = res.status;
    if (!res.ok) error = `Responded with HTTP ${res.status}`;
    await res.body?.cancel().catch(() => {});
  } catch (err) {
    error = err instanceof Error && err.name === "TimeoutError" ? `No response within ${TIMEOUT_MS / 1000}s` : "Couldn't connect";
  }
  const success = error === null;
  await db.insert(schema.apiWebhookDeliveries).values({
    id: newId("whd"),
    projectId: project.id,
    attemptedAt: new Date(started),
    url: project.webhookUrl!,
    eventCount: events.length,
    firstSeq: events[0]?.sequence ?? null,
    lastSeq: events.at(-1)?.sequence ?? null,
    isTest,
    success,
    statusCode,
    error,
    durationMs: Date.now() - started,
  });
  return { success, statusCode, error };
}

/** Takes the project's delivery lock; false if another request is already delivering. */
async function acquireLock(projectId: string, ignoreBackoff: boolean) {
  const now = new Date();
  const rows = await db
    .update(schema.apiProjects)
    .set({ webhookLockedUntil: new Date(now.getTime() + LOCK_SECONDS * 1000) })
    .where(
      and(
        eq(schema.apiProjects.id, projectId),
        isNotNull(schema.apiProjects.webhookUrl),
        or(isNull(schema.apiProjects.webhookLockedUntil), lt(schema.apiProjects.webhookLockedUntil, now)),
        ignoreBackoff
          ? undefined
          : or(isNull(schema.apiProjects.webhookNextAttemptAt), lt(schema.apiProjects.webhookNextAttemptAt, now))
      )
    )
    .returning({ id: schema.apiProjects.id });
  return rows.length > 0;
}

/**
 * Sends the project's undelivered events to its webhook, in order, in batches. Safe to call as
 * often as you like: it returns straight away if there's nothing to send, another request is
 * already sending, or the endpoint is in its retry back-off (unless `force`).
 */
export async function deliverWebhooks(projectId: string, { force = false } = {}) {
  if (!(await acquireLock(projectId, force))) return { delivered: 0, skipped: true as const };
  let delivered = 0;
  try {
    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
      const projects = await db.select().from(schema.apiProjects).where(eq(schema.apiProjects.id, projectId)).limit(1);
      const project = projects[0];
      if (!project?.webhookUrl || !project.webhookSecret || project.status !== "active") break;

      const rows = await listEventRows(project.id, project.webhookCursor, BATCH_SIZE);
      if (rows.length === 0) break;
      const events = await serializeEvents(rows);
      const result = await post(project, events, false);

      if (!result.success) {
        const failures = project.webhookFailures + 1;
        const wait = BACKOFF_MINUTES[Math.min(failures, BACKOFF_MINUTES.length) - 1];
        await db
          .update(schema.apiProjects)
          .set({ webhookFailures: failures, webhookNextAttemptAt: new Date(Date.now() + wait * 60_000) })
          .where(eq(schema.apiProjects.id, project.id));
        break;
      }
      delivered += events.length;
      await db
        .update(schema.apiProjects)
        .set({ webhookCursor: rows.at(-1)!.seq, webhookFailures: 0, webhookNextAttemptAt: null })
        .where(eq(schema.apiProjects.id, project.id));
      if (rows.length < BATCH_SIZE) break;
    }
  } finally {
    await db.update(schema.apiProjects).set({ webhookLockedUntil: null }).where(eq(schema.apiProjects.id, projectId));
  }
  return { delivered, skipped: false as const };
}

/** Sends one made-up event so the project can check its endpoint and signature check. */
export async function sendTestWebhook(project: ApiProject) {
  const event: PublicEvent = {
    id: `test_${randomBytes(6).toString("hex")}`,
    sequence: 0,
    type: "view.started",
    occurredAt: new Date().toISOString(),
    viewId: "aview_test",
    document: { id: "test-document", title: "Test document" },
    visitor: { deviceType: "desktop", browser: "Chrome", country: "GB", region: "SCT", referrer: "https://example.com/" },
  };
  return post(project, [event], true);
}

/**
 * Every project with a webhook and events it hasn't received — for the scheduled job. Respects
 * each endpoint's back-off, so running the job often (e.g. every few minutes from an external
 * scheduler) doesn't hammer one that's down; the longest back-off is shorter than a day, so even
 * a daily run always retries.
 */
export async function deliverAllPending() {
  const projects = await db
    .select({ id: schema.apiProjects.id, cursor: schema.apiProjects.webhookCursor })
    .from(schema.apiProjects)
    .where(and(isNotNull(schema.apiProjects.webhookUrl), eq(schema.apiProjects.status, "active")));
  let delivered = 0;
  for (const p of projects) {
    const pending = await db
      .select({ seq: schema.apiEvents.seq })
      .from(schema.apiEvents)
      .where(and(eq(schema.apiEvents.projectId, p.id), gt(schema.apiEvents.seq, p.cursor)))
      .limit(1);
    if (pending.length) delivered += (await deliverWebhooks(p.id)).delivered;
  }
  return delivered;
}

export async function listDeliveries(projectId: string, limit = 20) {
  return db
    .select()
    .from(schema.apiWebhookDeliveries)
    .where(eq(schema.apiWebhookDeliveries.projectId, projectId))
    .orderBy(desc(schema.apiWebhookDeliveries.attemptedAt))
    .limit(limit);
}

/** How far behind the webhook is: events recorded that it hasn't accepted yet. */
export async function countUndelivered(project: ApiProject) {
  const rows = await db
    .select({ seq: schema.apiEvents.seq })
    .from(schema.apiEvents)
    .where(and(eq(schema.apiEvents.projectId, project.id), gt(schema.apiEvents.seq, project.webhookCursor)))
    .limit(1001);
  return rows.length;
}
