import { NextRequest } from "next/server";
import { requireSession } from "@/lib/require-session";
import { getFlipbookById, regenerateFlipbookSlug } from "@/lib/flipbooks";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getFlipbookById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const flipbook = await regenerateFlipbookSlug(id);
  return Response.json({ flipbook });
}
