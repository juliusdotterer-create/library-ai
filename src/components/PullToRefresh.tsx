import { useRef, useState, type ReactNode, type TouchEvent } from "react";
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
  const [pulling, setPulling] = useState(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (containerRef.current.scrollTop > 0) return;
    startY.current = e.touches[0]?.clientY ?? 0;
    setPulling(true);
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!pulling) return;
    const y = e.touches[0]?.clientY ?? 0;
    const delta = Math.max(0, y - startY.current);
    setOffset(Math.min(delta * 0.45, THRESHOLD + 24));
  };

  const onTouchEnd = async () => {
    setPulling(false);
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
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn("relative overflow-y-auto overscroll-y-contain", className)}
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
