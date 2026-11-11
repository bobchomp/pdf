import { z } from "zod";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { updateProject } from "@/lib/api-projects";
import type { ApiProject } from "@/db/schema";
import { describeZodError, projectDefaultSettingsSchema } from "@/lib/viewer-settings";

function projectBody(project: ApiProject) {
  return {
    id: project.id,
    name: project.name,
    allowedOrigins: project.allowedOrigins,
    defaultSettings: project.defaultSettings ?? {},
  };
}

/** Returns the project a secret key belongs to — also a quick way to check a key is set up correctly. */
export async function GET(req: Request) {
  const { project, key, error } = await requireApiKey(req);
  if (error) return error;

  return Response.json(
    { project: projectBody(project), key: { id: key.id, name: key.name, prefix: key.keyPrefix } },
    { headers: { "Cache-Control": "no-store" } }
  );
}

const patchSchema = z.object({ defaultSettings: projectDefaultSettingsSchema }).strict();

/** Replaces the project's default display settings (every viewer token starts from these). */
export async function PATCH(req: Request) {
  const { project, error } = await requireApiKey(req);
  if (error) return error;

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return apiError(400, "invalid_request", "Send a JSON body.");
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "invalid_request", describeZodError(parsed.error));

  const updated = await updateProject(project.id, { defaultSettings: parsed.data.defaultSettings });
  return Response.json({ project: projectBody(updated!) }, { headers: { "Cache-Control": "no-store" } });
}
