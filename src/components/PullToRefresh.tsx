import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;

export function PullToRefresh({
  children,
  onRefresh,
  className,
}: {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // React registriert touchmove als passiven Listener – preventDefault()
  // würde dort ignoriert. Deshalb nativ mit { passive: false } anbinden.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: globalThis.TouchEvent) => {
      if (!pulling.current) return;
      const y = e.touches[0]?.clientY ?? 0;
      const delta = Math.max(0, y - startY.current);
      if (delta <= 0) return;
      e.preventDefault();
      setOffset(Math.min(delta * 0.45, THRESHOLD + 24));
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const pageScrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
    if (pageScrollTop > 0 || refreshing) return;
    startY.current = e.touches[0]?.clientY ?? 0;
    pulling.current = true;
  };

  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (offset >= THRESHOLD) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setOffset(0);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={cn("relative overscroll-y-contain", className)}
      style={{ touchAction: "pan-x pan-y" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center"
        style={{
          transform: `translateY(${(offset - 28) / 2}px)`,
          opacity: Math.min(offset / THRESHOLD, 1),
        }}
      >
        <Loader2 className={cn("size-6 text-primary", refreshing && "animate-spin")} />
      </div>
      <div style={{ transform: `translateY(${offset}px)` }}>{children}</div>
    </div>
  );
}
