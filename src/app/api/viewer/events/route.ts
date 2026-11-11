import { z } from "zod";
import { getApiView, recordApiViewEvent } from "@/lib/api-viewer";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.discriminatedUnion("type", [
  z.object({ viewId: z.string().min(1).max(100), type: z.literal("page_view"), pageNumber: z.number().int().min(1).max(10000) }),
  z.object({
    viewId: z.string().min(1).max(100),
    type: z.literal("link_click"),
    pageNumber: z.number().int().min(1).max(10000),
    url: z.string().min(1).max(1000),
  }),
]);

/** Page turns and link clicks from the hosted viewer. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const view = await getApiView(parsed.data.viewId);
  if (!view) return Response.json({ error: "Not found" }, { status: 404 });

  if (!(await checkRateLimit(`viewer-events:${view.id}`, 500, 60 * 60))) {
    return Response.json({ error: "Too many events" }, { status: 429 });
  }

  await recordApiViewEvent(view, parsed.data);
  return Response.json({ ok: true });
}
