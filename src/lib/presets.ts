import "server-only";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { copyObject, deleteObject, flipbookBackgroundKey, flipbookLogoKey, keyFilename } from "@/lib/r2";

export async function listPresets() {
  return db.select().from(schema.presets).orderBy(desc(schema.presets.createdAt));
}

export async function getPresetById(id: string) {
  const rows = await db.select().from(schema.presets).where(eq(schema.presets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getDefaultPreset() {
  const rows = await db.select().from(schema.presets).where(eq(schema.presets.isDefault, true)).limit(1);
  return rows[0] ?? null;
}

export async function createPreset(name: string) {
  const id = newId("preset");
  const now = new Date();
  await db.insert(schema.presets).values({ id, name, createdAt: now, updatedAt: now });
  return getPresetById(id);
}

export type PresetSettingsPatch = Partial<{
  name: string;
  isDefault: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
  themeColor: string;
  showToolbar: boolean;
  backgroundImageR2Key: string | null;
  backgroundFit: "contain" | "cover";
  backgroundPosition: string;
  logoR2Key: string | null;
  logoLinkUrl: string | null;
}>;

export async function updatePreset(id: string, patch: PresetSettingsPatch) {
  if (patch.isDefault) {
    await db.update(schema.presets).set({ isDefault: false }).where(eq(schema.presets.isDefault, true));
  }
  await db
    .update(schema.presets)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.presets.id, id));
  return getPresetById(id);
}

export async function setPresetPassword(id: string, password: string | null) {
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  await db
    .update(schema.presets)
    .set({ passwordHash, isPrivate: !!password, updatedAt: new Date() })
    .where(eq(schema.presets.id, id));
  return getPresetById(id);
}

export async function deletePreset(id: string) {
  const preset = await getPresetById(id);
  if (!preset) return;

  if (preset.backgroundImageR2Key) await deleteObject(preset.backgroundImageR2Key).catch(() => {});
  if (preset.logoR2Key) await deleteObject(preset.logoR2Key).catch(() => {});

  await db.update(schema.flipbooks).set({ presetId: null }).where(eq(schema.flipbooks.presetId, id));
  await db.delete(schema.presets).where(eq(schema.presets.id, id));
}

/**
 * Copies a preset's settings onto a flipbook as a one-time snapshot — not a live link. Any
 * background/logo image is duplicated under the flipbook's own R2 keys so the flipbook and the
 * preset never share (and can never accidentally delete) the same underlying object.
 */
export async function applyPresetToFlipbook(flipbookId: string, presetId: string) {
  const preset = await getPresetById(presetId);
  if (!preset) return null;

  const existingRows = await db.select().from(schema.flipbooks).where(eq(schema.flipbooks.id, flipbookId)).limit(1);
  const existing = existingRows[0];
  if (!existing) return null;

  let backgroundImageR2Key: string | null = null;
  if (preset.backgroundImageR2Key) {
    backgroundImageR2Key = flipbookBackgroundKey(flipbookId, keyFilename(preset.backgroundImageR2Key));
    await copyObject(preset.backgroundImageR2Key, backgroundImageR2Key);
  }
  let logoR2Key: string | null = null;
  if (preset.logoR2Key) {
    logoR2Key = flipbookLogoKey(flipbookId, keyFilename(preset.logoR2Key));
    await copyObject(preset.logoR2Key, logoR2Key);
  }

  if (existing.backgroundImageR2Key && existing.backgroundImageR2Key !== backgroundImageR2Key) {
    await deleteObject(existing.backgroundImageR2Key).catch(() => {});
  }
  if (existing.logoR2Key && existing.logoR2Key !== logoR2Key) {
    await deleteObject(existing.logoR2Key).catch(() => {});
  }

  await db
    .update(schema.flipbooks)
    .set({
      presetId: preset.id,
      isPrivate: preset.isPrivate,
      passwordHash: preset.passwordHash,
      allowDownload: preset.allowDownload,
      allowPrint: preset.allowPrint,
      themeColor: preset.themeColor,
      showToolbar: preset.showToolbar,
      backgroundImageR2Key,
      backgroundFit: preset.backgroundFit,
      backgroundPosition: preset.backgroundPosition,
      logoR2Key,
      logoLinkUrl: preset.logoLinkUrl,
      updatedAt: new Date(),
    })
    .where(eq(schema.flipbooks.id, flipbookId));

  const updatedRows = await db.select().from(schema.flipbooks).where(eq(schema.flipbooks.id, flipbookId)).limit(1);
  return updatedRows[0] ?? null;
}
