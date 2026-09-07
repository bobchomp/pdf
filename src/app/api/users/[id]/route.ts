import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/require-session";
import { db, schema } from "@/db/client";
import { getUserById, updateUser } from "@/lib/users";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "member"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (id === session!.user.id && parsed.data.role === "member") {
    return Response.json({ error: "You cannot remove your own admin access." }, { status: 400 });
  }

  try {
    const user = await updateUser(id, parsed.data);
    return Response.json({ user: { id: user?.id, email: user?.email, name: user?.name, role: user?.role } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed to update user" }, { status: 400 });
  }
}

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
