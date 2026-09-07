import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-session";
import { getUserById, resetUserPassword } from "@/lib/users";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await resetUserPassword(id);
  return Response.json({ ok: true });
}
