import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProject, listKeys } from "@/lib/api-projects";
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
  if (session?.user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const keys = await listKeys(id);

  return (
    <ProjectSettings
      project={{
        id: project.id,
        name: project.name,
        allowedOrigins: project.allowedOrigins,
        status: project.status,
        defaultSettings: project.defaultSettings ?? {},
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
