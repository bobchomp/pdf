import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/require-session";
import { deleteProject, getProject, updateProject } from "@/lib/api-projects";
import { parseOrigins, updateProjectSchema } from "@/lib/api-project-input";
import { describeZodError } from "@/lib/viewer-settings";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (!(await getProject(id))) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = updateProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: describeZodError(parsed.error) }, { status: 400 });
  }

  const { allowedOrigins, ...rest } = parsed.data;
  const patch: Parameters<typeof updateProject>[1] = { ...rest };
  if (allowedOrigins) {
    const { origins, error: originsError } = parseOrigins(allowedOrigins);
    if (originsError) return Response.json({ error: originsError }, { status: 400 });
    patch.allowedOrigins = origins;
  }

  const project = await updateProject(id, patch);
  return Response.json({ project });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (!(await getProject(id))) return Response.json({ error: "Not found" }, { status: 404 });

  await deleteProject(id);
  return Response.json({ ok: true });
}
