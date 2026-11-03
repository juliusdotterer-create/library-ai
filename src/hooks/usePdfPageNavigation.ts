import { useCallback, useEffect, useState, type RefObject } from "react";

/** Page wrappers exist independently of the lazily allocated PDF canvases. */
export function usePdfPageNavigation(rootRef: RefObject<HTMLDivElement | null>, total: number, layoutKey: string) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || total === 0) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-page]"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = root.getBoundingClientRect().top + Math.min(80, root.clientHeight / 4);
      let low = 0;
      let high = targets.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const target = targets[middle];
        if (target && target.getBoundingClientRect().bottom <= line) low = middle + 1;
        else high = middle;
      }
      setPage(Number(targets[low]?.dataset.page ?? 1));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    root.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => { root.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [rootRef, total, layoutKey]);
  const jump = useCallback((value: number) => {
    const root = rootRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-page="${value}"]`);
    if (!root || !target) return;
    const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    // Instant jumps avoid animating through hundreds of intermediate canvases.
    root.scrollTo({ top, behavior: "instant" });
    setPage(value);
  }, [rootRef]);
  return { page, jump };
}