import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { parseUserAgent } from "@/lib/user-agent";
import { getProject } from "@/lib/api-projects";
import type { ViewerSettingsInput } from "@/lib/viewer-settings";

const TOKEN_PREFIX = "vt_";

/** Creates (or refreshes the title and address of) the project's record of one of its documents. */
async function upsertDocument(projectId: string, input: { id: string; title: string; url: string }) {
  const now = new Date();
  await db
    .insert(schema.apiDocuments)
    .values({ id: newId("doc"), projectId, externalId: input.id, title: input.title, pdfUrl: input.url, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [schema.apiDocuments.projectId, schema.apiDocuments.externalId],
      set: { title: input.title, pdfUrl: input.url, updatedAt: now },
    });
  const rows = await db
    .select({ id: schema.apiDocuments.id })
    .from(schema.apiDocuments)
    .where(and(eq(schema.apiDocuments.projectId, projectId), eq(schema.apiDocuments.externalId, input.id)))
    .limit(1);
  return rows[0]!.id;
}

export async function createViewerToken(
  projectId: string,
  input: { document: { id: string; title: string; url: string }; settings: ViewerSettingsInput; expiresInSeconds: number }
) {
  const documentId = await upsertDocument(projectId, input.document);
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000);
  await db.insert(schema.apiViewerTokens).values({
    id: token,
    projectId,
    documentId,
    settings: input.settings,
    expiresAt,
    createdAt: now,
  });
  return { token, expiresAt };
}

/**
 * Everything the hosted viewer needs for a token — or why it can't be shown. Separate lookups
 * rather than a join: D1 returns rows keyed by column name, so shared columns would collide.
 */
export async function getViewerToken(token: string) {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 100) return { status: "not_found" as const };
  const rows = await db.select().from(schema.apiViewerTokens).where(eq(schema.apiViewerTokens.id, token)).limit(1);
  const row = rows[0];
  if (!row) return { status: "not_found" as const };

  const project = await getProject(row.projectId);
  if (!project) return { status: "not_found" as const };
  if (new Date(row.expiresAt).getTime() <= Date.now()) return { status: "expired" as const, project };
  if (project.status !== "active") return { status: "disabled" as const, project };

  const docs = await db.select().from(schema.apiDocuments).where(eq(schema.apiDocuments.id, row.documentId)).limit(1);
  const document = docs[0];
  if (!document) return { status: "not_found" as const };
  return { status: "ok" as const, token: row, project, document };
}

/** Only the project's allowed websites, for the viewer's frame-ancestors header. */
export async function getFrameAncestorsForToken(token: string) {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 100) return [];
  const rows = await db
    .select({ projectId: schema.apiViewerTokens.projectId })
    .from(schema.apiViewerTokens)
    .where(eq(schema.apiViewerTokens.id, token))
    .limit(1);
  if (!rows[0]) return [];
  const project = await getProject(rows[0].projectId);
  return project?.allowedOrigins ?? [];
}

export async function recordApiView(
  token: { id: string; projectId: string; documentId: string },
  meta: { referrer: string; userAgent: string | null; country: string | null; region: string | null }
) {
  const { deviceType, browser } = parseUserAgent(meta.userAgent);
  const id = newId("aview");
  await db.insert(schema.apiViews).values({
    id,
    projectId: token.projectId,
    documentId: token.documentId,
    tokenId: token.id,
    viewedAt: new Date(),
    referrer: meta.referrer.slice(0, 500),
    deviceType,
    browser,
    country: meta.country,
    region: meta.region,
  });
  return id;
}

export async function getApiView(viewId: string) {
  const rows = await db.select().from(schema.apiViews).where(eq(schema.apiViews.id, viewId)).limit(1);
  return rows[0] ?? null;
}

export async function recordApiViewEvent(
  view: { id: string; projectId: string; documentId: string },
  event: { type: "page_view" | "link_click"; pageNumber: number; url?: string }
) {
  await db.insert(schema.apiViewEvents).values({
    id: newId("aevt"),
    viewId: view.id,
    projectId: view.projectId,
    documentId: view.documentId,
    type: event.type,
    pageNumber: event.pageNumber,
    url: event.url?.slice(0, 1000) ?? null,
    occurredAt: new Date(),
  });
}
