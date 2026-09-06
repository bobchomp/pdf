"use client";

import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
}

export async function loadPdf(source: string | ArrayBuffer) {
  ensureWorker();
  const loadingTask = pdfjsLib.getDocument(typeof source === "string" ? { url: source } : { data: source });
  return loadingTask.promise;
}

export async function renderPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.2
) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}

export async function renderPageToDataUrl(doc: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale = 1.2) {
  const canvas = document.createElement("canvas");
  await renderPageToCanvas(doc, pageNumber, canvas, scale);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export type PdfPageLink = {
  url: string;
  /** Position and size as a percentage of the page, so it stays correct at any render scale. */
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

/**
 * Hyperlinks embedded in the PDF itself (e.g. from Word/Canva/InDesign export) as annotation
 * data, converted to percentage-based boxes. Pages are rendered as flat canvas images, which
 * strips away clickability entirely, so the viewer overlays these as real <a> elements instead.
 * Internal-only links (jump to another page in the same PDF, no external URL) are skipped.
 */
export async function getPageLinks(doc: pdfjsLib.PDFDocumentProxy, pageNumber: number): Promise<PdfPageLink[]> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const annotations = await page.getAnnotations({ intent: "display" });

  const links: PdfPageLink[] = [];
  for (const annotation of annotations) {
    if (annotation.subtype !== "Link") continue;
    const url: string | undefined = annotation.url || annotation.unsafeUrl;
    if (!url || !Array.isArray(annotation.rect)) continue;

    const [rx1, ry1, rx2, ry2] = annotation.rect as [number, number, number, number];
    const [vx1, vy1] = viewport.convertToViewportPoint(rx1, ry1);
    const [vx2, vy2] = viewport.convertToViewportPoint(rx2, ry2);
    const left = Math.min(vx1, vx2);
    const top = Math.min(vy1, vy2);
    const width = Math.abs(vx2 - vx1);
    const height = Math.abs(vy2 - vy1);

    links.push({
      url,
      leftPct: (left / viewport.width) * 100,
      topPct: (top / viewport.height) * 100,
      widthPct: (width / viewport.width) * 100,
      heightPct: (height / viewport.height) * 100,
    });
  }
  return links;
}
