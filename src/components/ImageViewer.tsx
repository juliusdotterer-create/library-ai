import { useEffect, useRef, useState } from "react";
import { Download, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Bildvorschau mit Zoom (Buttons/Mausrad) und Verschieben. */
export function ImageViewer({ url, name, rotation = 0 }: { url: string; name: string; rotation?: number }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setFailed(false);
  }, [url]);

  const clamp = (v: number) => Math.min(6, Math.max(0.2, v));

  if (failed) {
    return (
      <div className="space-y-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Dieses Bildformat kann der Browser nicht darstellen (z. B. HEIC).
        </p>
        <Button asChild className="rounded-2xl">
          <a href={url} download={name}>
            <Download className="size-4" /> Herunterladen
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative size-full">
      <div
        ref={wrapRef}
        className="size-full overflow-auto p-2"
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          setZoom((z) => clamp(z - e.deltaY * 0.002));
        }}
        onPointerDown={(e) => {
          const el = wrapRef.current;
          if (!el) return;
          drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
        }}
        onPointerMove={(e) => {
          const el = wrapRef.current;
          if (!el || !drag.current) return;
          el.scrollLeft = drag.current.l - (e.clientX - drag.current.x);
          el.scrollTop = drag.current.t - (e.clientY - drag.current.y);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <div className="flex min-h-full min-w-full items-center justify-center">
          <img
            src={url}
            alt={name}
            onError={() => setFailed(true)}
            draggable={false}
            style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? "100%" : "none", transform: rotation ? `rotate(${rotation}deg)` : undefined, transition: "transform 200ms" }}
            className="max-h-full select-none object-contain"
          />
        </div>
      </div>
      <div className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-1">
        <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={() => setZoom((z) => clamp(z - 0.25))}>
          <Minus className="size-4" />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={() => setZoom((z) => clamp(z + 0.25))}>
          <Plus className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={() => setZoom(1)} title="Anpassen">
          <Maximize className="size-4" />
        </Button>
      </div>
    </div>
  );
}
