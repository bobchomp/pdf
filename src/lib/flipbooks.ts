import "server-only";
import bcrypt from "bcryptjs";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId, newSlug } from "@/lib/ids";
import { deleteObject } from "@/lib/r2";
import { applyPresetToFlipbook, getDefaultPreset } from "@/lib/presets";
import { toLondonHourAndWeekday } from "@/lib/time";
import { parseUserAgent } from "@/lib/user-agent";

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

export async function getViewById(viewId: string) {
  const rows = await db.select().from(schema.flipbookViews).where(eq(schema.flipbookViews.id, viewId)).limit(1);
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
    slug: newSlug(),
    ownerId: input.ownerId,
    title: input.title,
    originalFilename: input.originalFilename,
    r2Key: input.r2Key,
    status: "processing",
    createdAt: now,
    updatedAt: now,
  });

  // Best-effort: applying the default preset is a convenience, not the point of uploading a
  // PDF. A failure here (e.g. a transient R2 error copying its background/logo image) shouldn't
  // fail the whole upload — the flipbook still gets created with factory defaults, and a preset
  // can always be applied afterward from its settings page.
  const defaultPreset = await getDefaultPreset();
  if (defaultPreset) {
    try {
      await applyPresetToFlipbook(id, defaultPreset.id);
    } catch (err) {
      console.error(`Failed to apply default preset to new flipbook ${id}:`, err);
    }
  }

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
  backgroundImageR2Key: string | null;
  backgroundFit: "contain" | "cover";
  backgroundPosition: string;
  logoR2Key: string | null;
  logoLinkUrl: string | null;
  presetId: string | null;
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

export async function regenerateFlipbookSlug(id: string) {
  await db
    .update(schema.flipbooks)
    .set({ slug: newSlug(), updatedAt: new Date() })
    .where(eq(schema.flipbooks.id, id));
  return getFlipbookById(id);
}

export async function setFlipbookPassword(id: string, password: string | null) {
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  await db
    .update(schema.flipbooks)
    .set({ passwordHash, isPrivate: !!password, presetId: null, updatedAt: new Date() })
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
  if (flipbook.backgroundImageR2Key) {
    await deleteObject(flipbook.backgroundImageR2Key).catch(() => {});
  }
  if (flipbook.logoR2Key) {
    await deleteObject(flipbook.logoR2Key).catch(() => {});
  }

  await db.delete(schema.flipbookLinkClicks).where(eq(schema.flipbookLinkClicks.flipbookId, id));
  await db.delete(schema.flipbookPageEvents).where(eq(schema.flipbookPageEvents.flipbookId, id));
  await db.delete(schema.flipbookViews).where(eq(schema.flipbookViews.flipbookId, id));
  await db.delete(schema.flipbooks).where(eq(schema.flipbooks.id, id));
}

export async function recordView(
  flipbookId: string,
  referrer: string,
  source: "direct" | "embed",
  meta: { userAgent: string | null; country: string | null; region: string | null },
) {
  const { deviceType, browser } = parseUserAgent(meta.userAgent);
  const id = newId("view");
  await db.insert(schema.flipbookViews).values({
    id,
    flipbookId,
    viewedAt: new Date(),
    referrer: referrer.slice(0, 500),
    source,
    deviceType,
    browser,
    country: meta.country,
    region: meta.region,
  });
  return id;
}

export async function recordPageEvent(viewId: string, flipbookId: string, pageNumber: number) {
  await db.insert(schema.flipbookPageEvents).values({
    id: newId("pgevt"),
    viewId,
    flipbookId,
    pageNumber,
    occurredAt: new Date(),
  });
}

export async function recordLinkClick(viewId: string, flipbookId: string, pageNumber: number, url: string) {
  await db.insert(schema.flipbookLinkClicks).values({
    id: newId("click"),
    viewId,
    flipbookId,
    pageNumber,
    url: url.slice(0, 1000),
    clickedAt: new Date(),
  });
}

