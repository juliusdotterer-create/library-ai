import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pen, Save, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NoteStroke = { color: string; width: number; pts: [number, number][] };
type Sheet = { text: string; strokes: NoteStroke[] };

const COLORS = ["#1f2937", "#2563eb", "#dc2626", "#16a34a"];
/** Logisches Seitenverhältnis des Blatts (A4 hoch). */
const RATIO = 1.414;

const parse = (raw: string): Sheet => {
  if (!raw) return { text: "", strokes: [] };
  try {
    const obj = JSON.parse(raw) as Partial<Sheet> & { __sheet?: boolean };
    if (obj && obj.__sheet)
      return { text: obj.text ?? "", strokes: Array.isArray(obj.strokes) ? obj.strokes : [] };
  } catch {
    /* alter Klartext */
  }
  return { text: raw, strokes: [] };
};

const serialize = (s: Sheet) =>
  s.strokes.length ? JSON.stringify({ __sheet: true, ...s }) : s.text;

/** Free writing sheet stored separately from the PDF annotations. */
export function DocumentNotepad({ documentId }: { documentId: string }) {
  const [sheet, setSheet] = useState<Sheet>({ text: "", strokes: [] });
  const [mode, setMode] = useState<"text" | "draw">("text");
  const [color, setColor] = useState(COLORS[0]!);
  const [penWidth, setPenWidth] = useState(2);
  const [erasing, setErasing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skip = useRef(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<NoteStroke | null>(null);
  const penTap = useRef<{ t: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    skip.current = true;
    setLoaded(false);
    void (async () => {
      const { data } = await supabase
        .from("document_notepads")
        .select("content")
        .eq("document_id", documentId)
        .maybeSingle();
      if (cancelled) return;
      setSheet(parse(data?.content ?? ""));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const save = async (value: Sheet, silent = true) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("document_notepads")
      .upsert(
        { user_id: userId, document_id: documentId, content: serialize(value) },
        { onConflict: "user_id,document_id" },
      );
    setSaving(false);
    if (error) toast.error("Schreibblatt konnte nicht gespeichert werden");
    else if (!silent) toast.success("Schreibblatt gespeichert");
  };

  // autosave
  useEffect(() => {
    if (!loaded) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const t = setTimeout(() => void save(sheet), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, loaded]);

  /* ---------------- canvas ---------------- */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const w = box.clientWidth;
    const h = w * RATIO;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const items = [...sheet.strokes, ...(drawing.current ? [drawing.current] : [])];
    for (const s of items) {
      if (!s.pts.length) continue;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.pts.forEach(([nx, ny], i) => {
        const x = nx * w;
        const y = ny * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (s.pts.length === 1) ctx.lineTo(s.pts[0]![0] * w + 0.1, s.pts[0]![1] * h);
      ctx.stroke();
      ctx.restore();
    }
  }, [sheet.strokes]);

  useEffect(() => {
    redraw();
  }, [redraw, mode]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [redraw]);

  const pointFor = (e: React.PointerEvent): [number, number] => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const eraseAt = (p: [number, number]) => {
    const box = boxRef.current;
    if (!box) return;
    const w = box.clientWidth;
    const h = w * RATIO;
    setSheet((prev) => {
      const idx = prev.strokes.findIndex((s) =>
        s.pts.some(([x, y]) => Math.hypot((x - p[0]) * w, (y - p[1]) * h) < 12 + s.width),
      );
      if (idx < 0) return prev;
      return { ...prev, strokes: prev.strokes.filter((_, i) => i !== idx) };
    });
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") {
      const now = Date.now();
      const last = penTap.current;
      penTap.current = { t: now, x: e.clientX, y: e.clientY };
      if (last && now - last.t < 400 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
        penTap.current = null;
        setErasing((v) => !v);
        return;
      }
    }
    const penEraser = e.pointerType === "pen" && ((e.buttons & 32) !== 0 || e.button === 5);
    if (erasing || penEraser) {
      eraseAt(pointFor(e));
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = { color, width: penWidth, pts: [pointFor(e)] };
    redraw();
  };

  const onMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1 && e.buttons !== 32) return;
    const penEraser = e.pointerType === "pen" && (e.buttons & 32) !== 0;
    if (erasing || penEraser) {
      eraseAt(pointFor(e));
      return;
    }
    if (!drawing.current) return;
    drawing.current.pts.push(pointFor(e));
    redraw();
  };

  const onUp = () => {
    const s = drawing.current;
    drawing.current = null;
    if (s && s.pts.length) setSheet((prev) => ({ ...prev, strokes: [...prev.strokes, s] }));
    else redraw();
  };

  const clearAll = () => {
    const next: Sheet = mode === "draw" ? { ...sheet, strokes: [] } : { ...sheet, text: "" };
    setSheet(next);
    void save(next, false);
  };

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/50 px-2 py-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Schreibblatt</span>
        <Button
          size="icon"
          variant={mode === "text" ? "default" : "ghost"}
          className="ml-1 rounded-2xl"
          title="Tippen"
          onClick={() => setMode("text")}
        >
          <Type className="size-4" />
        </Button>
        <Button
          size="icon"
          variant={mode === "draw" ? "default" : "ghost"}
          className="rounded-2xl"
          title="Mit Stift schreiben"
          onClick={() => setMode("draw")}
        >
          <Pen className="size-4" />
        </Button>
        {mode === "draw" && (
          <>
            <Button
              size="icon"
              variant={erasing ? "default" : "ghost"}
              className="rounded-2xl"
              title="Radiergummi (Pencil: Doppeltipp)"
              onClick={() => setErasing((v) => !v)}
            >
              <Eraser className="size-4" />
            </Button>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title="Farbe"
                  onClick={() => {
                    setColor(c);
                    setErasing(false);
                  }}
                  className={cn(
                    "size-5 rounded-full border transition",
                    color === c && !erasing
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
              max={8}
              step={1}
              value={penWidth}
              onChange={(e) => setPenWidth(Number(e.target.value))}
              className="h-1 w-16 accent-primary"
              title="Strichstärke"
            />
          </>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {saving ? "Speichert…" : "Automatisch gespeichert"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Speichern"
          onClick={() => void save(sheet, false)}
        >
          <Save className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title={mode === "draw" ? "Zeichnung leeren" : "Text leeren"}
          onClick={clearAll}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {mode === "text" ? (
        <textarea
          value={sheet.text}
          onChange={(e) => setSheet((p) => ({ ...p, text: e.target.value }))}
          placeholder="Eigene Lösung schreiben…"
          className="min-h-0 flex-1 resize-none bg-transparent p-3 text-sm leading-relaxed outline-none"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <div ref={boxRef} className="relative w-full">
            <canvas
              ref={canvasRef}
              className="w-full rounded-xl bg-white"
              style={{ aspectRatio: `1 / ${RATIO}`, touchAction: "none", display: "block" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            />
          </div>
        </div>
      )}
    </div>
  );
}
