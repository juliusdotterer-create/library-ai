import { PdfFailureView } from "@/components/pdf/PdfFailureView";
import { canvasRatio, deviceRatio, maxCanvasPixels } from "@/lib/canvas-budget";
import { classifyPdfError, markLocked, type PdfFailure } from "@/lib/pdf-errors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findHighlights, highlightTokens } from "@/lib/pdf-highlight";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AnnotationToolbar,
  MARKER_COLORS,
  MAX_ZOOM,
  MIN_ZOOM,
  PEN_COLORS,
  type Tool,
} from "@/components/pdf/AnnotationToolbar";
import {
  annoId,
  usePdfAnnotations,
  type Anno,
  type Note,
  type Stroke,
} from "@/hooks/usePdfAnnotations";

export type { Anno } from "@/hooks/usePdfAnnotations";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** PDF viewer with a transparent annotation layer per page. */
export function PdfAnnotator({
  url,
  documentId,
  initialPage,
  highlight,
  activeMatch,
  onMatchCount,
}: {
  url: string;
  documentId: string;
  initialPage?: number | null;
  highlight?: string | null;
  activeMatch?: number;
  onMatchCount?: (n: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const docRef = useRef<{ numPages: number; getPage: (n: number) => Promise<any> } | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const hlRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const overlayRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const penTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const prevTool = useRef<Tool>("pen");

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [failure, setFailure] = useState<PdfFailure>("error");
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [pages, setPages] = useState<{ w: number; h: number; scale: number }[]>([]);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hits, setHits] = useState<{ page: number; x: number; y: number; w: number; h: number }[]>(
    [],
  );

  const [tool, setTool] = useState<Tool>("none");
  const [markerColor, setMarkerColor] = useState(MARKER_COLORS[0]!);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]!);
  const [penWidth, setPenWidth] = useState(2);
  const [editNote, setEditNote] = useState<string | null>(null);

  const { annos, setAnnos, commit, undo, redo, canUndo, canRedo } = usePdfAnnotations(documentId);

  /* ---------------- measure container ---------------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setWidth((prev) => (Math.abs(prev - w) > 12 ? w : prev));
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /* ------- Sprung zur Trefferseite aus der Volltextsuche ------- */
  const jumpedTo = useRef<number | null>(null);
  useEffect(() => {
    if (!initialPage || status !== "ready" || jumpedTo.current === initialPage) return;
    const target = wrapRef.current?.querySelector(`[data-page="${initialPage}"]`);
    if (!target) return;
    jumpedTo.current = initialPage;
    target.scrollIntoView({ block: "start" });
  }, [initialPage, status, pages.length]);

  /* ---------------- load pdf ---------------- */
  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      try {
        await import("@/lib/map-upsert-polyfill");
        const pdfjs = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const doc = await pdfjs.getDocument({ url, password }).promise;
        if (cancelled) return;
        docRef.current = doc as never;
        const dims: { w: number; h: number; scale: number }[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          dims.push({ w: width, h: base.height * scale, scale });
        }
        if (cancelled) return;
        canvasRefs.current = [];
        overlayRefs.current = [];
        setPages(dims);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const f = classifyPdfError(err);
        if (f === "password" || f === "drm") markLocked(documentId, f);
        setFailure(f);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, width, password, documentId]);

  const view = useMemo(
    () => pages.map((p) => ({ w: p.w * zoom, h: p.h * zoom, scale: p.scale * zoom })),
    [pages, zoom],
  );

  /* ------- nur Seiten nahe dem Sichtbereich im Speicher halten ------- */
  const [visible, setVisible] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    const root = wrapRef.current;
    if (!root || status !== "ready" || view.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const n = Number((e.target as HTMLElement).dataset.page) - 1;
            if (e.isIntersecting) next.add(n);
            else next.delete(n);
          }
          return next;
        });
      },
      { root, rootMargin: "120% 0px" },
    );
    root.querySelectorAll("[data-page]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [status, view.length]);

  /* ---------------- render pages ---------------- */
  const renderedKey = useRef<(string | null)[]>([]);
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || view.length === 0) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const budget = maxCanvasPixels();
    const dpr = deviceRatio();
    // Seiten außerhalb des Bereichs freigeben
    for (let i = 0; i < view.length; i++) {
      if (visible.has(i)) continue;
      const canvas = canvasRefs.current[i];
      if (canvas && canvas.width) {
        canvas.width = 0;
        canvas.height = 0;
      }
      renderedKey.current[i] = null;
    }
    void (async () => {
      for (const i of [...visible].sort((a, b) => a - b)) {
        const canvas = canvasRefs.current[i];
        const dim = view[i];
        if (!canvas || !dim) continue;
        const ratio = canvasRatio(dim.w, dim.h, dpr, budget);
        const key = `${dim.scale}:${ratio}`;
        if (renderedKey.current[i] === key) continue;
        const page = await doc.getPage(i + 1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: dim.scale * ratio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        try {
          const t = page.render({ canvas, canvasContext: ctx, viewport });
          task = t;
          await t.promise;
          renderedKey.current[i] = key;
          page.cleanup?.();
        } catch {
          /* re-render race, ignore */
        }
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [view, visible]);

  /* ------- Trefferrechtecke der Volltextsuche (Basis-Koordinaten) ------- */
  useEffect(() => {
    const doc = docRef.current;
    const tokens = highlightTokens(highlight ?? "");
    if (!doc || status !== "ready" || !tokens.length) {
      setHits([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const found: { page: number; x: number; y: number; w: number; h: number }[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const rects = await findHighlights(page, viewport as never, tokens);
        if (cancelled) return;
        for (const r of rects) found.push({ page: i, ...r });
      }
      if (!cancelled) setHits(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [highlight, status, url]);

  useEffect(() => {
    onMatchCount?.(hits.length);
  }, [hits.length, onMatchCount]);

  /* ------- Trefferebene zeichnen ------- */
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 0; i < view.length; i++) {
      const canvas = hlRefs.current[i];
      const dim = view[i];
      if (!canvas || !dim) continue;
      canvas.width = Math.max(1, Math.round(dim.w * dpr));
      canvas.height = Math.max(1, Math.round(dim.h * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = dim.scale * dpr;
      hits.forEach((h, idx) => {
        if (h.page !== i + 1) return;
        ctx.fillStyle =
          idx === activeMatch ? "rgba(249, 115, 22, 0.45)" : "rgba(250, 204, 21, 0.38)";
        ctx.fillRect(h.x * s, h.y * s, h.w * s, h.h * s);
      });
    }
  }, [hits, view, activeMatch]);

  /* ------- Zum aktiven Treffer scrollen ------- */
  useEffect(() => {
    if (activeMatch == null) return;
    const hit = hits[activeMatch];
    const wrap = wrapRef.current;
    const dim = hit ? view[hit.page - 1] : null;
    if (!hit || !wrap || !dim) return;
    const pageEl = wrap.querySelector(`[data-page="${hit.page}"]`) as HTMLElement | null;
    if (!pageEl) return;
    const top = pageEl.offsetTop + hit.y * dim.scale - wrap.clientHeight / 3;
    wrap.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [activeMatch, hits, view]);

  /* ---------------- draw overlays ---------------- */
  const pendingRedraw = useRef<number | null>(null);

  const drawPages = useCallback(
    (indices?: number[]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pageList = indices ?? view.map((_, i) => i);
      pageList.forEach((i) => {
        const dim = view[i];
        const canvas = overlayRefs.current[i];
        if (!canvas || !dim) return;
        if (canvas.width !== Math.round(dim.w * dpr)) {
          canvas.width = Math.round(dim.w * dpr);
          canvas.height = Math.round(dim.h * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, dim.w, dim.h);
        const items = [
          ...annos.filter((a): a is Stroke => a.kind === "stroke" && a.page === i),
          ...(drawing.current && drawing.current.page === i ? [drawing.current] : []),
        ];
        if (items.length === 0) return;
        for (const s of items) {
          if (s.pts.length === 0) continue;
          ctx.save();
          ctx.globalAlpha = s.tool === "marker" ? 0.35 : 1;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = (s.tool === "marker" ? s.width * 5 : s.width) * zoom;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          s.pts.forEach(([nx, ny], idx) => {
            const x = nx * dim.w;
            const y = ny * dim.h;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          if (s.pts.length === 1) ctx.lineTo(s.pts[0]![0] * dim.w + 0.1, s.pts[0]![1] * dim.h);
          ctx.stroke();
          ctx.restore();
        }
      });
    },
    [annos, view, zoom],
  );

  const drawPagesRef = useRef(drawPages);
  drawPagesRef.current = drawPages;

  useEffect(() => {
    drawPagesRef.current();
  }, [view, zoom]);

  useEffect(() => {
    if (pendingRedraw.current === null) return;
    if (pendingRedraw.current === -1) drawPagesRef.current();
    else drawPagesRef.current([pendingRedraw.current]);
    pendingRedraw.current = null;
  }, [annos]);

  /* ---------------- zoom (buttons + ctrl/pinch wheel) ---------------- */
  const zoomAt = useCallback((factor: number, clientY?: number) => {
    const el = wrapRef.current;
    setZoom((z) => {
      const next = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
      if (el && next !== z) {
        const rect = el.getBoundingClientRect();
        const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
        const k = next / z;
        el.scrollTop = (el.scrollTop + py) * k - py;
        el.scrollLeft = (el.scrollLeft + rect.width / 2) * k - rect.width / 2;
      }
      return next;
    });
  }, []);

  const zoomRef = useRef(zoomAt);
  zoomRef.current = zoomAt;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomRef.current(Math.exp(-dy * 0.0015), e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const undoAll = () => {
    pendingRedraw.current = -1;
    undo();
  };
  const redoAll = () => {
    pendingRedraw.current = -1;
    redo();
  };

  /* ---------------- pointer handling ---------------- */
  const pointFor = (e: React.PointerEvent): [number, number] => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const eraseAt = (p: [number, number], i: number) => {
    const dim = view[i];
    if (!dim) return;
    const tol = 12;
    const hit = annos.find((a) => {
      if (a.page !== i) return false;
      if (a.kind === "note") return Math.hypot((a.x - p[0]) * dim.w, (a.y - p[1]) * dim.h) < 24;
      return a.pts.some(
        ([x, y]) =>
          Math.hypot((x - p[0]) * dim.w, (y - p[1]) * dim.h) <
          tol + (a.tool === "marker" ? a.width * 3 : a.width),
      );
    });
    if (hit) {
      pendingRedraw.current = i;
      commit(annos.filter((a) => a.id !== hit.id));
    }
  };

  /** Apple Pencil: Radierspitze bzw. Doppeltipp schaltet auf den Radiergummi. */
  const toggleEraser = () => {
    setTool((t) => {
      if (t === "eraser") return prevTool.current === "eraser" ? "pen" : prevTool.current;
      prevTool.current = t === "none" ? "pen" : t;
      return "eraser";
    });
  };

  const onPointerDown = (e: React.PointerEvent, i: number) => {
    if (e.pointerType === "pen") {
      const now = Date.now();
      const last = penTap.current;
      penTap.current = { t: now, x: e.clientX, y: e.clientY };
      if (last && now - last.t < 400 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
        penTap.current = null;
        toggleEraser();
        return;
      }
      // Radierspitze des Pencils
      if ((e.buttons & 32) !== 0 || e.button === 5) {
        eraseAt(pointFor(e), i);
        return;
      }
    }
    if (tool === "none") return;
    const p = pointFor(e);
    if (tool === "note") {
      pendingRedraw.current = i;
      const note: Note = { id: annoId(), kind: "note", page: i, x: p[0], y: p[1], text: "" };
      commit([...annos, note]);
      setEditNote(note.id);
      setTool("none");
      return;
    }
    if (tool === "eraser") {
      eraseAt(p, i);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = {
      id: annoId(),
      kind: "stroke",
      page: i,
      tool: tool === "marker" ? "marker" : "pen",
      color: tool === "marker" ? markerColor : penColor,
      width: tool === "marker" ? 3 : penWidth,
      pts: [p],
    };
    drawPagesRef.current([i]);
  };

  const onPointerMove = (e: React.PointerEvent, i: number) => {
    if (e.pointerType === "pen" && (e.buttons & 32) !== 0) {
      eraseAt(pointFor(e), i);
      return;
    }
    if (tool === "eraser" && e.buttons === 1) {
      eraseAt(pointFor(e), i);
      return;
    }
    if (!drawing.current || drawing.current.page !== i) return;
    drawing.current.pts.push(pointFor(e));
    drawPagesRef.current([i]);
  };

  const onPointerUp = () => {
    const s = drawing.current;
    drawing.current = null;
    if (s && s.pts.length > 0) {
      pendingRedraw.current = s.page;
      commit([...annos, s]);
    } else if (s) {
      drawPagesRef.current([s.page]);
    }
  };

  const notes = useMemo(() => annos.filter((a): a is Note => a.kind === "note"), [annos]);

  return (
    <div className="flex size-full min-h-0 flex-col">
      <AnnotationToolbar
        tool={tool}
        setTool={setTool}
        markerColor={markerColor}
        setMarkerColor={setMarkerColor}
        penColor={penColor}
        setPenColor={setPenColor}
        penWidth={penWidth}
        setPenWidth={setPenWidth}
        zoom={zoom}
        onZoom={(f) => zoomAt(f)}
        onResetZoom={() => setZoom(1)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undoAll}
        onRedo={redoAll}
        canClear={annos.length > 0}
        onClear={() => {
          pendingRedraw.current = -1;
          commit([]);
          toast.success("Markierungen gelöscht");
        }}
      />

      {/* pages */}
      <div
        ref={wrapRef}
        className="min-h-0 flex-1 overflow-y-scroll overflow-x-auto overscroll-contain"
        style={{ scrollbarGutter: "stable", touchAction: tool === "none" ? "auto" : "pan-y" }}
      >
        {status === "loading" && (
          <p className="py-8 text-center text-sm text-muted-foreground">PDF wird geladen…</p>
        )}
        {status === "error" && (
          <PdfFailureView failure={failure} onPassword={setPassword} />
        )}
        {view.map((dim, i) => (
          <div
            key={i}
            data-page={i + 1}
            className="relative mx-auto mb-2 overflow-hidden bg-white"
            style={{ width: dim.w, height: dim.h }}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
            <canvas
              ref={(el) => {
                hlRefs.current[i] = el;
              }}
              className="pointer-events-none absolute inset-0"
              style={{ width: "100%", height: "100%" }}
            />

            <canvas
              ref={(el) => {
                overlayRefs.current[i] = el;
              }}
              className="absolute inset-0"
              style={{
                width: "100%",
                height: "100%",
                touchAction: tool === "none" ? "auto" : "none",
                cursor: tool === "none" ? "default" : "crosshair",
                pointerEvents: tool === "none" ? "none" : "auto",
              }}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={(e) => onPointerMove(e, i)}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
            {notes
              .filter((n) => n.page === i)
              .map((n) => (
                <div
                  key={n.id}
                  className="absolute z-10"
                  style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
                >
                  {editNote === n.id ? (
                    <div className="w-56 rounded-2xl border border-border bg-card p-2 shadow-lg">
                      <textarea
                        autoFocus
                        value={n.text}
                        onChange={(e) =>
                          setAnnos((prev: Anno[]) =>
                            prev.map((a) =>
                              a.id === n.id && a.kind === "note"
                                ? { ...a, text: e.target.value }
                                : a,
                            ),
                          )
                        }
                        placeholder="Notiz…"
                        className="h-20 w-full resize-none rounded-xl bg-transparent p-1 text-xs outline-none"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-xl text-xs"
                          onClick={() => {
                            pendingRedraw.current = n.page;
                            commit(annos.filter((a) => a.id !== n.id));
                          }}
                        >
                          Löschen
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 rounded-xl text-xs"
                          onClick={() => setEditNote(null)}
                        >
                          Fertig
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title={n.text || "Notiz"}
                      onClick={() => setEditNote(n.id)}
                      className="flex max-w-40 items-center gap-1 rounded-xl bg-primary px-2 py-1 text-[11px] text-primary-foreground shadow"
                    >
                      <StickyNote className="size-3 shrink-0" />
                      <span className="truncate">{n.text || "Notiz"}</span>
                    </button>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
