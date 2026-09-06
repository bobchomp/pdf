import { NextRequest } from "next/server";
import { z } from "zod";
import { getFlipbookBySlug, verifyFlipbookPassword } from "@/lib/flipbooks";
import { createFlipbookAccessToken, flipbookAccessCookieName } from "@/lib/access-token";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const flipbook = await getFlipbookBySlug(slug);
  if (!flipbook) return Response.json({ error: "Not found" }, { status: 404 });

  if (!flipbook.isPrivate) {
    return Response.json({ ok: true });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Password required" }, { status: 400 });
  }

  const valid = await verifyFlipbookPassword(flipbook.id, parsed.data.password);
  if (!valid) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = createFlipbookAccessToken(flipbook.id);
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${flipbookAccessCookieName(flipbook.id)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return res;
}
