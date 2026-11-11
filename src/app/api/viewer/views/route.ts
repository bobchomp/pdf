import { after } from "next/server";
import { z } from "zod";
import { deliverWebhooks } from "@/lib/api-webhooks";
import { getViewerToken, recordApiView } from "@/lib/api-viewer";
import { checkRateLimit } from "@/lib/rate-limit";
import { getGeoFromHeaders } from "@/lib/geo";

const schema = z.object({
  token: z.string().min(1).max(100),
  referrer: z.string().max(2000).default(""),
});

/** Called by the hosted viewer as it opens, to record the view. Returns the ID later events attach to. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const found = await getViewerToken(parsed.data.token);
  if (found.status !== "ok") return Response.json({ error: "Not found" }, { status: 404 });

  // A token can be embedded on a busy page, so this is generous — it only blunts scripted inflation.
  if (!(await checkRateLimit(`viewer-views:${found.token.id}`, 2000, 60 * 60))) {
    return Response.json({ error: "Too many views" }, { status: 429 });
  }

  const { country, region } = getGeoFromHeaders(req.headers);
  const viewId = await recordApiView(found.token, {
    referrer: parsed.data.referrer,
    userAgent: req.headers.get("user-agent"),
    country,
    region,
  });
  after(() => deliverWebhooks(found.token.projectId).catch((err) => console.error("Webhook delivery failed:", err)));
  return Response.json({ viewId });
}
