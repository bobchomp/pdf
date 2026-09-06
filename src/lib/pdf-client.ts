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
