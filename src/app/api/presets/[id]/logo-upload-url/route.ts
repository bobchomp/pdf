import { NextRequest } from "next/server";
import { requireSession } from "@/lib/require-session";
import { getPresetById } from "@/lib/presets";
import { createPresignedUploadUrl, presetLogoKey } from "@/lib/r2";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getPresetById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const filename = typeof body.filename === "string" ? body.filename : "logo.png";
  const contentType = typeof body.contentType === "string" ? body.contentType : "image/png";

  const key = presetLogoKey(id, filename);
  const uploadUrl = await createPresignedUploadUrl(key, contentType);

  return Response.json({ uploadUrl, key });
}
