import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { getFlipbookById, updateFlipbook } from "@/lib/flipbooks";

const schema = z.object({
  pageCount: z.number().int().min(1).max(20000),
  fileSizeBytes: z.number().int().min(0),
  coverImageR2Key: z.string().min(1).optional(),
});

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

  const flipbook = await updateFlipbook(id, { ...parsed.data, status: "ready" });
  return Response.json({ flipbook });
}
