import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { getFlipbookById } from "@/lib/flipbooks";
import { applyPresetToFlipbook, getPresetById } from "@/lib/presets";
import { createPresignedGetUrl } from "@/lib/r2";

const schema = z.object({ presetId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getFlipbookById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const preset = await getPresetById(parsed.data.presetId);
  if (!preset) return Response.json({ error: "Preset not found" }, { status: 404 });

  const flipbook = await applyPresetToFlipbook(id, preset.id);
  if (!flipbook) return Response.json({ error: "Failed to apply preset" }, { status: 500 });

  const [backgroundImageUrl, logoUrl] = await Promise.all([
    flipbook.backgroundImageR2Key ? createPresignedGetUrl(flipbook.backgroundImageR2Key).catch(() => null) : null,
    flipbook.logoR2Key ? createPresignedGetUrl(flipbook.logoR2Key).catch(() => null) : null,
  ]);

  return Response.json({ flipbook, backgroundImageUrl, logoUrl });
}
