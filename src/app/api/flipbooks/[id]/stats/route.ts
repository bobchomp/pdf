import { NextRequest } from "next/server";
import { requireSession } from "@/lib/require-session";
import { getFlipbookById, getViewStats } from "@/lib/flipbooks";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const flipbook = await getFlipbookById(id);
  if (!flipbook) return Response.json({ error: "Not found" }, { status: 404 });

  const stats = await getViewStats(id);
  return Response.json({ stats });
}
