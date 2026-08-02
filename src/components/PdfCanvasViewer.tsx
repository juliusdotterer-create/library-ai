import { useEffect, useRef, useState } from "react";

/**
 * Renders every page of a PDF into canvases (scrollable).
 * Used on mobile where <iframe> only shows the first page.
 */
export function PdfCanvasViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setStatus("loading");

    void (async () => {
      try {
        await import("@/lib/map-upsert-polyfill");
        const pdfjs = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setPages(doc.numPages);

        const width = container.clientWidth || 360;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.borderRadius = "12px";
          canvas.style.marginBottom = "10px";
          canvas.style.background = "#fff";
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          if (i === 1) setStatus("ready");
        }
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="size-full overflow-y-auto p-2">
      {status === "loading" && (
        <p className="py-8 text-center text-sm text-muted-foreground">PDF wird geladen…</p>
      )}
      {status === "error" && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          PDF konnte nicht angezeigt werden.
        </p>
      )}
      <div ref={containerRef} />
      {status === "ready" && pages > 0 && (
        <p className="pb-2 text-center text-xs text-muted-foreground">{pages} Seiten</p>
      )}
    </div>
  );
}
