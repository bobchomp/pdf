import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasDeveloperAccess } from "@/lib/users";
import { getProject, listKeys } from "@/lib/api-projects";
import { getProjectStats, RETENTION_DAYS } from "@/lib/api-events";
import { countUndelivered, listDeliveries } from "@/lib/api-webhooks";
import { ProjectSettings } from "./project-settings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project?.name ?? "Project" };
}

// Formatted here rather than in the browser so server and client render the same text.
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});
const formatDate = (d: Date | null) => (d ? dateTime.format(new Date(d)) : null);

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!(await hasDeveloperAccess(session?.user.id))) redirect("/dashboard");

  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const keys = await listKeys(id);
  const stats = await getProjectStats(id, RETENTION_DAYS);
  const deliveries = project.webhookUrl ? await listDeliveries(id) : [];
  const undelivered = project.webhookUrl ? await countUndelivered(project) : 0;

  return (
    <ProjectSettings
      project={{
        id: project.id,
        name: project.name,
        allowedOrigins: project.allowedOrigins,
        status: project.status,
        defaultSettings: project.defaultSettings ?? {},
      }}
      stats={{
        totals: stats.totals,
        documents: stats.documents.map((d) => ({
          id: d.internalId,
          externalId: d.document.id,
          title: d.document.title,
          views: d.views,
          pageViews: d.pageViews,
          linkClicks: d.linkClicks,
          lastViewedAt: d.lastViewedAt ? formatDate(new Date(d.lastViewedAt)) : null,
        })),
      }}
      webhook={{
        url: project.webhookUrl,
        secret: project.webhookSecret,
        failures: project.webhookFailures,
        nextAttemptAt: formatDate(project.webhookNextAttemptAt),
        undelivered,
        deliveries: deliveries.map((d) => ({
          id: d.id,
          attemptedAt: formatDate(d.attemptedAt)!,
          eventCount: d.eventCount,
          isTest: d.isTest,
          success: d.success,
          statusCode: d.statusCode,
          error: d.error,
          durationMs: d.durationMs,
        })),
      }}
      keys={keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        createdAt: formatDate(k.createdAt)!,
        lastUsedAt: formatDate(k.lastUsedAt),
        revoked: k.revokedAt !== null,
      }))}
    />
  );
}
