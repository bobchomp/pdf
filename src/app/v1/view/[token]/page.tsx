import type { Metadata } from "next";
import { headers } from "next/headers";
import { getViewerToken } from "@/lib/api-viewer";
import { resolveViewerSettings } from "@/lib/viewer-settings";
import { ExternalViewer } from "./external-viewer";

// Shown inside other people's websites, so it carries their document's name, not this site's.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const found = await getViewerToken(token);
  return {
    title: { absolute: found.status === "ok" ? found.document.title : "Document unavailable" },
    robots: { index: false, follow: false },
  };
}

const messages = {
  not_found: "This document link isn't valid.",
  expired: "This document link has expired. Reload the page to get a new one.",
  disabled: "This document isn't available right now.",
};

export default async function HostedViewerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getViewerToken(token);

  if (found.status !== "ok") {
    return (
      <div className="flex h-dvh items-center justify-center bg-white px-6 text-center text-sm text-gray-500">
        {messages[found.status]}
      </div>
    );
  }

  // The page embedding the viewer — usually just its origin, per the browser's referrer policy.
  const referrer = (await headers()).get("referer") ?? "";

  return (
    <ExternalViewer
      token={token}
      referrer={referrer}
      title={found.document.title}
      pdfUrl={found.document.pdfUrl}
      settings={resolveViewerSettings(found.project.defaultSettings ?? {}, found.token.settings ?? {})}
    />
  );
}
