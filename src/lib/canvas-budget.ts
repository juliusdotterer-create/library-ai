/**
 * Mobile Safari kills the tab ("Auf … ist wiederholt ein Problem aufgetreten")
 * when canvases use too much memory. Cap the backing-store pixels per canvas.
 */
export const TOUCH_MAX_PIXELS = 5_000_000;
export const DESKTOP_MAX_PIXELS = 16_000_000;

/** Device-pixel ratio for a canvas of cssW×cssH that stays inside maxPixels. */
export function canvasRatio(cssW: number, cssH: number, dpr: number, maxPixels: number): number {
  const area = Math.max(1, cssW) * Math.max(1, cssH);
  const fit = Math.sqrt(maxPixels / area);
  return Math.max(0.1, Math.min(dpr, fit));
}

export function maxCanvasPixels(): number {
  if (typeof window === "undefined") return DESKTOP_MAX_PIXELS;
  const touch = window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
  return touch ? TOUCH_MAX_PIXELS : DESKTOP_MAX_PIXELS;
}

export function deviceRatio(): number {
  return typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}
