/**
 * Texterkennung (OCR) für gescannte PDFs — läuft komplett im Browser.
 *
 * pdf.js rendert jede Seite auf ein Canvas, Tesseract erkennt darauf den Text.
 * Bewusst nur auf Anforderung starten: OCR ist deutlich langsamer als das
 * Auslesen einer vorhandenen Textebene.
 */

export type OcrResult = {
  pages: string[];
  content: string;
  pageCount: number;
  status: "done" | "unsupported";
};

/** Auflösung der gerenderten Seite – Kompromiss aus Genauigkeit und Tempo. */
const TARGET_WIDTH = 1500;
const MAX_CHARS = 400_000;

const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

let workerPromise: Promise<any> | null = null;

/** Tesseract-Worker (deu+eng) wird nur einmal geladen und wiederverwendet. */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then((m) => m.createWorker(["deu", "eng"]));
  }
  return workerPromise;
}

/** Gibt den geladenen OCR-Worker wieder frei. */
export async function releaseOcrWorker() {
  const p = workerPromise;
  workerPromise = null;
  if (!p) return;
  try {
    const worker = await p;
    await worker.terminate();
  } catch {
    /* egal – der Worker wird ohnehin verworfen */
  }
}

export async function ocrPdf(
  source: Blob,
  options: {
    maxPages?: number;
    signal?: { aborted: boolean };
    onPage?: (page: number, total: number) => void;
  } = {},
): Promise<OcrResult> {
  await import("@/lib/map-upsert-polyfill");
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await source.arrayBuffer()) }).promise;
  const pageCount = doc.numPages;
  const limit = Math.min(pageCount, Math.max(options.maxPages ?? 50, 1));
  const worker = await getWorker();

  const pages: string[] = [];
  let total = 0;

  for (let i = 1; i <= limit; i++) {
    if (options.signal?.aborted || total >= MAX_CHARS) {
      pages.push("");
      continue;
    }
    try {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(TARGET_WIDTH / base.width, 3) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas nicht verfügbar");
      await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;

      const { data } = await worker.recognize(canvas);
      const text = clean(String(data?.text ?? ""));
      pages.push(text.slice(0, Math.max(MAX_CHARS - total, 0)));
      total += text.length;

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    } catch {
      pages.push("");
    }
    options.onPage?.(i, limit);
  }

  void (doc as unknown as { destroy?: () => Promise<void> }).destroy?.();

  const content = pages.join("\n\n").trim();
  return {
    pages,
    content,
    pageCount,
    status: content.length < 20 ? "unsupported" : "done",
  };
}
