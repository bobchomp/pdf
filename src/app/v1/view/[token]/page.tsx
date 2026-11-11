import type { Metadata } from "next";
import { headers } from "next/headers";
import { getViewerToken } from "@/lib/api-viewer";
import { resolveViewerSettings } from "@/lib/viewer-settings";
import { ExternalViewer } from "./external-viewer";

// Shown inside other people's websites, so it carries their document's name, not this site's.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const found = await getViewerToken(token);
  const shown = found.status === "ok" && !(found.project.embedOnly && openedDirectly((await headers()).get("sec-fetch-dest")));
  return {
    title: { absolute: shown ? found.document.title : "Document unavailable" },
    robots: { index: false, follow: false },
  };
}

const messages = {
  not_found: "This document link isn't valid.",
  expired: "This document link has expired. Reload the page to get a new one.",
  disabled: "This document isn't available right now.",
  embed_only: "This document can only be viewed on the website it's published on.",
};

/**
 * Whether the browser says this page was opened directly (a tab or window) rather than inside a
 * frame. Browsers send Sec-Fetch-Dest on every navigation; when it's missing (older browsers, or
 * a non-browser client) this can't tell, so it doesn't block. It stops a viewer link being
 * shared and opened on its own — not a determined scraper, since the PDF address is the
 * project's own and is visible to the browser either way.
 */
function openedDirectly(dest: string | null) {
  return dest !== null && dest !== "iframe" && dest !== "frame";
}

function Unavailable({ message }: { message: string }) {
  return <div className="flex h-dvh items-center justify-center bg-white px-6 text-center text-sm text-gray-500">{message}</div>;
}

export default async function HostedViewerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getViewerToken(token);
  const h = await headers();

  if (found.status !== "ok") return <Unavailable message={messages[found.status]} />;
  if (found.project.embedOnly && openedDirectly(h.get("sec-fetch-dest"))) return <Unavailable message={messages.embed_only} />;

  // The page embedding the viewer — usually just its origin, per the browser's referrer policy.
  const referrer = h.get("referer") ?? "";

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
