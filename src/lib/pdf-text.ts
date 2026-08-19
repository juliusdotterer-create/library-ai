/**
 * Textextraktion aus PDFs (Browser, via pdfjs-dist).
 *
 * Wird nach dem Upload und beim Nachindexieren genutzt, damit die Library
 * nicht nur Dateinamen, sondern auch Inhalte durchsuchen kann.
 */

export type ExtractedText = {
  pages: string[];
  content: string;
  pageCount: number;
  status: "done" | "unsupported";
};

/** Obergrenzen, damit sehr große Dateien Browser und Datenbank nicht sprengen. */
const MAX_PAGES = 300;
const MAX_CHARS = 400_000;

export function isPdfFile(name: string, mime?: string | null) {
  return (mime ?? "") === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Liest den Text einer PDF (aus Blob oder URL) seitenweise aus. */
export async function extractPdfText(source: Blob | string): Promise<ExtractedText> {
  await import("@/lib/map-upsert-polyfill");
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const task =
    typeof source === "string"
      ? pdfjs.getDocument({ url: source })
      : pdfjs.getDocument({ data: new Uint8Array(await source.arrayBuffer()) });

  const doc = await task.promise;
  const pageCount = doc.numPages;
  const limit = Math.min(pageCount, MAX_PAGES);
  const pages: string[] = [];
  let total = 0;

  for (let i = 1; i <= limit; i++) {
    if (total >= MAX_CHARS) {
      pages.push("");
      continue;
    }
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = clean(
        content.items
          .map((item) => (typeof (item as { str?: unknown }).str === "string" ? (item as { str: string }).str : ""))
          .join(" "),
      );
      pages.push(text.slice(0, MAX_CHARS - total));
      total += text.length;
    } catch {
      pages.push("");
    }
  }

  void (doc as unknown as { destroy?: () => Promise<void> }).destroy?.();

  const content = pages.join("\n\n").trim();
  return {
    pages,
    content,
    pageCount,
    // Reine Scans ohne Textebene liefern (fast) nichts.
    status: content.length < 20 ? "unsupported" : "done",
  };
}

/** Führt Aufgaben mit begrenzter Parallelität aus (schont Upload-Bandbreite). */
export async function runQueue<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency = 2,
) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        await worker(items[index]!, index);
      } catch {
        /* Einzelfehler dürfen die Warteschlange nicht stoppen. */
      }
    }
  });
  await Promise.all(runners);
}
