/** Erkennt Fehler durch veraltete App-Dateien nach einer Veröffentlichung (Chrome, Safari, Firefox). */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .* failed/i;

export function isChunkLoadError(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error ?? "");
  return CHUNK_ERROR.test(msg);
}

/** Lädt die Seite einmalig neu (max. alle 10 s). Gibt true zurück, wenn neu geladen wird. */
export function reloadOnceForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  const key = "chunk-reload-at";
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(key) ?? 0);
  } catch {
    /* ignore */
  }
  if (Date.now() - last < 10_000) return false;
  try {
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
  return true;
}

let installed = false;
export function installChunkReloadHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnceForChunkError()) event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) reloadOnceForChunkError();
  });
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error ?? event.message)) reloadOnceForChunkError();
  });
}
