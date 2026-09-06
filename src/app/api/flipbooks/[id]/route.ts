import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { deleteFlipbook, getFlipbookById, setFlipbookPassword, updateFlipbook } from "@/lib/flipbooks";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const flipbook = await getFlipbookById(id);
  if (!flipbook) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ flipbook });
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  allowDownload: z.boolean().optional(),
  allowPrint: z.boolean().optional(),
  themeColor: z.string().max(20).optional(),
  showToolbar: z.boolean().optional(),
  password: z.string().min(1).max(200).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getFlipbookById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;

  if (password !== undefined) {
    await setFlipbookPassword(id, password);
  }

  if (Object.keys(rest).length > 0) {
    await updateFlipbook(id, rest);
  }

  const flipbook = await getFlipbookById(id);
  return Response.json({ flipbook });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getFlipbookById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await deleteFlipbook(id);
  return Response.json({ ok: true });
}
