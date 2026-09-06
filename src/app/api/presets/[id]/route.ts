import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { deletePreset, getPresetById, setPresetPassword, updatePreset, type PresetSettingsPatch } from "@/lib/presets";
import { deleteObject } from "@/lib/r2";
import { BACKGROUND_POSITIONS } from "@/lib/background-position";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const preset = await getPresetById(id);
  if (!preset) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ preset });
}

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  allowPrint: z.boolean().optional(),
  themeColor: z.string().max(20).optional(),
  showToolbar: z.boolean().optional(),
  backgroundImageR2Key: z.string().min(1).nullable().optional(),
  backgroundFit: z.enum(["contain", "cover"]).optional(),
  backgroundPosition: z.enum(BACKGROUND_POSITIONS).optional(),
  logoR2Key: z.string().min(1).nullable().optional(),
  logoLinkUrl: z.string().max(2000).nullable().optional(),
  password: z.string().min(1).max(200).nullable().optional(),
});

const REPLACEABLE_IMAGE_FIELDS = ["backgroundImageR2Key", "logoR2Key"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getPresetById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;
  const patch: PresetSettingsPatch = { ...rest };

  if (password !== undefined) {
    await setPresetPassword(id, password);
  }

  for (const field of REPLACEABLE_IMAGE_FIELDS) {
    const newKey = rest[field];
    const oldKey = existing[field];
    if (newKey !== undefined && oldKey && oldKey !== newKey) {
      await deleteObject(oldKey).catch(() => {});
    }
  }

  if (Object.keys(patch).length > 0) {
    await updatePreset(id, patch);
  }

  const preset = await getPresetById(id);
  return Response.json({ preset });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getPresetById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await deletePreset(id);
  return Response.json({ ok: true });
}
