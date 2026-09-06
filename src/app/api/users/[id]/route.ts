import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/require-session";
import { db, schema } from "@/db/client";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (id === session!.user.id) {
    return Response.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  await db.delete(schema.users).where(eq(schema.users.id, id));
  return Response.json({ ok: true });
}
