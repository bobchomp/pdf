"use client";

import { useMemo, useRef } from "react";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import type { ViewerSettings } from "@/lib/viewer-settings";

function post(path: string, body: Record<string, unknown>) {
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// One view per page load, however many times React renders (it renders twice in development).
const views = new Map<string, Promise<string | null>>();
function startView(token: string, referrer: string) {
  if (typeof window === "undefined") return Promise.resolve(null);
  let view = views.get(token);
  if (!view) {
    view = post("/api/viewer/views", { token, referrer })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { viewId?: string } | null) => data?.viewId ?? null)
      .catch(() => null);
    views.set(token, view);
  }
  return view;
}

export function ExternalViewer({
  token,
  referrer,
  title,
  pdfUrl,
  settings,
}: {
  token: string;
  referrer: string;
  title: string;
  pdfUrl: string;
  settings: ViewerSettings;
}) {
  // The view is recorded as the viewer opens; page and link events wait for its ID rather than
  // holding up the PDF.
  const viewId = useMemo(() => startView(token, referrer), [token, referrer]);
  const pageCountSent = useRef(false);

  function track(body: Record<string, unknown>) {
    viewId.then((id) => (id ? post("/api/viewer/events", { viewId: id, ...body }) : null)).catch(() => {});
  }

  return (
    <div className="h-dvh w-full overflow-hidden">
      <FlipbookViewer
        pdfUrl={pdfUrl}
        title={title}
        themeColor={settings.backgroundColor}
        headerColor={settings.headerColor}
        headerTextColor={settings.headerTextColor}
        backgroundImageUrl={settings.backgroundImageUrl}
        backgroundFit={settings.backgroundFit}
        backgroundPosition={settings.backgroundPosition}
        logoUrl={settings.logoUrl}
        logoLinkUrl={settings.logoLinkUrl}
        showToolbar={settings.showHeader}
        showTitle={settings.showTitle}
        allowPrint={settings.showPrint}
        allowDownload={settings.showDownload}
        showFullscreen={settings.showFullscreen}
        showPageArrows={settings.showPageArrows}
        enableZoom={settings.enableZoom}
        startPage={settings.startPage}
        onPageView={(pageNumber, pageCount) => {
          // The page count rides along once, so stats can show how many people reached the end.
          track(pageCountSent.current ? { type: "page_view", pageNumber } : { type: "page_view", pageNumber, pageCount });
          pageCountSent.current = true;
        }}
        onLinkClick={(pageNumber, url) => track({ type: "link_click", pageNumber, url })}
      />
    </div>
  );
}
