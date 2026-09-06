"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "@/lib/pdf-client";
import { PdfPage } from "@/components/PdfPage";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as unknown as React.ComponentType<
  Record<string, unknown>
>;

const RENDER_WINDOW = 3;
const DEFAULT_PAGE_ASPECT = 500 / 700; // width/height fallback, used only until the PDF tells us its real one

type PageFlipController = {
  flipNext: () => void;
  flipPrev: () => void;
  update: () => void;
};

/**
 * react-pageflip (showCover=true) always reserves a two-page-wide box, centered in its
 * container, and puts a lone cover page in just the right or left half of it — never both.
 * That leaves the visible page off-center. This mirrors PageCollection's own spread-building
 * logic (page-flip/src/Collection/PageCollection.ts) to know, for a given page and total count,
 * whether it's alone and on which side, so we can shift the whole book to compensate.
 */
function coverShiftDirection(currentPage: number, pageCount: number): "left" | "right" | null {
  if (pageCount <= 0) return null;
  if (currentPage === 0) {
    // The single-page book edge case: page 0 is simultaneously "the cover" and "the last
    // page", and the library's own tie-break assigns it to the left slot, not the right.
    return pageCount === 1 ? "right" : "left";
  }
  const isTrailingLoneBackCover = pageCount > 1 && pageCount % 2 === 0 && currentPage === pageCount - 1;
  return isTrailingLoneBackCover ? "right" : null;
}

export function FlipbookViewer({
  pdfUrl,
  pageCount,
  title,
  themeColor,
  showToolbar,
  allowDownload,
  allowPrint,
}: {
  pdfUrl: string;
  pageCount: number;
  title: string;
  themeColor: string;
  showToolbar: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [pageAspect, setPageAspect] = useState(DEFAULT_PAGE_ASPECT);
  const [wrapperWidth, setWrapperWidth] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flipBookRef = useRef<{ pageFlip: () => PageFlipController } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPdf(pdfUrl)
      .then((loaded) => {
        if (!cancelled) setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load this PDF. The link may have expired — try reloading the page.");
      });
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Read the PDF's real page proportions so the book isn't forced into an arbitrary 5:7 box.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc
      .getPage(1)
      .then((page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        if (viewport.width > 0 && viewport.height > 0) setPageAspect(viewport.width / viewport.height);
      })
      .catch(() => {
        // keep the fallback aspect ratio
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // react-pageflip derives page HEIGHT from width times a fixed ratio — it never checks that
  // against the real available height. So we constrain the WIDTH we give it ourselves,
  // accounting for both dimensions, and let its own math do the rest correctly from there.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    function recompute() {
      const availW = el!.clientWidth;
      const availH = el!.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      // Assumes a two-page landscape spread (the common case); on narrow screens the library
      // falls back to single-page portrait mode on its own once the width is small enough.
      const widthLimitedByHeight = availH * pageAspect * 2;
      setWrapperWidth(Math.max(1, Math.min(availW, widthLimitedByHeight)));
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageAspect]);

  // Once we've resized the box the book lives in, ask it to recalculate against the new size.
  useEffect(() => {
    flipBookRef.current?.pageFlip()?.update();
  }, [wrapperWidth]);

  const pages = useMemo(() => {
    if (!doc) return [];
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }, [doc, pageCount]);

  const shift = orientation === "landscape" ? coverShiftDirection(currentPage, pageCount) : null;
  const flipBookStyle: React.CSSProperties = {
    transition: "transform 300ms ease",
    transform: shift === "left" ? "translateX(-25%) translateZ(0)" : shift === "right" ? "translateX(25%) translateZ(0)" : "translateZ(0)",
  };

  function handleDownload() {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${title || "document"}.pdf`;
    a.click();
  }

  function handlePrint() {
    const win = window.open(pdfUrl, "_blank");
    win?.addEventListener("load", () => win.print());
  }

  const atFirstPage = currentPage === 0;
  const atLastPage = currentPage >= pageCount - 1;

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center text-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center text-sm text-slate-400">
        Loading flipbook…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2" style={{ background: themeColor }}>
      {showToolbar && (
        <div className="flex w-full max-w-4xl shrink-0 items-center justify-between px-4 pt-3 text-sm text-white/90">
          <span className="truncate font-medium">{title}</span>
          <div className="flex items-center gap-3">
            {allowPrint && (
              <button onClick={handlePrint} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                Print
              </button>
            )}
            {allowDownload && (
              <button onClick={handleDownload} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                Download
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={stageRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-6 py-6 sm:px-12 sm:py-10">
        <button
          onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
          disabled={atFirstPage}
          aria-label="Previous page"
          className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-0 sm:left-4"
        >
          ‹
        </button>
        <button
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          disabled={atLastPage}
          aria-label="Next page"
          className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-0 sm:right-4"
        >
          ›
        </button>

        {wrapperWidth && (
          <div style={{ width: wrapperWidth, maxWidth: "100%" }}>
            <HTMLFlipBook
              key={pageCount}
              ref={flipBookRef}
              width={600}
              height={Math.round(600 / pageAspect)}
              size="stretch"
              minWidth={200}
              maxWidth={2200}
              minHeight={280}
              maxHeight={3000}
              maxShadowOpacity={0.4}
              showCover={true}
              mobileScrollSupport={true}
              className="shadow-2xl"
              style={flipBookStyle}
              startPage={0}
              drawShadow={true}
              flippingTime={500}
              usePortrait={true}
              startZIndex={0}
              autoSize={true}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={30}
              showPageCorners={true}
              disableFlipByClick={false}
              onFlip={(e: { data: number }) => setCurrentPage(e.data)}
              onInit={(e: { data: { mode: "portrait" | "landscape" } }) => setOrientation(e.data.mode)}
              onChangeOrientation={(e: { data: "portrait" | "landscape" }) => setOrientation(e.data)}
            >
              {pages.map((pageNumber) => (
                <div key={pageNumber} className="bg-white">
                  <PdfPage doc={doc} pageNumber={pageNumber} shouldRender={Math.abs(pageNumber - 1 - currentPage) <= RENDER_WINDOW} />
                </div>
              ))}
            </HTMLFlipBook>
          </div>
        )}
      </div>

      {showToolbar && (
        <p className="shrink-0 pb-3 text-sm tabular-nums text-white/60">
          {currentPage + 1} / {pageCount}
        </p>
      )}
    </div>
  );
}
