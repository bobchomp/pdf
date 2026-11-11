import { apiError, requireApiKey } from "@/lib/api-auth";
import { findDocumentByExternalId, listEventRows, serializeEvents } from "@/lib/api-events";

const MAX_LIMIT = 500;

/**
 * The project's events (view.started, page.viewed, link.clicked), oldest first. Page through with
 * `after` = the previous response's `nextCursor`; storing the last cursor lets a project pick up
 * exactly where it left off. Events are kept for 30 days.
 */
export async function GET(req: Request) {
  const { project, error } = await requireApiKey(req);
  if (error) return error;

  const params = new URL(req.url).searchParams;
  const after = params.get("after") ?? "0";
  const limit = params.get("limit") ?? "100";
  if (!/^\d{1,15}$/.test(after)) return apiError(400, "invalid_request", "after: use the nextCursor from a previous response, or 0.");
  if (!/^\d{1,4}$/.test(limit) || Number(limit) < 1 || Number(limit) > MAX_LIMIT) {
    return apiError(400, "invalid_request", `limit: a number from 1 to ${MAX_LIMIT}.`);
  }

  let documentId: string | undefined;
  const externalId = params.get("documentId");
  if (externalId !== null) {
    const doc = await findDocumentByExternalId(project.id, externalId);
    if (!doc) return Response.json({ events: [], nextCursor: after, hasMore: false }, { headers: { "Cache-Control": "no-store" } });
    documentId = doc.id;
  }

  const rows = await listEventRows(project.id, Number(after), Number(limit) + 1, documentId);
  const hasMore = rows.length > Number(limit);
  const page = rows.slice(0, Number(limit));
  return Response.json(
    { events: await serializeEvents(page), nextCursor: String(page.at(-1)?.seq ?? after), hasMore },
    { headers: { "Cache-Control": "no-store" } }
  );
}
