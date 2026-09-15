import { NextRequest } from "next/server";
import { z } from "zod";
import { getViewById, recordLinkClick } from "@/lib/flipbooks";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  viewId: z.string().min(1).max(100),
  pageNumber: z.number().int().min(1).max(10000),
  url: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const view = await getViewById(parsed.data.viewId);
  if (!view) return Response.json({ error: "Not found" }, { status: 404 });

  const allowed = await checkRateLimit(`link-click:${view.id}`, 200, 60 * 60);
  if (!allowed) {
    return Response.json({ error: "Too many events" }, { status: 429 });
  }

  await recordLinkClick(view.id, view.flipbookId, parsed.data.pageNumber, parsed.data.url);
  return Response.json({ ok: true });
}
