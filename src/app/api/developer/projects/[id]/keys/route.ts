import { NextRequest } from "next/server";
import { requireDeveloper } from "@/lib/require-session";
import { createKey, getProject } from "@/lib/api-projects";
import { createKeySchema } from "@/lib/api-project-input";

/** Creates a key. The full key is in this response only; afterwards just its first characters are kept. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireDeveloper();
  if (error) return error;

  const { id } = await params;
  if (!(await getProject(id))) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = createKeySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid key name." }, { status: 400 });
  }

  const key = await createKey(id, parsed.data.name);
  return Response.json({ key }, { headers: { "Cache-Control": "no-store" } });
}
