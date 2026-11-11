import "server-only";
import { and, asc, count, countDistinct, desc, eq, gt, gte, inArray, max, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { computeViewStats } from "@/lib/flipbooks";

export const RETENTION_DAYS = 30;

const PUBLIC_TYPES = {
  view_start: "view.started",
  page_view: "page.viewed",
  link_click: "link.clicked",
} as const;

export type PublicEvent = {
  id: string;
  sequence: number;
  type: (typeof PUBLIC_TYPES)[keyof typeof PUBLIC_TYPES];
  occurredAt: string;
  viewId: string;
  document: { id: string; title: string };
  pageNumber?: number;
  url?: string;
  visitor?: {
    deviceType: string | null;
    browser: string | null;
    country: string | null;
    region: string | null;
    referrer: string;
  };
};

type EventRow = typeof schema.apiEvents.$inferSelect;

/** Turns stored events into the shape the API and webhooks send: the project's own document IDs, and visitor details on view.started. */
export async function serializeEvents(rows: EventRow[]): Promise<PublicEvent[]> {
  if (rows.length === 0) return [];
  const documentIds = [...new Set(rows.map((r) => r.documentId))];
  const viewIds = [...new Set(rows.filter((r) => r.type === "view_start").map((r) => r.viewId))];

  const docs = await db
    .select({ id: schema.apiDocuments.id, externalId: schema.apiDocuments.externalId, title: schema.apiDocuments.title })
    .from(schema.apiDocuments)
    .where(inArray(schema.apiDocuments.id, documentIds));
  const docById = new Map(docs.map((d) => [d.id, d]));
  const views = viewIds.length ? await db.select().from(schema.apiViews).where(inArray(schema.apiViews.id, viewIds)) : [];
  const viewById = new Map(views.map((v) => [v.id, v]));

  return rows.map((r) => {
    const doc = docById.get(r.documentId);
    const event: PublicEvent = {
      id: r.id,
      sequence: r.seq,
      type: PUBLIC_TYPES[r.type],
      occurredAt: new Date(r.occurredAt).toISOString(),
      viewId: r.viewId,
      document: { id: doc?.externalId ?? "", title: doc?.title ?? "" },
    };
    if (r.pageNumber !== null) event.pageNumber = r.pageNumber;
    if (r.url !== null) event.url = r.url;
    const view = r.type === "view_start" ? viewById.get(r.viewId) : undefined;
    if (view) {
      event.visitor = {
        deviceType: view.deviceType,
        browser: view.browser,
        country: view.country,
        region: view.region,
        referrer: view.referrer,
      };
    }
    return event;
  });
}

/** A project's events after a sequence number, oldest first. */
export async function listEventRows(projectId: string, afterSeq: number, limit: number, documentId?: string) {
  return db
    .select()
    .from(schema.apiEvents)
    .where(
      and(
        eq(schema.apiEvents.projectId, projectId),
        gt(schema.apiEvents.seq, afterSeq),
        documentId ? eq(schema.apiEvents.documentId, documentId) : undefined
      )
    )
    .orderBy(asc(schema.apiEvents.seq))
    .limit(limit);
}

export async function findDocumentByExternalId(projectId: string, externalId: string) {
  const rows = await db
    .select()
    .from(schema.apiDocuments)
    .where(and(eq(schema.apiDocuments.projectId, projectId), eq(schema.apiDocuments.externalId, externalId)))
    .limit(1);
  return rows[0] ?? null;
}

const day = sql<string>`strftime('%Y-%m-%d', ${schema.apiEvents.occurredAt} / 1000, 'unixepoch')`;

/** Totals per document over the last `days` days, most viewed first. */
export async function getProjectStats(projectId: string, days: number) {
  const since = new Date(Date.now() - days * 86400_000);
  const scope = and(eq(schema.apiEvents.projectId, projectId), gte(schema.apiEvents.occurredAt, since));

  const totals = await db
    .select({ documentId: schema.apiEvents.documentId, type: schema.apiEvents.type, value: count(), lastAt: max(schema.apiEvents.occurredAt) })
    .from(schema.apiEvents)
    .where(scope)
    .groupBy(schema.apiEvents.documentId, schema.apiEvents.type);

  const documentIds = [...new Set(totals.map((t) => t.documentId))];
  const docs = documentIds.length
    ? await db.select().from(schema.apiDocuments).where(inArray(schema.apiDocuments.id, documentIds))
    : [];

  const documents = docs
    .map((d) => {
      const of = (type: EventRow["type"]) => totals.find((t) => t.documentId === d.id && t.type === type);
      const lastViewed = of("view_start")?.lastAt;
      return {
        document: { id: d.externalId, title: d.title },
        internalId: d.id,
        views: of("view_start")?.value ?? 0,
        pageViews: of("page_view")?.value ?? 0,
        linkClicks: of("link_click")?.value ?? 0,
        lastViewedAt: lastViewed ? new Date(lastViewed).toISOString() : null,
      };
    })
    .sort((a, b) => b.views - a.views || b.pageViews - a.pageViews);

  return {
    days,
    totals: {
      views: documents.reduce((n, d) => n + d.views, 0),
      pageViews: documents.reduce((n, d) => n + d.pageViews, 0),
      linkClicks: documents.reduce((n, d) => n + d.linkClicks, 0),
    },
    documents,
  };
}

/** Detailed stats for one document over the last `days` days. */
export async function getDocumentStats(projectId: string, document: { id: string; externalId: string; title: string }, days: number) {
  const since = new Date(Date.now() - days * 86400_000);
  const scope = (type?: EventRow["type"]) =>
    and(
      eq(schema.apiEvents.projectId, projectId),
      eq(schema.apiEvents.documentId, document.id),
      gte(schema.apiEvents.occurredAt, since),
      type ? eq(schema.apiEvents.type, type) : undefined
    );

  const byType = await db
    .select({ type: schema.apiEvents.type, value: count() })
    .from(schema.apiEvents)
    .where(scope())
    .groupBy(schema.apiEvents.type);
  const total = (type: EventRow["type"]) => byType.find((t) => t.type === type)?.value ?? 0;

  const viewsByDay = await db
    .select({ date: day, views: count() })
    .from(schema.apiEvents)
    .where(scope("view_start"))
    .groupBy(day)
    .orderBy(day);

  const pages = await db
    .select({ pageNumber: schema.apiEvents.pageNumber, views: count(), viewers: countDistinct(schema.apiEvents.viewId) })
    .from(schema.apiEvents)
    .where(scope("page_view"))
    .groupBy(schema.apiEvents.pageNumber)
    .orderBy(schema.apiEvents.pageNumber);

  const links = await db
    .select({ url: schema.apiEvents.url, clicks: count() })
    .from(schema.apiEvents)
    .where(scope("link_click"))
    .groupBy(schema.apiEvents.url)
    .orderBy(desc(count()))
    .limit(20);

  const viewScope = and(
    eq(schema.apiViews.projectId, projectId),
    eq(schema.apiViews.documentId, document.id),
    gte(schema.apiViews.viewedAt, since)
  );
  const breakdown = async (column: typeof schema.apiViews.deviceType | typeof schema.apiViews.browser | typeof schema.apiViews.country) =>
    (
      await db
        .select({ label: column, views: count() })
        .from(schema.apiViews)
        .where(viewScope)
        .groupBy(column)
        .orderBy(desc(count()))
        .limit(20)
    ).map((r) => ({ label: r.label ?? "Unknown", views: r.views }));

  return {
    days,
    document: { id: document.externalId, title: document.title },
    totals: { views: total("view_start"), pageViews: total("page_view"), linkClicks: total("link_click") },
    viewsByDay,
    pages: pages.map((p) => ({ pageNumber: p.pageNumber!, views: p.views, viewers: p.viewers })),
    links: links.map((l) => ({ url: l.url!, clicks: l.clicks })),
    devices: await breakdown(schema.apiViews.deviceType),
    browsers: await breakdown(schema.apiViews.browser),
    countries: await breakdown(schema.apiViews.country),
  };
}

/** The dashboard's full stats (same shape as our own flipbooks') for one external document. */
export async function getDocumentDashboardStats(documentId: string, pageCount: number | null) {
  const since = new Date(Date.now() - RETENTION_DAYS * 86400_000);
  const views = await db
    .select()
    .from(schema.apiViews)
    .where(and(eq(schema.apiViews.documentId, documentId), gte(schema.apiViews.viewedAt, since)));
  const events = await db
    .select()
    .from(schema.apiEvents)
    .where(and(eq(schema.apiEvents.documentId, documentId), gte(schema.apiEvents.occurredAt, since)));
  return computeViewStats({
    totalViews: views.length,
    views,
    pageEvents: events
      .filter((e) => e.type === "page_view")
      .map((e) => ({ viewId: e.viewId, pageNumber: e.pageNumber!, occurredAt: e.occurredAt })),
    linkClicks: events.filter((e) => e.type === "link_click").map((e) => ({ url: e.url! })),
    pageCount: pageCount ?? 0, // unknown until the viewer has reported it
  });
}

export async function getDocument(projectId: string, documentId: string) {
  const rows = await db
    .select()
    .from(schema.apiDocuments)
    .where(and(eq(schema.apiDocuments.projectId, projectId), eq(schema.apiDocuments.id, documentId)))
    .limit(1);
  return rows[0] ?? null;
}
