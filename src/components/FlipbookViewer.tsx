"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "@/lib/pdf-client";
import { PdfPage } from "@/components/PdfPage";
import { PdfZoomOverlay, ZOOM_DURATION_MS } from "@/components/PdfZoomOverlay";
import { IconChevronLeft, IconChevronRight, IconDownload, IconPrint, IconFullscreen } from "@/components/icons";
import { cssUrl } from "@/lib/viewer-settings";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as unknown as React.ComponentType<
  Record<string, unknown>
>;

const RENDER_WINDOW = 3;
const DEFAULT_PAGE_ASPECT = 500 / 700; // width/height fallback, used only until the PDF tells us its real one
const NAV_BUTTON_SIZE = 40;
const NAV_BUTTON_GAP = 16; // desired breathing room between a nav button and the book's edge
const NAV_BUTTON_MIN_OFFSET = 8; // falls back to near the stage's own edge once the book fills the width

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
  pageCount: knownPageCount,
  title,
  themeColor,
  headerColor = themeColor,
  headerTextColor = "#ffffff",
  backgroundImageUrl,
  backgroundFit = "contain",
  backgroundPosition = "center",
  logoUrl,
  logoLinkUrl,
  showToolbar,
  showTitle = true,
  allowDownload,
  allowPrint,
  showFullscreen = true,
  showPageArrows = true,
  enableZoom = true,
  startPage = 1,
  onPageView,
  onLinkClick,
}: {
  pdfUrl: string;
  /** Known up front for our own flipbooks; read from the PDF itself when not given. */
  pageCount?: number;
  title: string;
  /** The background colour. */
  themeColor: string;
  headerColor?: string;
  headerTextColor?: string;
  backgroundImageUrl?: string | null;
  backgroundFit?: "contain" | "cover";
  backgroundPosition?: string;
  logoUrl?: string | null;
  logoLinkUrl?: string | null;
  showToolbar: boolean;
  showTitle?: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
  showFullscreen?: boolean;
  showPageArrows?: boolean;
  enableZoom?: boolean;
  /** 1-based. */
  startPage?: number;
  /** Called with a 1-based page number each time a page is shown, including the first. */
  onPageView?: (pageNumber: number, pageCount: number) => void;
  onLinkClick?: (pageNumber: number, url: string) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  // The 0-based page the book opens on; fixed once the PDF loads (react-pageflip reads it once).
  const [initialPage, setInitialPage] = useState(0);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [pageAspect, setPageAspect] = useState(DEFAULT_PAGE_ASPECT);
  const [wrapperWidth, setWrapperWidth] = useState<number | null>(null);
  const [stageMetrics, setStageMetrics] = useState<{ availW: number; paddingLeft: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState<{
    pageNumber: number;
    sourceRect: { left: number; top: number; width: number; height: number };
    focus: { xPct: number; yPct: number };
  } | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
  const zoomOpenRef = useRef(false);
  useEffect(() => {
    zoomOpenRef.current = zoom !== null;
  }, [zoom]);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flipBookRef = useRef<{ pageFlip: () => PageFlipController } | null>(null);
  const pageCount = knownPageCount || doc?.numPages || 0;
  // Callers usually pass fresh closures each render; a ref keeps the effects below from re-running.
  const onPageViewRef = useRef(onPageView);
  useEffect(() => {
    onPageViewRef.current = onPageView;
  }, [onPageView]);

  useEffect(() => {
    let cancelled = false;
    loadPdf(pdfUrl)
      .then((loaded) => {
        if (cancelled) return;
        const first = Math.min(Math.max(startPage - 1, 0), Math.max((knownPageCount || loaded.numPages) - 1, 0));
        setDoc(loaded);
        setInitialPage(first);
        setCurrentPage(first);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load this PDF. The link may have expired — try reloading the page.");
      });
    return () => {
      cancelled = true;
    };
    // startPage and the page count only matter for the first page shown, when the PDF arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // clientWidth/clientHeight include this element's own padding, but the book itself is an
      // unconstrained child that will happily grow to fill that entire box — so left unadjusted,
      // it renders straight through the padding instead of leaving it as visible breathing room.
      const style = getComputedStyle(el!);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availW = el!.clientWidth - paddingX;
      const availH = el!.clientHeight - paddingY;
      if (availW <= 0 || availH <= 0) return;
      // Assumes a two-page landscape spread (the common case); on narrow screens the library
      // falls back to single-page portrait mode on its own once the width is small enough.
      const widthLimitedByHeight = availH * pageAspect * 2;
      const newWrapperWidth = Math.max(1, Math.min(availW, widthLimitedByHeight));
      setWrapperWidth(newWrapperWidth);
      setStageMetrics({ availW, paddingLeft: parseFloat(style.paddingLeft) });
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

  // Tap (touch) / click (mouse) to zoom. Attached as native listeners (not React
  // synthetic handlers) directly on the stage, in the capture phase — react-pageflip reparents
  // page nodes internally for its flip animation, so a per-page React handler can't reliably win
  // the propagation race against its own native listeners, but this real DOM ancestor is
  // guaranteed to see the event first.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    // Returns whether a page was found at this point (and zoom opened).
    function zoomAtPoint(x: number, y: number) {
      if (!enableZoom) return false;
      // react-pageflip overlays its own decorative siblings (e.g. a shadow div) on top of the
      // actual page content, so the literal event target often isn't a descendant of our page
      // element — check the whole stack of elements at this point instead.
      const pageEl = document
        .elementsFromPoint(x, y)
        .map((node) => node.closest<HTMLElement>("[data-page-number]"))
        .find((node): node is HTMLElement => node !== null);
      if (!pageEl) return false;

      // The rendered canvas is the page as actually seen (the slot around it can letterbox it).
      const canvas = pageEl.querySelector("canvas");
      const rect = (canvas && canvas.width > 0 ? canvas : pageEl).getBoundingClientRect();
      setZoom({
        pageNumber: Number(pageEl.dataset.pageNumber),
        sourceRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        focus: {
          xPct: ((x - rect.left) / rect.width) * 100,
          yPct: ((y - rect.top) / rect.height) * 100,
        },
      });
      return true;
    }

    // Touch: a quick, still, single-finger tap on a page zooms. react-pageflip only treats a touch
    // as a press once it's been held for its 250ms swipe window, so a tap shorter than that never
    // turns the page (not even in a corner) and swipes are left entirely to it.
    let touchStartAt: { x: number; y: number; time: number } | null = null;

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      touchStartAt =
        touch && e.touches.length === 1 && !zoomOpenRef.current ? { x: touch.clientX, y: touch.clientY, time: Date.now() } : null;
    }

    function handleTouchEnd(e: TouchEvent) {
      const start = touchStartAt;
      touchStartAt = null;
      const touch = e.changedTouches[0];
      if (!start || !touch || zoomOpenRef.current) return;
      if (Date.now() - start.time > 250 || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return;
      if ((e.target as HTMLElement | null)?.closest("a[href], button")) return;
      // preventDefault also cancels the tap's trailing click, which would otherwise land on (and
      // immediately close) the zoom view that's just opened under the finger.
      if (zoomAtPoint(touch.clientX, touch.clientY)) e.preventDefault();
    }

    // Mouse: a single click on a page zooms. react-pageflip would otherwise still turn the page
    // on clicks in its (large) corner hotspots even with disableFlipByClick, and on mouse drags,
    // so its mouse handling is kept out of the way entirely; it registers touch separately, so
    // touch swiping is unaffected. Only real mouse clicks count — a tap also fires a click
    // afterwards, which shouldn't zoom.
    let mouseDownAt: { x: number; y: number } | null = null;

    function handlePointerDown(e: PointerEvent) {
      mouseDownAt = e.pointerType === "mouse" && e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    }

    function handleMouseDown(e: MouseEvent) {
      e.stopPropagation();
    }

    function handleClick(e: MouseEvent) {
      const downAt = mouseDownAt;
      mouseDownAt = null;
      if (!downAt || zoomOpenRef.current || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
      if ((e.target as HTMLElement | null)?.closest("a[href], button")) return;
      zoomAtPoint(e.clientX, e.clientY);
    }

    el.addEventListener("touchstart", handleTouchStart, { capture: true });
    el.addEventListener("touchend", handleTouchEnd, { capture: true });
    el.addEventListener("pointerdown", handlePointerDown, { capture: true });
    el.addEventListener("mousedown", handleMouseDown, { capture: true });
    el.addEventListener("click", handleClick, { capture: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart, { capture: true });
      el.removeEventListener("touchend", handleTouchEnd, { capture: true });
      el.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      el.removeEventListener("mousedown", handleMouseDown, { capture: true });
      el.removeEventListener("click", handleClick, { capture: true });
    };
  }, [enableZoom]);

  // Record the opening page as viewed once the book is ready — onFlip only fires on later
  // flips, so without this the page-engagement funnel would never show anyone reaching page 1.
  const recordedInitialPageRef = useRef(false);
  useEffect(() => {
    if (recordedInitialPageRef.current || doc === null || wrapperWidth === null || !onPageViewRef.current) return;
    recordedInitialPageRef.current = true;
    onPageViewRef.current(currentPage + 1, pageCount);
  }, [doc, wrapperWidth, currentPage, pageCount]);

  // Left/right arrow keys flip pages, unless the user is typing somewhere (e.g. the password
  // form on a private flipbook, or — for an embed — some other field on the host page).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      // While zoomed in, arrow keys scroll the zoomed page instead of flipping the book behind it.
      if (zoomOpenRef.current) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        flipBookRef.current?.pageFlip()?.flipPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        flipBookRef.current?.pageFlip()?.flipNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      rootRef.current?.requestFullscreen();
    }
  }

  const pages = useMemo(() => {
    if (!doc) return [];
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }, [doc, pageCount]);

  const shift = orientation === "landscape" ? coverShiftDirection(currentPage, pageCount) : null;
  const flipBookStyle: React.CSSProperties = {
    transition: "transform 300ms ease",
    transform: shift === "left" ? "translateX(-25%) translateZ(0)" : shift === "right" ? "translateX(25%) translateZ(0)" : "translateZ(0)",
  };

  // Nav buttons sit just outside the visible document's edge rather than the stage's. A lone
  // cover/back page only fills half of react-pageflip's two-page slot (centered by the shift
  // above), so the visible width halves there. Clamped toward the stage edge once the document
  // fills the width, e.g. on mobile.
  const visibleBookWidth = wrapperWidth === null ? 0 : shift ? wrapperWidth / 2 : wrapperWidth;
  const navButtonOffset = stageMetrics
    ? Math.max(
        NAV_BUTTON_MIN_OFFSET,
        stageMetrics.paddingLeft + (stageMetrics.availW - visibleBookWidth) / 2 - NAV_BUTTON_SIZE - NAV_BUTTON_GAP
      )
    : NAV_BUTTON_MIN_OFFSET;

  // Download and print use the PDF bytes already loaded, as a same-origin blob: the PDF usually
  // lives on another domain (R2, or an external project's storage), where the browser ignores a
  // link's download attribute and would just navigate to it instead.
  async function pdfBlobUrl() {
    const data = await doc!.getData();
    return URL.createObjectURL(new Blob([data as BlobPart], { type: "application/pdf" }));
  }

  async function handleDownload() {
    if (!doc) return;
    const url = await pdfBlobUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "document").replace(/[\\/:*?"<>|]+/g, " ").trim() || "document"}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function handlePrint() {
    if (!doc) return;
    // Phones can't print a PDF from inside a page, so they get it in a new tab to print or share
    // from there — opened before the await so popup blockers still see it as part of the tap.
    if (window.matchMedia("(pointer: coarse)").matches) {
      const win = window.open("", "_blank");
      if (win) win.location.href = await pdfBlobUrl();
      return;
    }
    const url = await pdfBlobUrl();
    document.getElementById("flipbook-print-frame")?.remove();
    const frame = document.createElement("iframe");
    frame.id = "flipbook-print-frame";
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(url, "_blank");
      }
    };
    frame.src = url;
    document.body.appendChild(frame);
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

  // Stay on a plain white background until the book is actually ready to paint — themeColor,
  // the toolbar, and the logo only appear once, avoiding a flash of color before there's
  // anything on top of it.
  const isReady = doc !== null && wrapperWidth !== null;

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-0 w-full flex-col items-center gap-2"
      style={
        isReady
          ? {
              backgroundColor: themeColor,
              backgroundImage: backgroundImageUrl ? cssUrl(backgroundImageUrl) : undefined,
              backgroundSize: backgroundFit,
              backgroundPosition,
              backgroundRepeat: "no-repeat",
            }
          : { backgroundColor: "#ffffff" }
      }
    >
      {showToolbar && isReady && (
        <div
          className={`flex w-full shrink-0 items-center justify-end px-4 py-3 text-sm ${showTitle ? "sm:justify-between" : ""}`}
          style={{ backgroundColor: headerColor, color: headerTextColor }}
        >
          {showTitle && <span className="hidden truncate font-medium sm:inline">{title}</span>}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
                disabled={atFirstPage || zoom !== null}
                aria-label="Previous page"
                className="flex h-7 w-7 items-center justify-center rounded bg-current/10 hover:bg-current/20 disabled:opacity-30"
              >
                <IconChevronLeft size={15} />
              </button>
              <span className="px-1 tabular-nums opacity-60">
                {currentPage + 1} / {pageCount}
              </span>
              <button
                onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
                disabled={atLastPage || zoom !== null}
                aria-label="Next page"
                className="flex h-7 w-7 items-center justify-center rounded bg-current/10 hover:bg-current/20 disabled:opacity-30"
              >
                <IconChevronRight size={15} />
              </button>
            </div>
            {allowPrint && (
              <button
                onClick={handlePrint}
                aria-label="Print"
                className="flex h-7 items-center gap-1.5 rounded bg-current/10 px-2.5 hover:bg-current/20"
              >
                <IconPrint size={15} />
                <span className="hidden sm:inline">Print</span>
              </button>
            )}
            {allowDownload && (
              <button
                onClick={handleDownload}
                aria-label="Download"
                className="flex h-7 items-center gap-1.5 rounded bg-current/10 px-2.5 hover:bg-current/20"
              >
                <IconDownload size={15} />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
            {showFullscreen && (
              <button
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className="flex h-7 items-center gap-1.5 rounded bg-current/10 px-2.5 hover:bg-current/20"
              >
                <IconFullscreen size={15} />
                <span className="hidden sm:inline">{isFullscreen ? "Exit full screen" : "Full screen"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={stageRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center touch-manipulation overflow-hidden px-6 py-6 sm:px-12 sm:py-10">
        {!isReady && <p className="text-sm text-gray-400">Loading flipbook…</p>}

        {isReady && (
          <>
            {showPageArrows && (
            <>
            <button
              onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
              disabled={atFirstPage}
              aria-label="Previous page"
              style={{ left: navButtonOffset }}
              className={`absolute z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/40 text-white shadow-sm backdrop-blur-sm transition-[left,right,background-color,opacity] duration-300 hover:bg-gray-900/60 disabled:opacity-0 ${zoom ? "pointer-events-none opacity-0" : ""}`}
            >
              <IconChevronLeft size={20} />
            </button>
            <button
              onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
              disabled={atLastPage}
              aria-label="Next page"
              style={{ right: navButtonOffset }}
              className={`absolute z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/40 text-white shadow-sm backdrop-blur-sm transition-[left,right,background-color,opacity] duration-300 hover:bg-gray-900/60 disabled:opacity-0 ${zoom ? "pointer-events-none opacity-0" : ""}`}
            >
              <IconChevronRight size={20} />
            </button>
            </>
            )}

            <div
              style={{
                width: wrapperWidth,
                maxWidth: "100%",
                // While zoomed, the book fades out under the zoomed page and back in as it closes.
                opacity: zoom && !zoomClosing ? 0 : 1,
                transition: `opacity ${ZOOM_DURATION_MS}ms ease`,
                pointerEvents: zoom ? "none" : undefined,
              }}
            >
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
                startPage={initialPage}
                drawShadow={true}
                flippingTime={500}
                usePortrait={true}
                startZIndex={0}
                autoSize={true}
                clickEventForward={true}
                useMouseEvents={true}
                swipeDistance={30}
                showPageCorners={false}
                disableFlipByClick={true}
                onFlip={(e: { data: number }) => {
                  setCurrentPage(e.data);
                  onPageViewRef.current?.(e.data + 1, pageCount);
                }}
                onInit={(e: { data: { mode: "portrait" | "landscape" } }) => setOrientation(e.data.mode)}
                onChangeOrientation={(e: { data: "portrait" | "landscape" }) => setOrientation(e.data)}
              >
                {pages.map((pageNumber) => (
                  <div key={pageNumber} className="bg-white">
                    <PdfPage
                      doc={doc!}
                      pageNumber={pageNumber}
                      shouldRender={Math.abs(pageNumber - 1 - currentPage) <= RENDER_WINDOW}
                      zoomable={enableZoom}
                      onLinkClick={onLinkClick}
                    />
                  </div>
                ))}
              </HTMLFlipBook>
            </div>
          </>
        )}

        {zoom && doc && (
          <PdfZoomOverlay
            doc={doc}
            pageNumber={zoom.pageNumber}
            sourceRect={zoom.sourceRect}
            focus={zoom.focus}
            onCloseStart={() => setZoomClosing(true)}
            onClosed={() => {
              setZoom(null);
              setZoomClosing(false);
            }}
          />
        )}
      </div>

      {isReady && logoUrl && (
        <div className="absolute bottom-3 left-3 z-10">
          {logoLinkUrl ? (
            <a href={logoLinkUrl} target="_blank" rel="noopener noreferrer">
              <Image src={logoUrl} alt="" width={280} height={80} unoptimized className="h-16 w-auto max-w-[220px] object-contain drop-shadow sm:h-20 sm:max-w-[280px]" />
            </a>
          ) : (
            <Image src={logoUrl} alt="" width={280} height={80} unoptimized className="h-16 w-auto max-w-[220px] object-contain drop-shadow sm:h-20 sm:max-w-[280px]" />
          )}
        </div>
      )}
    </div>
  );
}
