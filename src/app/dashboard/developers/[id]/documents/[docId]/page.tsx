import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasDeveloperAccess } from "@/lib/users";
import { getProject } from "@/lib/api-projects";
import { getDocument, getDocumentDashboardStats } from "@/lib/api-events";
import { StatsView } from "@/app/dashboard/stats/[id]/stats-view";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, docId } = await params;
  const doc = await getDocument(id, docId);
  return { title: doc ? `${doc.title} stats` : "Stats" };
}

export default async function ExternalDocumentStatsPage({ params }: Params) {
  const session = await auth();
  if (!(await hasDeveloperAccess(session?.user.id))) redirect("/dashboard");

  const { id, docId } = await params;
  const project = await getProject(id);
  const doc = project ? await getDocument(id, docId) : null;
  if (!project || !doc) notFound();

  const stats = await getDocumentDashboardStats(doc.id, doc.pageCount);

  return (
    <div>
      <Link href={`/dashboard/developers/${project.id}`} className="text-[13px] font-semibold text-blue-600 hover:text-navy-700">
        ← {project.name}
      </Link>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight text-navy-900">{doc.title}</h1>
      <p className="mt-1 text-[13.5px] text-gray-400">
        <code className="font-mono">{doc.externalId}</code> · last 30 days
      </p>
      <StatsView stats={stats} />
    </div>
  );
}
