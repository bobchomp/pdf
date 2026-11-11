import { NextRequest } from "next/server";
import { z } from "zod";
import { eq, max } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireDeveloper } from "@/lib/require-session";
import { getProject } from "@/lib/api-projects";
import { generateWebhookSecret, validateWebhookUrl } from "@/lib/api-webhooks";

const schemaBody = z.object({ url: z.string().trim().max(2000) });

/**
 * Sets the address stats are sent to. A first-time webhook gets a signing secret and starts from
 * events recorded from now on (older ones are still available from the events API).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireDeveloper();
  if (error) return error;
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = schemaBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give the webhook address." }, { status: 400 });
  const urlError = validateWebhookUrl(parsed.data.url);
  if (urlError) return Response.json({ error: urlError }, { status: 400 });

  const isNew = !project.webhookUrl;
  let cursor = project.webhookCursor;
  if (isNew) {
    const rows = await db
      .select({ latest: max(schema.apiEvents.seq) })
      .from(schema.apiEvents)
      .where(eq(schema.apiEvents.projectId, id));
    cursor = rows[0]?.latest ?? 0;
  }

  await db
    .update(schema.apiProjects)
    .set({
      webhookUrl: parsed.data.url,
      webhookSecret: project.webhookSecret ?? generateWebhookSecret(),
      webhookCursor: cursor,
      webhookFailures: 0,
      webhookNextAttemptAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.apiProjects.id, id));
  return Response.json({ ok: true });
}

/** Stops sending stats. The secret is dropped too; setting a webhook again issues a new one. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireDeveloper();
  if (error) return error;
  const { id } = await params;
  if (!(await getProject(id))) return Response.json({ error: "Not found" }, { status: 404 });
  await db
    .update(schema.apiProjects)
    .set({ webhookUrl: null, webhookSecret: null, webhookFailures: 0, webhookNextAttemptAt: null, updatedAt: new Date() })
    .where(eq(schema.apiProjects.id, id));
  return Response.json({ ok: true });
}
