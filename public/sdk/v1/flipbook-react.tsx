"use client";

/**
 * Flipbook React component, v1 — shows a viewer link in a React / Next.js app.
 * Copy this file into your project; docs at /docs on the flipbook site.
 *
 *   // A server component (or API route) creates the link with your secret key…
 *   const { url } = await flipbook.createViewerToken({ document: { id, title, url: pdfUrl } });
 *   // …and the component shows it.
 *   return <Flipbook url={url} height={720} onPageChange={(e) => console.log(e.pageNumber)} />;
 */

import { useEffect, useRef, type CSSProperties } from "react";

export type FlipbookViewerEvent = {
  type: "ready" | "pagechange" | "linkclick";
  pageNumber?: number;
  pageCount?: number;
  /** linkclick only. */
  url?: string;
};

export type FlipbookProps = {
  /** The viewer `url` from POST /api/v1/viewer-tokens. */
  url: string;
  /** Number = px, or any CSS size such as "80vh". Default 720. */
  height?: number | string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  onReady?: (event: FlipbookViewerEvent) => void;
  onPageChange?: (event: FlipbookViewerEvent) => void;
  onLinkClick?: (event: FlipbookViewerEvent) => void;
};

export function Flipbook({ url, height = 720, title = "Document viewer", className, style, onReady, onPageChange, onLinkClick }: FlipbookProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Latest callbacks without re-subscribing on every render.
  const handlers = useRef({ onReady, onPageChange, onLinkClick });
  useEffect(() => {
    handlers.current = { onReady, onPageChange, onLinkClick };
  });

  useEffect(() => {
    let origin: string;
    try {
      origin = new URL(url, window.location.href).origin;
    } catch {
      return;
    }
    function handleMessage(e: MessageEvent) {
      // Only messages from this viewer's own frame and origin.
      if (e.source !== frameRef.current?.contentWindow || e.origin !== origin) return;
      const data = e.data as { source?: string; type?: string; pageNumber?: number; pageCount?: number; url?: string } | null;
      if (!data || data.source !== "flipbook") return;
      const event: FlipbookViewerEvent = { type: data.type as FlipbookViewerEvent["type"], pageNumber: data.pageNumber, pageCount: data.pageCount, url: data.url };
      if (data.type === "ready") handlers.current.onReady?.(event);
      else if (data.type === "pagechange") handlers.current.onPageChange?.(event);
      else if (data.type === "linkclick") handlers.current.onLinkClick?.(event);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [url]);

  return (
    <iframe
      ref={frameRef}
      src={url}
      title={title}
      allow="fullscreen"
      allowFullScreen
      loading="lazy"
      className={className}
      style={{ display: "block", width: "100%", border: 0, height: typeof height === "number" ? `${height}px` : height, ...style }}
    />
  );
}