function bucketCount(entries: string[]): Array<{ label: string; count: number }> {
  const m = new Map<string, number>();
  for (const label of entries) {
    m.set(label, (m.get(label) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getFlipbookStats(flipbookId: string) {
  const flipbook = await getFlipbookById(flipbookId);

  const totalRows = await db
    .select({ value: count() })
    .from(schema.flipbookViews)
    .where(eq(schema.flipbookViews.flipbookId, flipbookId));
  const totalViews = totalRows[0]?.value ?? 0;

  const views = await db.select().from(schema.flipbookViews).where(eq(schema.flipbookViews.flipbookId, flipbookId));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const byDay = new Map<string, number>();
  const byHour = new Map<number, number>();
  const byWeekday = new Map<number, number>();
  const deviceTypes: string[] = [];
  const browsers: string[] = [];
  const countries: string[] = [];
  const regions: string[] = [];

  for (const view of views) {
    const viewedAt = new Date(view.viewedAt);
    if (viewedAt >= thirtyDaysAgo) {
      const day = viewedAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    deviceTypes.push(view.deviceType ? view.deviceType[0].toUpperCase() + view.deviceType.slice(1) : "Unknown");
    browsers.push(view.browser ?? "Unknown");
    if (view.country) countries.push(view.country);
    if (view.country && view.region) regions.push(`${view.country} / ${view.region}`);

    const { hour, weekday } = toLondonHourAndWeekday(viewedAt);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + 1);
  }

  const pageEvents = await db
    .select()
    .from(schema.flipbookPageEvents)
    .where(eq(schema.flipbookPageEvents.flipbookId, flipbookId));

  const linkClicks = await db
    .select()
    .from(schema.flipbookLinkClicks)
    .where(eq(schema.flipbookLinkClicks.flipbookId, flipbookId));

  const pageReachedBy = new Map<number, Set<string>>();
  const sessions = new Map<string, { maxPage: number; minAt: Date; maxAt: Date; eventCount: number }>();

  for (const event of pageEvents) {
    const occurredAt = new Date(event.occurredAt);

    if (!pageReachedBy.has(event.pageNumber)) pageReachedBy.set(event.pageNumber, new Set());
    pageReachedBy.get(event.pageNumber)!.add(event.viewId);

    const existing = sessions.get(event.viewId);
    if (!existing) {
      sessions.set(event.viewId, { maxPage: event.pageNumber, minAt: occurredAt, maxAt: occurredAt, eventCount: 1 });
    } else {
      existing.maxPage = Math.max(existing.maxPage, event.pageNumber);
      existing.minAt = existing.minAt < occurredAt ? existing.minAt : occurredAt;
      existing.maxAt = existing.maxAt > occurredAt ? existing.maxAt : occurredAt;
      existing.eventCount += 1;
    }
  }

  const pageEngagement = Array.from(pageReachedBy.entries())
    .map(([pageNumber, sessionIds]) => ({ pageNumber, sessions: sessionIds.size }))
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const sessionsWithEvents = sessions.size;
  const pageCount = flipbook?.pageCount ?? 0;
  const completedSessions = pageCount ? Array.from(sessions.values()).filter((s) => s.maxPage >= pageCount).length : 0;
  const completionRate = pageCount && sessionsWithEvents > 0 ? completedSessions / sessionsWithEvents : null;

  const durationsSeconds = Array.from(sessions.values())
    .filter((s) => s.eventCount > 1)
    .map((s) => (s.maxAt.getTime() - s.minAt.getTime()) / 1000);
  const avgSessionDurationSeconds =
    durationsSeconds.length > 0 ? durationsSeconds.reduce((sum, d) => sum + d, 0) / durationsSeconds.length : null;

  return {
    totalViews,
    last30Days: Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayCount]) => ({ date, count: dayCount })),
    deviceBreakdown: bucketCount(deviceTypes),
    browserBreakdown: bucketCount(browsers),
    countryBreakdown: bucketCount(countries),
    regionBreakdown: bucketCount(regions),
    hourOfDay: Array.from({ length: 24 }, (_, hour) => ({ hour, count: byHour.get(hour) ?? 0 })),
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, weekday) => ({
      weekday,
      label,
      count: byWeekday.get(weekday) ?? 0,
    })),
    pageCount,
    pageEngagement,
    sessionsWithEvents,
    completionRate,
    linkClicks: bucketCount(linkClicks.map((c) => c.url)),
    avgSessionDurationSeconds,
  };
}
