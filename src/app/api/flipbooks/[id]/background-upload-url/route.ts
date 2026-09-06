import { NextRequest } from "next/server";
import { requireSession } from "@/lib/require-session";
import { getFlipbookById } from "@/lib/flipbooks";
import { createPresignedUploadUrl, flipbookBackgroundKey } from "@/lib/r2";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getFlipbookById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const filename = typeof body.filename === "string" ? body.filename : "background.jpg";
  const contentType = typeof body.contentType === "string" ? body.contentType : "image/jpeg";

  const key = flipbookBackgroundKey(id, filename);
  const uploadUrl = await createPresignedUploadUrl(key, contentType);

  return Response.json({ uploadUrl, key });
}
