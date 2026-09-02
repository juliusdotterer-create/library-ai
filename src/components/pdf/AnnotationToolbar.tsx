import {
  Eraser,
  Highlighter,
  Maximize2,
  MousePointer2,
  Pen,
  Redo2,
  StickyNote,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Tool = "none" | "marker" | "pen" | "note" | "eraser";

export const MARKER_COLORS = ["#facc15", "#4ade80", "#f472b6"];
export const PEN_COLORS = ["#1f2937", "#2563eb", "#dc2626"];
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Farbe"
      className={cn(
        "size-5 rounded-full border transition",
        active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border-border",
      )}
      style={{ background: color }}
    />
  );
}

/** Werkzeugleiste des PDF-Annotators: Werkzeuge, Farben, Zoom und Historie. */
export function AnnotationToolbar({
  tool,
  setTool,
  markerColor,
  setMarkerColor,
  penColor,
  setPenColor,
  penWidth,
  setPenWidth,
  zoom,
  onZoom,
  onResetZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canClear,
  onClear,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  markerColor: string;
  setMarkerColor: (c: string) => void;
  penColor: string;
  setPenColor: (c: string) => void;
  penWidth: number;
  setPenWidth: (w: number) => void;
  zoom: number;
  onZoom: (factor: number) => void;
  onResetZoom: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canClear: boolean;
  onClear: () => void;
}) {
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
    <div className="flex flex-wrap items-center gap-1 border-b border-border/50 px-2 py-1.5">
      {toolBtn("none", "Nur ansehen", MousePointer2)}
      {toolBtn("marker", "Textmarker", Highlighter)}
      {toolBtn("pen", "Stift", Pen)}
      {toolBtn("note", "Notiz", StickyNote)}
      {toolBtn("eraser", "Radiergummi", Eraser)}

      {tool === "marker" && (
        <div className="ml-1 flex items-center gap-1">
          {MARKER_COLORS.map((c) => (
            <Swatch key={c} color={c} active={markerColor === c} onClick={() => setMarkerColor(c)} />
          ))}
        </div>
      )}
      {tool === "pen" && (
        <div className="ml-1 flex items-center gap-2">
          {PEN_COLORS.map((c) => (
            <Swatch key={c} color={c} active={penColor === c} onClick={() => setPenColor(c)} />
          ))}
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
          title="Verkleinern"
          disabled={zoom <= MIN_ZOOM + 0.001}
          onClick={() => onZoom(1 / 1.25)}
        >
          <ZoomOut className="size-4" />
        </Button>
        <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Vergrößern"
          disabled={zoom >= MAX_ZOOM - 0.001}
          onClick={() => onZoom(1.25)}
        >
          <ZoomIn className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Breite anpassen"
          onClick={onResetZoom}
        >
          <Maximize2 className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Rückgängig"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Wiederherstellen"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Alle Markierungen löschen"
          disabled={!canClear}
          onClick={onClear}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
