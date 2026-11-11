import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasDeveloperAccess } from "@/lib/users";
import { listProjects } from "@/lib/api-projects";
import { ProjectsManager } from "./projects-manager";

export const metadata: Metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const session = await auth();
  if (!(await hasDeveloperAccess(session?.user.id))) redirect("/dashboard");

  const projects = await listProjects();

  return (
    <ProjectsManager
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        allowedOrigins: p.allowedOrigins,
        status: p.status,
        activeKeyCount: p.activeKeyCount,
      }))}
    />
  );
}
