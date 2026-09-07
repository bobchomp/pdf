import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-session";
import { createUser, listUsers } from "@/lib/users";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await listUsers();
  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      mustResetPassword: u.mustResetPassword,
      createdAt: u.createdAt,
    })),
  });
}

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await createUser(parsed.data);
    return Response.json({ user: { id: user?.id, email: user?.email, name: user?.name, role: user?.role } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed to create user" }, { status: 400 });
  }
}
