import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";

/** Spaltenzahl passend zu `sm:grid-cols-2 lg:grid-cols-3`. */
function useColumns(grid: boolean) {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    if (!grid) return setCols(1);
    const calc = () => setCols(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [grid]);
  return cols;
}

/**
 * Rendert nur die sichtbaren Zeilen (virtuelles Scrollen). Unter `threshold`
 * Elementen wird normal gerendert.
 */
export function VirtualGrid({
  items,
  grid,
  threshold = 60,
  after,
}: {
  items: { key: string; node: ReactNode }[];
  grid: boolean;
  threshold?: number;
  after?: ReactNode;
}) {
  const cols = useColumns(grid);
  const ref = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const virtual = items.length > threshold;
  const rows = Math.ceil(items.length / cols);
  const gap = grid ? 12 : 8;

  useLayoutEffect(() => {
    if (ref.current) setMargin(ref.current.getBoundingClientRect().top + window.scrollY);
  }, [virtual, items.length]);

  const v = useWindowVirtualizer({
    count: virtual ? rows : 0,
    estimateSize: () => (grid ? 84 : 60) + gap,
    overscan: 6,
    scrollMargin: margin,
  });

  const baseCls = grid ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2";

  if (!virtual) {
    return (
      <div className={baseCls}>
        {items.map((i) => (
          <div key={i.key} className="min-w-0">{i.node}</div>
        ))}
        {after}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ height: v.getTotalSize(), position: "relative" }}>
      {v.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={v.measureElement}
          className="absolute left-0 w-full"
          style={{ transform: `translateY(${row.start - margin}px)`, paddingBottom: gap }}
        >
          <div className={cn(baseCls)}>
            {items.slice(row.index * cols, row.index * cols + cols).map((i) => (
              <div key={i.key} className="min-w-0">{i.node}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
