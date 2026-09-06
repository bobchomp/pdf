import "server-only";
import bcrypt from "bcryptjs";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId, newSlug } from "@/lib/ids";
import { deleteObject } from "@/lib/r2";

export async function listFlipbooks() {
  return db.select().from(schema.flipbooks).orderBy(desc(schema.flipbooks.createdAt));
}

export async function getFlipbookById(id: string) {
  const rows = await db.select().from(schema.flipbooks).where(eq(schema.flipbooks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getFlipbookBySlug(slug: string) {
  const rows = await db.select().from(schema.flipbooks).where(eq(schema.flipbooks.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function createDraftFlipbook(input: {
  id: string;
  ownerId: string;
  title: string;
  originalFilename: string;
  r2Key: string;
}) {
  const { id } = input;
  const now = new Date();
  await db.insert(schema.flipbooks).values({
    id,
    slug: newSlug(input.title),
    ownerId: input.ownerId,
    title: input.title,
    originalFilename: input.originalFilename,
    r2Key: input.r2Key,
    status: "processing",
    createdAt: now,
    updatedAt: now,
  });
  return getFlipbookById(id);
}

export type FlipbookSettingsPatch = Partial<{
  title: string;
  description: string;
  isPrivate: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
  themeColor: string;
  showToolbar: boolean;
  coverImageR2Key: string | null;
  pageCount: number;
  fileSizeBytes: number;
  status: "processing" | "ready" | "error";
}>;

export async function updateFlipbook(id: string, patch: FlipbookSettingsPatch) {
  await db
    .update(schema.flipbooks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.flipbooks.id, id));
  return getFlipbookById(id);
}

export async function setFlipbookPassword(id: string, password: string | null) {
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  await db
    .update(schema.flipbooks)
    .set({ passwordHash, isPrivate: !!password, updatedAt: new Date() })
    .where(eq(schema.flipbooks.id, id));
  return getFlipbookById(id);
}

export async function verifyFlipbookPassword(id: string, password: string) {
  const flipbook = await getFlipbookById(id);
  if (!flipbook?.passwordHash) return false;
  return bcrypt.compare(password, flipbook.passwordHash);
}

export async function deleteFlipbook(id: string) {
  const flipbook = await getFlipbookById(id);
  if (!flipbook) return;

  await deleteObject(flipbook.r2Key).catch(() => {});
  if (flipbook.coverImageR2Key) {
    await deleteObject(flipbook.coverImageR2Key).catch(() => {});
  }

  await db.delete(schema.flipbookViews).where(eq(schema.flipbookViews.flipbookId, id));
  await db.delete(schema.flipbooks).where(eq(schema.flipbooks.id, id));
}

export async function recordView(flipbookId: string, referrer: string, source: "direct" | "embed") {
  await db.insert(schema.flipbookViews).values({
    id: newId("view"),
    flipbookId,
    viewedAt: new Date(),
    referrer: referrer.slice(0, 500),
    source,
  });
}

export async function getViewStats(flipbookId: string) {
  const all = await db
    .select()
    .from(schema.flipbookViews)
    .where(eq(schema.flipbookViews.flipbookId, flipbookId));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select()
    .from(schema.flipbookViews)
    .where(and(eq(schema.flipbookViews.flipbookId, flipbookId), gte(schema.flipbookViews.viewedAt, thirtyDaysAgo)));

  const byDay = new Map<string, number>();
  for (const view of recent) {
    const day = new Date(view.viewedAt).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  return {
    totalViews: all.length,
    last30Days: Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
  };
}
