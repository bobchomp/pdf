import { NextRequest } from "next/server";
import { requireDeveloper } from "@/lib/require-session";
import { revokeKey } from "@/lib/api-projects";

/** Revokes a key. It stops working immediately; the record stays so past usage is still visible. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; keyId: string }> }) {
  const { error } = await requireDeveloper();
  if (error) return error;

  const { id, keyId } = await params;
  if (!(await revokeKey(id, keyId))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
