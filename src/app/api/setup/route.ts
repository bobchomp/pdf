import { NextRequest } from "next/server";
import { z } from "zod";
import { createUser, listUsers } from "@/lib/users";
import { AppError } from "@/lib/errors";

// This route is intentionally unauthenticated (there's no account to authenticate with before
// setup completes), so its errors must never include raw infrastructure detail — a database
// misconfiguration or outage would otherwise hand an anonymous caller the literal failing SQL.
const GENERIC_DB_ERROR = "Failed to reach the database. Check the server's Cloudflare D1 configuration.";

export async function GET() {
  try {
    const users = await listUsers();
    return Response.json({ needsSetup: users.length === 0 });
  } catch (err) {
    console.error("GET /api/setup failed:", err);
    return Response.json({ error: GENERIC_DB_ERROR }, { status: 500 });
  }
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  let users;
  try {
    users = await listUsers();
  } catch (err) {
    console.error("POST /api/setup failed:", err);
    return Response.json({ error: GENERIC_DB_ERROR }, { status: 500 });
  }

  if (users.length > 0) {
    return Response.json({ error: "Setup has already been completed. Sign in at /login instead." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await createUser({ ...parsed.data, role: "admin" });
    return Response.json({ user: { id: user?.id, email: user?.email, name: user?.name } });
  } catch (err) {
    console.error("POST /api/setup failed:", err);
    return Response.json({ error: err instanceof AppError ? err.message : GENERIC_DB_ERROR }, { status: 500 });
  }
}
