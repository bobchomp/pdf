import { requireApiKey } from "@/lib/api-auth";

/** Returns the project a secret key belongs to — a quick way to check a key is set up correctly. */
export async function GET(req: Request) {
  const { project, key, error } = await requireApiKey(req);
  if (error) return error;

  return Response.json(
    {
      project: { id: project.id, name: project.name, allowedOrigins: project.allowedOrigins },
      key: { id: key.id, name: key.name, prefix: key.keyPrefix },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
