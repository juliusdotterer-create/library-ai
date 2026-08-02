import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eraser,
  Highlighter,
  MousePointer2,
  Pen,
  Redo2,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = "none" | "marker" | "pen" | "note" | "eraser";

type Stroke = {
  id: string;
  kind: "stroke";
  page: number;
  tool: "marker" | "pen";
  color: string;
  width: number;
  pts: [number, number][];
};

type Note = {
  id: string;
  kind: "note";
  page: number;
  x: number;
  y: number;
  text: string;
};

export type Anno = Stroke | Note;

const MARKER_COLORS = ["#facc15", "#4ade80", "#f472b6"];
const PEN_COLORS = ["#1f2937", "#2563eb", "#dc2626"];

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** PDF viewer with a transparent annotation layer per page. */
export function PdfAnnotator({
  url,
  documentId,
}: {
  url: string;
  documentId: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<{ numPages: number; getPage: (n: number) => Promise<any> } | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const overlayRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const drawing = useRef<Stroke | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState<{ w: number; h: number; scale: number }[]>([]);
  const [width, setWidth] = useState(0);

  const [tool, setTool] = useState<Tool>("none");
  const [markerColor, setMarkerColor] = useState(MARKER_COLORS[0]!);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]!);
  const [penWidth, setPenWidth] = useState(2);

  const [annos, setAnnos] = useState<Anno[]>([]);
  const [past, setPast] = useState<Anno[][]>([]);
  const [future, setFuture] = useState<Anno[][]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editNote, setEditNote] = useState<string | null>(null);

  const color = tool === "marker" ? markerColor : penColor;

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
        const doc = await pdfjs.getDocument({ url }).promise;
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
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, width]);

  /* ---------------- render pages ---------------- */
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || pages.length === 0) return;
    let cancelled = false;
    void (async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let i = 0; i < pages.length; i++) {
        const canvas = canvasRefs.current[i];
        const dim = pages[i];
        if (!canvas || !dim) continue;
        const page = await doc.getPage(i + 1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: dim.scale * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        try {
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          console.log("[pdf-ok]", i, canvas.width, canvas.height, ctx.getImageData(0,0,50,50).data.slice(0,8).join(","));
        } catch (e) { console.error("[pdf-err]", e);
          /* re-render race, ignore */
        }
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pages]);

  /* ---------------- load annotations ---------------- */
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setAnnos([]);
    setPast([]);
    setFuture([]);
    void (async () => {
      const { data } = await supabase
        .from("document_annotations")
        .select("data")
        .eq("document_id", documentId)
        .maybeSingle();
      if (cancelled) return;
      const list = Array.isArray(data?.data) ? (data.data as unknown as Anno[]) : [];
      setAnnos(list);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  /* ---------------- autosave ---------------- */
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) return;
        await supabase
          .from("document_annotations")
          .upsert(
            { user_id: userId, document_id: documentId, data: annos as never },
            { onConflict: "user_id,document_id" },
          );
      })();
    }, 900);
    return () => clearTimeout(t);
  }, [annos, loaded, documentId]);

  /* ---------------- draw overlays ---------------- */
  const redraw = useCallback(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pages.forEach((dim, i) => {
      const canvas = overlayRefs.current[i];
      if (!canvas) return;
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
      for (const s of items) {
        if (s.pts.length === 0) continue;
        ctx.save();
        ctx.globalAlpha = s.tool === "marker" ? 0.35 : 1;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.tool === "marker" ? s.width * 5 : s.width;
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
  }, [annos, pages]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  /* ---------------- history helpers ---------------- */
  const commit = (next: Anno[]) => {
    setPast((p) => [...p.slice(-49), annos]);
    setFuture([]);
    setAnnos(next);
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1]!;
      setFuture((f) => [annos, ...f].slice(0, 50));
      setAnnos(prev);
      return p.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0]!;
      setPast((p) => [...p, annos]);
      setAnnos(next);
      return f.slice(1);
    });
  };

  /* ---------------- pointer handling ---------------- */
  const pointFor = (e: React.PointerEvent, i: number): [number, number] => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const eraseAt = (p: [number, number], i: number) => {
    const dim = pages[i];
    if (!dim) return;
    const tol = 12;
    const hit = annos.find((a) => {
      if (a.page !== i) return false;
      if (a.kind === "note")
        return Math.hypot((a.x - p[0]) * dim.w, (a.y - p[1]) * dim.h) < 24;
      return a.pts.some(
        ([x, y]) =>
          Math.hypot((x - p[0]) * dim.w, (y - p[1]) * dim.h) <
          tol + (a.tool === "marker" ? a.width * 3 : a.width),
      );
    });
    if (hit) commit(annos.filter((a) => a.id !== hit.id));
  };

  const onPointerDown = (e: React.PointerEvent, i: number) => {
    if (tool === "none") return;
    const p = pointFor(e, i);
    if (tool === "note") {
      const note: Note = { id: uid(), kind: "note", page: i, x: p[0], y: p[1], text: "" };
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
      id: uid(),
      kind: "stroke",
      page: i,
      tool: tool === "marker" ? "marker" : "pen",
      color: tool === "marker" ? markerColor : penColor,
      width: tool === "marker" ? 3 : penWidth,
      pts: [p],
    };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent, i: number) => {
    if (tool === "eraser" && e.buttons === 1) {
      eraseAt(pointFor(e, i), i);
      return;
    }
    if (!drawing.current || drawing.current.page !== i) return;
    drawing.current.pts.push(pointFor(e, i));
    redraw();
  };

  const onPointerUp = () => {
    const s = drawing.current;
    drawing.current = null;
    if (s && s.pts.length > 0) commit([...annos, s]);
    else redraw();
  };

  const notes = useMemo(() => annos.filter((a): a is Note => a.kind === "note"), [annos]);

  const swatch = (c: string, active: boolean, onClick: () => void) => (
    <button
      key={c}
      type="button"
      onClick={onClick}
      title="Farbe"
      className={cn(
        "size-5 rounded-full border transition",
        active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border",
      )}
      style={{ background: c }}
    />
  );

  const toolBtn = (t: Tool, label: string, Icon: typeof Pen) => (
    <Button
      type="button"
      size="icon"
      variant={tool === t ? "default" : "ghost"}
      className="rounded-2xl"
      title={label}
      onClick={() => setTool(tool === t ? "none" : t)}
    >
      <Icon className="size-4" />
    </Button>
  );

  return (
    <div className="flex size-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/50 px-2 py-1.5">
        {toolBtn("none", "Nur ansehen", MousePointer2)}
        {toolBtn("marker", "Textmarker", Highlighter)}
        {toolBtn("pen", "Stift", Pen)}
        {toolBtn("note", "Notiz", StickyNote)}
        {toolBtn("eraser", "Radiergummi", Eraser)}

        {tool === "marker" && (
          <div className="ml-1 flex items-center gap-1">
            {MARKER_COLORS.map((c) => swatch(c, markerColor === c, () => setMarkerColor(c)))}
          </div>
        )}
        {tool === "pen" && (
          <div className="ml-1 flex items-center gap-2">
            {PEN_COLORS.map((c) => swatch(c, penColor === c, () => setPenColor(c)))}
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={penWidth}
              onChange={(e) => setPenWidth(Number(e.target.value))}
              className="h-1 w-20 accent-primary"
              title="Strichstärke"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-2xl"
            title="Rückgängig"
            disabled={past.length === 0}
            onClick={undo}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-2xl"
            title="Wiederherstellen"
            disabled={future.length === 0}
            onClick={redo}
          >
            <Redo2 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-2xl"
            title="Alle Markierungen löschen"
            disabled={annos.length === 0}
            onClick={() => {
              commit([]);
              toast.success("Markierungen gelöscht");
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* pages */}
      <div ref={wrapRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {status === "loading" && (
          <p className="py-8 text-center text-sm text-muted-foreground">PDF wird geladen…</p>
        )}
        {status === "error" && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            PDF konnte nicht angezeigt werden.
          </p>
        )}
        {pages.map((dim, i) => (
          <div
            key={i}
            className="relative mb-3 overflow-hidden rounded-xl bg-white"
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
                          setAnnos((prev) =>
                            prev.map((a) =>
                              a.id === n.id && a.kind === "note" ? { ...a, text: e.target.value } : a,
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
                          onClick={() => commit(annos.filter((a) => a.id !== n.id))}
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
