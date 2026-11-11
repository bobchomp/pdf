import { NextRequest } from "next/server";
import { requireDeveloper } from "@/lib/require-session";
import { createProject } from "@/lib/api-projects";
import { createProjectSchema, parseOrigins } from "@/lib/api-project-input";

export async function POST(req: NextRequest) {
  const { error } = await requireDeveloper();
  if (error) return error;

  const parsed = createProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid project." }, { status: 400 });
  }

  const { origins, error: originsError } = parseOrigins(parsed.data.allowedOrigins);
  if (originsError) return Response.json({ error: originsError }, { status: 400 });

  const project = await createProject({ name: parsed.data.name, allowedOrigins: origins });
  return Response.json({ project });
}
