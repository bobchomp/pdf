import { NextRequest } from "next/server";
import { z } from "zod";
import { createUser, listUsers } from "@/lib/users";

export async function GET() {
  const users = await listUsers();
  return Response.json({ needsSetup: users.length === 0 });
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const users = await listUsers();
  if (users.length > 0) {
    return Response.json({ error: "Setup has already been completed. Sign in at /login instead." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await createUser({ ...parsed.data, role: "admin" });
  return Response.json({ user: { id: user?.id, email: user?.email, name: user?.name } });
}
