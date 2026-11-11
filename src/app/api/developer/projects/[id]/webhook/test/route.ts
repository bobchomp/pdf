import { NextRequest } from "next/server";
import { requireDeveloper } from "@/lib/require-session";
import { getProject } from "@/lib/api-projects";
import { sendTestWebhook } from "@/lib/api-webhooks";

/** Sends one sample event, signed like a real delivery, and reports how the endpoint responded. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireDeveloper();
  if (error) return error;
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  if (!project.webhookUrl || !project.webhookSecret) return Response.json({ error: "Set a webhook address first." }, { status: 400 });
  return Response.json(await sendTestWebhook(project));
}
