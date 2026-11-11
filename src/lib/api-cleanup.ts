import "server-only";
import { and, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { RETENTION_DAYS } from "@/lib/api-events";

/** Removes external-project stats and logs older than the retention period, and long-expired viewer tokens. */
export async function cleanupApiData() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000);
  const oldViews = db.select({ id: schema.apiViews.id }).from(schema.apiViews).where(lt(schema.apiViews.viewedAt, cutoff));

  // Events first: they reference views, and D1 enforces foreign keys.
  const events = await db
    .delete(schema.apiEvents)
    .where(lt(schema.apiEvents.occurredAt, cutoff))
    .returning({ seq: schema.apiEvents.seq });
  const lateEvents = await db
    .delete(schema.apiEvents)
    .where(inArray(schema.apiEvents.viewId, oldViews))
    .returning({ seq: schema.apiEvents.seq });
  const views = await db.delete(schema.apiViews).where(lt(schema.apiViews.viewedAt, cutoff)).returning({ id: schema.apiViews.id });
  const tokens = await db
    .delete(schema.apiViewerTokens)
    .where(and(lt(schema.apiViewerTokens.expiresAt, new Date(Date.now() - 86400_000))))
    .returning({ id: schema.apiViewerTokens.id });
  const deliveries = await db
    .delete(schema.apiWebhookDeliveries)
    .where(lt(schema.apiWebhookDeliveries.attemptedAt, cutoff))
    .returning({ id: schema.apiWebhookDeliveries.id });

  return {
    events: events.length + lateEvents.length,
    views: views.length,
    expiredTokens: tokens.length,
    deliveries: deliveries.length,
  };
}
