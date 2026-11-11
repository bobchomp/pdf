import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireDeveloper } from "@/lib/require-session";
import { getProject } from "@/lib/api-projects";
import { generateWebhookSecret } from "@/lib/api-webhooks";

/** Replaces the signing secret; deliveries are signed with the new one immediately. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireDeveloper();
  if (error) return error;
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  if (!project.webhookUrl) return Response.json({ error: "Set a webhook address first." }, { status: 400 });
  await db.update(schema.apiProjects).set({ webhookSecret: generateWebhookSecret(), updatedAt: new Date() }).where(eq(schema.apiProjects.id, id));
  return Response.json({ ok: true });
}
