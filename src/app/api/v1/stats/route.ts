import { apiError, requireApiKey } from "@/lib/api-auth";
import { findDocumentByExternalId, getDocumentStats, getProjectStats, RETENTION_DAYS } from "@/lib/api-events";

/**
 * Summary stats over the last `days` (1–30, default 30): per document for the whole project, or
 * in detail (by day, page, link, device, browser, country) with `documentId`.
 */
export async function GET(req: Request) {
  const { project, error } = await requireApiKey(req);
  if (error) return error;

  const params = new URL(req.url).searchParams;
  const daysParam = params.get("days") ?? String(RETENTION_DAYS);
  const days = Number(daysParam);
  if (!/^\d{1,2}$/.test(daysParam) || days < 1 || days > RETENTION_DAYS) {
    return apiError(400, "invalid_request", `days: a number from 1 to ${RETENTION_DAYS}.`);
  }

  const externalId = params.get("documentId");
  if (externalId === null) {
    const stats = await getProjectStats(project.id, days);
    // internalId is only for this site's dashboard links.
    const documents = stats.documents.map((d) => ({
      document: d.document,
      views: d.views,
      pageViews: d.pageViews,
      linkClicks: d.linkClicks,
      lastViewedAt: d.lastViewedAt,
    }));
    return Response.json({ ...stats, documents }, { headers: { "Cache-Control": "no-store" } });
  }
  const doc = await findDocumentByExternalId(project.id, externalId);
  if (!doc) return apiError(404, "document_not_found", "No document with that ID has been shown in the viewer.");
  return Response.json(await getDocumentStats(project.id, doc, days), { headers: { "Cache-Control": "no-store" } });
}
