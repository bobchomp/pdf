import { timingSafeEqual } from "node:crypto";
import { cleanupApiData } from "@/lib/api-cleanup";
import { deliverAllPending } from "@/lib/api-webhooks";

export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The scheduled job: retries webhook deliveries that are due, then deletes stats past the 30-day
 * retention. Vercel calls it daily (vercel.json); an external scheduler such as cron-job.org can
 * call it more often. Both send `Authorization: Bearer <CRON_SECRET>`.
 */
async function run(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const delivered = await deliverAllPending();
  const removed = await cleanupApiData();
  return Response.json({ ok: true, webhookEventsDelivered: delivered, removed }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = run;
export const POST = run;
