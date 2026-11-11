import { NextRequest } from "next/server";
import { requireDeveloper } from "@/lib/require-session";
import { getProject } from "@/lib/api-projects";
import { deliverWebhooks } from "@/lib/api-webhooks";

export const maxDuration = 120;

/** Delivers waiting events now, without waiting out the retry back-off. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireDeveloper();
  if (error) return error;
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  if (!project.webhookUrl) return Response.json({ error: "Set a webhook address first." }, { status: 400 });
  const result = await deliverWebhooks(id, { force: true });
  if (result.skipped) return Response.json({ error: "A delivery is already in progress — try again in a minute." }, { status: 409 });
  return Response.json(result);
}
