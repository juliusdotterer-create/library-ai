import { useCallback, useEffect, useRef, useState } from "react";
import { findHighlights, highlightTokens } from "@/lib/pdf-highlight";
import { detectTimetableDay, type TimetableText } from "@/lib/timetable-today";
import CompatiblePdfWorker from "@/lib/pdf-compat.worker?worker";

export const PDF_MIN_ZOOM = 0.5;
export const PDF_MAX_ZOOM = 4;

const clampZoom = (value: number) => Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, value));

/**
 * Renders every page of a PDF into canvases (scrollable).
 * Used on mobile where <iframe> only shows the first page.
 */
export function PdfCanvasViewer({
  url,
  initialPage,
  highlight,
  zoom = 1,
  onZoomChange,
  centered = false,
  alignLeft = false,
  todayDate,
  onTodayDetection,
}: {
  url: string;
  initialPage?: number | null;
  highlight?: string | null;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  centered?: boolean;
  alignLeft?: boolean;
  todayDate?: string;
  onTodayDetection?: (result: "found" | "absent" | "unreadable" | "error") => void;
}) {
  const lockHorizontal = centered || alignLeft;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const onTodayDetectionRef = useRef(onTodayDetection);
  const pendingAnchorRef = useRef<{ x: number; y: number; previousZoom: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  zoomRef.current = zoom;
  onZoomChangeRef.current = onZoomChange;
  onTodayDetectionRef.current = onTodayDetection;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setViewportWidth(viewport.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback((nextValue: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    const next = clampZoom(nextValue);
    if (!viewport || Math.abs(next - zoomRef.current) < 0.001) return;
    const rect = viewport.getBoundingClientRect();
    pendingAnchorRef.current = {
      x: (clientX ?? rect.left + rect.width / 2) - rect.left,
      y: (clientY ?? rect.top + rect.height / 2) - rect.top,
      previousZoom: zoomRef.current,
    };
    onZoomChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      zoomAt(zoomRef.current * Math.exp(-dy * 0.0015), event.clientX, event.clientY);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !onZoomChange) return;
    let pinch: { distance: number; zoom: number } | null = null;
    const distance = (touches: TouchList) => Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      pinch = { distance: distance(event.touches), zoom: zoomRef.current };
    };
    const onMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      if (pinch.distance > 0) {
        zoomAt(pinch.zoom * distance(event.touches) / pinch.distance);
      }
    };
    const onEnd = () => { pinch = null; };
    viewport.addEventListener("touchstart", onStart, { passive: false });
    viewport.addEventListener("touchmove", onMove, { passive: false });
    viewport.addEventListener("touchend", onEnd);
    viewport.addEventListener("touchcancel", onEnd);
    return () => {
      viewport.removeEventListener("touchstart", onStart);
      viewport.removeEventListener("touchmove", onMove);
      viewport.removeEventListener("touchend", onEnd);
      viewport.removeEventListener("touchcancel", onEnd);
    };
  }, [onZoomChange, zoomAt]);

  useEffect(() => {
    let cancelled = false;
    const container = pagesRef.current;
    if (!container || !viewportWidth) return;
    let worker: Worker | undefined;
    let loadingTask: { destroy: () => Promise<void> } | undefined;
    container.replaceChildren();
    setStatus("loading");

    void (async () => {
      try {
        await import("@/lib/map-upsert-polyfill");
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        worker = new CompatiblePdfWorker();
        const task = pdfjs.getDocument({ url, worker: pdfjs.PDFWorker.create({ port: worker }) });
        loadingTask = task;
        const doc = await task.promise;
        if (cancelled) return;
        setPages(doc.numPages);

        const width = Math.max(1, viewportWidth - (lockHorizontal ? 16 : 0)) * zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const tokens = highlightTokens(highlight ?? "");
        let foundToday = false;
        let hasDates = false;

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${width}px`;
          canvas.style.height = "auto";
          canvas.style.display = "block";
          if (centered && !alignLeft) {
            canvas.style.position = "relative";
            canvas.style.left = "50%";
            canvas.style.transform = "translateX(-50%)";
          }
          canvas.style.borderRadius = "12px";
          canvas.style.marginBottom = "10px";
          canvas.style.background = "#fff";
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          if (cancelled) return;

          if (tokens.length) {
            const rects = await findHighlights(page, viewport as never, tokens);
            if (cancelled) return;
            if (rects.length) {
              ctx.save();
              ctx.globalCompositeOperation = "multiply";
              ctx.fillStyle = "rgba(250, 204, 21, 0.45)";
              for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
              ctx.restore();
            }
          }

          if (todayDate) {
            const content = await page.getTextContent();
            if (cancelled) return;
            const textItems: TimetableText[] = [];
            for (const item of content.items) {
              if (!("str" in item)) continue;
              const matrix = pdfjs.Util.transform(base.transform, item.transform);
              const textHeight = Math.hypot(matrix[2], matrix[3]);
              textItems.push({ text: item.str, x: matrix[4], y: matrix[5] - textHeight, width: item.width, height: textHeight });
            }
            const result = detectTimetableDay(textItems, base.width, base.height, todayDate);
            hasDates ||= result.hasDates;
            foundToday ||= result.regions.length > 0;
            if (result.regions.length) {
              canvas.dataset.today = todayDate;
              const color = getComputedStyle(viewportRef.current ?? container).getPropertyValue("--primary").trim();
              ctx.save();
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.lineWidth = 2 * dpr;
              for (const region of result.regions) {
                const ratio = scale * dpr;
                ctx.globalAlpha = .14;
                ctx.fillRect(region.x * ratio, region.y * ratio, region.width * ratio, region.height * ratio);
                ctx.globalAlpha = .85;
                ctx.strokeRect(region.x * ratio, region.y * ratio, region.width * ratio, region.height * ratio);
              }
              ctx.restore();
            }
          }

          if (i === 1) setStatus("ready");
          if (initialPage && i === initialPage) {
            canvas.scrollIntoView({ block: "start" });
          }
        }
        setStatus("ready");
        if (todayDate) onTodayDetectionRef.current?.(foundToday ? "found" : hasDates ? "absent" : "unreadable");
        const anchor = pendingAnchorRef.current;
        const viewport = viewportRef.current;
        if (anchor && viewport && anchor.previousZoom > 0) {
          const factor = zoom / anchor.previousZoom;
          viewport.scrollLeft = lockHorizontal ? 0 : (viewport.scrollLeft + anchor.x) * factor - anchor.x;
          viewport.scrollTop = (viewport.scrollTop + anchor.y) * factor - anchor.y;
          pendingAnchorRef.current = null;
        }
      } catch (error) {
        if (!cancelled) {
          console.error("PDF rendering failed", error);
          setStatus("error");
          if (todayDate) onTodayDetectionRef.current?.("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy().catch(() => undefined);
      worker?.terminate();
    };
  }, [url, initialPage, highlight, viewportWidth, zoom, centered, alignLeft, lockHorizontal, todayDate]);

  return (
    <div
      ref={viewportRef}
      className={`relative size-full overscroll-contain p-2 ${lockHorizontal ? "overflow-x-hidden overflow-y-auto" : "overflow-auto"}`}
      style={{ touchAction: onZoomChange ? "pan-y" : "pan-x pan-y" }}
      onScroll={lockHorizontal ? (event) => { event.currentTarget.scrollLeft = 0; } : undefined}
    >
      <div ref={pagesRef} className={lockHorizontal ? "w-full overflow-x-clip" : "mx-auto w-max min-w-full"} />
      {status === "loading" && (
        <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground">
          PDF wird geladen…
        </p>
      )}
      {status === "error" && (
        <p className="py-8 text-center text-sm text-muted-foreground">PDF konnte nicht angezeigt werden.</p>
      )}
      {status === "ready" && pages > 0 && (
        <p className="min-w-full pb-2 text-center text-xs text-muted-foreground">{pages} Seiten</p>
      )}
    </div>
  );
}
