import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Highlighter, Pen, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Point = [number, number, number]; // x, y (normalisiert), Druck
export type Stroke = {
  id: string;
  tool: "pen" | "marker";
  color: string;
  width: number;
  pts: Point[];
  t: number;
};

export const PAGE_RATIO = 1.414; // A4 hoch
const COLORS = ["#1f2937", "#2563eb", "#dc2626", "#16a34a", "#f59e0b"];

/** Zeichnet eine Stroke-Liste auf einen 2D-Kontext (Größe w × h in CSS-Pixeln). */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  w: number,
  h: number,
) {
  ctx.clearRect(0, 0, w, h);
  for (const s of strokes) {
    if (!s.pts.length) continue;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = s.tool === "marker" ? 0.32 : 1;
    ctx.lineCap = s.tool === "marker" ? "butt" : "round";
    ctx.lineJoin = "round";
    if (s.pts.length === 1) {
      const [x, y, p] = s.pts[0]!;
      ctx.beginPath();
      ctx.arc(x * w, y * h, (s.width * (0.5 + p)) / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.restore();
      continue;
    }
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1]!;
      const b = s.pts[i]!;
      ctx.beginPath();
      ctx.lineWidth = s.tool === "marker" ? s.width * 3 : s.width * (0.4 + b[2] * 1.2);
      ctx.moveTo(a[0] * w, a[1] * h);
      ctx.lineTo(b[0] * w, b[1] * h);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Handschrift-Fläche mit Apple-Pencil-Optimierung:
 * Pointer Events, Druckstärke, coalesced events, Palm Rejection.
 */
export function HandwritingCanvas({
  strokes,
  onChange,
  className,
}: {
  strokes: Stroke[];
  onChange: (next: Stroke[]) => void;
  className?: string;
}) {
  const [tool, setTool] = useState<"pen" | "marker" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(3);
  const [redo, setRedo] = useState<Stroke[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const draft = useRef<Stroke | null>(null);
  const activePen = useRef(false);
  const activeId = useRef<number | null>(null);
  const penTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const w = box.clientWidth;
    const h = w * PAGE_RATIO;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintStrokes(ctx, draft.current ? [...strokes, draft.current] : strokes, w, h);
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  const pointFrom = (e: PointerEvent | React.PointerEvent, el: HTMLElement): Point => {
    const r = el.getBoundingClientRect();
    const pressure =
      e.pointerType === "pen" && e.pressure > 0 ? e.pressure : e.pressure > 0 ? 0.5 : 0.5;
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, pressure];
  };

  const commit = (next: Stroke[]) => {
    setRedo([]);
    onChange(next);
  };

  const eraseAt = (p: Point) => {
    const box = boxRef.current;
    if (!box) return;
    const w = box.clientWidth;
    const h = w * PAGE_RATIO;
    const idx = strokes.findIndex((s) =>
      s.pts.some(([x, y]) => Math.hypot((x - p[0]) * w, (y - p[1]) * h) < 12 + s.width),
    );
    if (idx >= 0) commit(strokes.filter((_, i) => i !== idx));
  };

  const onDown = (e: React.PointerEvent) => {
    // Palm Rejection: Finger ignorieren, solange ein Stift-Strich läuft
    if (e.pointerType === "touch" && activePen.current) return;
    if (activeId.current !== null) return;

    if (e.pointerType === "pen") {
      const now = Date.now();
      const last = penTap.current;
      penTap.current = { t: now, x: e.clientX, y: e.clientY };
      if (last && now - last.t < 400 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
        penTap.current = null;
        setTool((t) => (t === "eraser" ? "pen" : "eraser"));
        return;
      }
      activePen.current = true;
    }

    const el = e.currentTarget as HTMLElement;
    const penEraser = e.pointerType === "pen" && ((e.buttons & 32) !== 0 || e.button === 5);
    if (tool === "eraser" || penEraser) {
      activeId.current = e.pointerId;
      el.setPointerCapture(e.pointerId);
      eraseAt(pointFrom(e, el));
      return;
    }
    activeId.current = e.pointerId;
    el.setPointerCapture(e.pointerId);
    draft.current = {
      id: crypto.randomUUID(),
      tool: tool === "marker" ? "marker" : "pen",
      color,
      width,
      pts: [pointFrom(e, el)],
      t: Date.now(),
    };
    redraw();
  };

  const onMove = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return;
    const el = e.currentTarget as HTMLElement;
    const penEraser = e.pointerType === "pen" && (e.buttons & 32) !== 0;
    if (tool === "eraser" || penEraser) {
      eraseAt(pointFrom(e, el));
      return;
    }
    if (!draft.current) return;
    const native = e.nativeEvent;
    const events =
      typeof native.getCoalescedEvents === "function" && native.getCoalescedEvents().length
        ? native.getCoalescedEvents()
        : [native];
    for (const ev of events) draft.current.pts.push(pointFrom(ev, el));
    redraw();
  };

  const onUp = (e: React.PointerEvent) => {
    if (activeId.current !== null && activeId.current !== e.pointerId) return;
    activeId.current = null;
    if (e.pointerType === "pen") activePen.current = false;
    const s = draft.current;
    draft.current = null;
    if (s && s.pts.length) commit([...strokes, s]);
    else redraw();
  };

  const undo = () => {
    if (!strokes.length) return;
    setRedo((r) => [...r, strokes]);
    onChange(strokes.slice(0, -1));
  };
  const doRedo = () => {
    const last = redo[redo.length - 1];
    if (!last) return;
    setRedo((r) => r.slice(0, -1));
    onChange(last);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/50 px-2 py-1.5">
        <Button
          size="icon"
          variant={tool === "pen" ? "default" : "ghost"}
          className="rounded-2xl"
          title="Stift"
          onClick={() => setTool("pen")}
        >
          <Pen className="size-4" />
        </Button>
        <Button
          size="icon"
          variant={tool === "marker" ? "default" : "ghost"}
          className="rounded-2xl"
          title="Textmarker"
          onClick={() => setTool("marker")}
        >
          <Highlighter className="size-4" />
        </Button>
        <Button
          size="icon"
          variant={tool === "eraser" ? "default" : "ghost"}
          className="rounded-2xl"
          title="Radierer (Pencil: Doppeltipp)"
          onClick={() => setTool("eraser")}
        >
          <Eraser className="size-4" />
        </Button>

        <div className="ml-1 flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title="Farbe"
              onClick={() => {
                setColor(c);
                if (tool === "eraser") setTool("pen");
              }}
              className={cn(
                "size-5 rounded-full border transition",
                color === c && tool !== "eraser"
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  : "border-border",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="h-1 w-16 accent-primary"
          title="Strichstärke"
        />

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-2xl"
            title="Rückgängig"
            disabled={!strokes.length}
            onClick={undo}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-2xl"
            title="Wiederherstellen"
            disabled={!redo.length}
            onClick={doRedo}
          >
            <Redo2 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-2xl"
            title="Seite leeren"
            onClick={() => commit([])}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        <div ref={boxRef} className="relative mx-auto w-full max-w-3xl">
          <canvas
            ref={canvasRef}
            className="doc-page w-full rounded-xl bg-white shadow-sm"
            style={{ aspectRatio: `1 / ${PAGE_RATIO}`, touchAction: "none", display: "block" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
          />
        </div>
      </div>
    </div>
  );
}
