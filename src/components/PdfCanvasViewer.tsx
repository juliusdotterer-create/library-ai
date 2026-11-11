import { canvasRatio, maxCanvasPixels } from "@/lib/canvas-budget";
import { PdfFailureView } from "@/components/pdf/PdfFailureView";
import { classifyPdfError, type PdfFailure } from "@/lib/pdf-errors";
import { useCallback, useEffect, useRef, useState } from "react";
import { findHighlights, highlightTokens } from "@/lib/pdf-highlight";
import { detectTimetableDay, readTodayCache, writeTodayCache, type DayRegion, type TimetableText } from "@/lib/timetable-today";
import CompatiblePdfWorker from "@/lib/pdf-compat.worker?worker";
import { PageNavigation } from "@/components/pdf/PageNavigation";
import { usePdfPageNavigation } from "@/hooks/usePdfPageNavigation";

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
  todayCacheKey,
  rotation = 0,
}: {
  url: string;
  initialPage?: number | null;
  highlight?: string | null;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  centered?: boolean;
  alignLeft?: boolean;
  todayDate?: string;
  onTodayDetection?: (result: "found" | "absent" | "unreadable" | "error", dateKey?: string) => void;
  /** Stable document key; caches the date search per day so it runs once. */
  todayCacheKey?: string;
  /** Seitendrehung in Grad (0/90/180/270). */
  rotation?: number;
}) {
  const lockHorizontal = centered || alignLeft;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const onTodayDetectionRef = useRef(onTodayDetection);
  const positionedDayRef = useRef<string | null>(null);
  const pendingAnchorRef = useRef<{ x: number; y: number; previousZoom: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [failure, setFailure] = useState<PdfFailure>("error");
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [pages, setPages] = useState(0);
  const [renderedPages, setRenderedPages] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const navigation = usePdfPageNavigation(viewportRef, renderedPages, `${zoom}:${rotation}`);

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
    setRenderedPages(0);
    setStatus("loading");

    void (async () => {
      try {
        await import("@/lib/map-upsert-polyfill");
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        worker = new CompatiblePdfWorker();
        const task = pdfjs.getDocument({ url, password, worker: pdfjs.PDFWorker.create({ port: worker }) });
        loadingTask = task;
        const doc = await task.promise;
        if (cancelled) return;
        setPages(doc.numPages);

        const width = Math.max(1, viewportWidth - (lockHorizontal ? 16 : 0)) * zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const tokens = highlightTokens(highlight ?? "");
        let hasDates = false;
        const candidates = todayDate ? [todayDate] : [];
        const cached = todayDate && todayCacheKey ? readTodayCache(window.localStorage, todayCacheKey, todayDate) : null;
        if (cached) hasDates = cached.status !== "unreadable";
        const pages: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; ratio: number; byDay: Map<string, DayRegion[]> }[] = [];

        // Gesamtbudget über alle Seiten, damit mobiles Safari nicht abstürzt
        const budget = maxCanvasPixels();
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1, rotation });
          const scale = width / base.width;
          const perPage = Math.max(1_000_000, (budget * 4) / doc.numPages);
          const ratio = canvasRatio(width, base.height * scale, dpr, Math.min(budget, perPage));
          const viewport = page.getViewport({ scale: scale * ratio, rotation });

          const canvas = document.createElement("canvas");
          canvas.dataset.page = String(i);
          canvas.classList.add("doc-page");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
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
          setRenderedPages(i);

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

          if (todayDate && cached) {
            const byDay = new Map<string, DayRegion[]>();
            if (cached.pages[i]?.length) byDay.set(todayDate, cached.pages[i]);
            pages.push({ canvas, ctx, ratio: scale * ratio, byDay });
          } else if (todayDate) {
            const content = await page.getTextContent();
            if (cancelled) return;
            const textItems: TimetableText[] = [];
            for (const item of content.items) {
              if (!("str" in item)) continue;
              const matrix = pdfjs.Util.transform(base.transform, item.transform);
              const textHeight = Math.hypot(matrix[2], matrix[3]);
              textItems.push({ text: item.str, x: matrix[4], y: matrix[5] - textHeight, width: item.width, height: textHeight });
            }
            const byDay = new Map<string, DayRegion[]>();
            for (const key of candidates) {
              const result = detectTimetableDay(textItems, base.width, base.height, key);
              hasDates ||= result.hasDates;
              if (result.regions.length) byDay.set(key, result.regions);
            }
            pages.push({ canvas, ctx, ratio: scale * ratio, byDay });
          }

          if (i === 1) setStatus("ready");
          if (initialPage && i === initialPage) {
            canvas.scrollIntoView({ block: "start" });
          }
        }
        setStatus("ready");
        if (todayDate) {
          const hit = candidates.find(k => pages.some(p => p.byDay.has(k)));
          if (!cached && todayCacheKey) {
            const stored: Record<number, DayRegion[]> = {};
            pages.forEach((p, n) => { const r = p.byDay.get(todayDate); if (r) stored[n + 1] = r; });
            writeTodayCache(window.localStorage, todayCacheKey, todayDate, { status: hit ? "found" : hasDates ? "absent" : "unreadable", pages: stored });
          }
          if (hit) {
            const color = getComputedStyle(viewportRef.current ?? container).getPropertyValue("--primary").trim();
            for (const p of pages) {
              const regions = p.byDay.get(hit);
              if (!regions) continue;
              p.canvas.dataset.today = hit;
              p.ctx.save();
              p.ctx.fillStyle = color; p.ctx.strokeStyle = color; p.ctx.lineWidth = 2 * dpr;
              for (const r of regions) {
                p.ctx.globalAlpha = .14; p.ctx.fillRect(r.x * p.ratio, r.y * p.ratio, r.width * p.ratio, r.height * p.ratio);
                p.ctx.globalAlpha = .85; p.ctx.strokeRect(r.x * p.ratio, r.y * p.ratio, r.width * p.ratio, r.height * p.ratio);
              }
              p.ctx.restore();
            }
          }
          const positionKey = `${url}:${todayDate}`;
          const viewport = viewportRef.current;
          if (viewport && positionedDayRef.current !== positionKey) {
            const targetPage = hit ? pages.find(p => p.byDay.has(hit)) : undefined;
            const region = hit ? targetPage?.byDay.get(hit)?.[0] : undefined;
            if (targetPage && region) {
              const pageTop = targetPage.canvas.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
              viewport.scrollTo({ top: Math.max(0, pageTop + region.y * targetPage.ratio * (parseFloat(targetPage.canvas.style.width) / targetPage.canvas.width) - 24), left: 0, behavior: "instant" });
            } else {
              viewport.scrollTo({ top: 0, left: 0, behavior: "instant" });
            }
            positionedDayRef.current = positionKey;
            pendingAnchorRef.current = null;
          }
          onTodayDetectionRef.current?.(hit ? "found" : hasDates ? "absent" : "unreadable", hit);
        }
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
          setFailure(classifyPdfError(error));
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
  }, [url, initialPage, highlight, viewportWidth, zoom, centered, alignLeft, lockHorizontal, todayDate, todayCacheKey, password, rotation]);

  return (
    <div className="relative size-full min-h-0">
    <div
      ref={viewportRef}
      className={`relative size-full overscroll-contain p-2 ${!todayDate ? "pb-24" : ""} ${lockHorizontal ? "overflow-x-hidden overflow-y-auto" : "overflow-auto"}`}
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
        <PdfFailureView failure={failure} onPassword={setPassword} />
      )}
      {status === "ready" && pages > 0 && (
        <p className="min-w-full pb-2 text-center text-xs text-muted-foreground">{pages} Seiten</p>
      )}
    </div>
    {!todayDate && status === "ready" && renderedPages === pages && (
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex w-full max-w-xl justify-center">
          <PageNavigation page={navigation.page} total={pages} onJump={navigation.jump} onScrub={navigation.scrub} />
        </div>
      </div>
    )}
    </div>
  );
}
