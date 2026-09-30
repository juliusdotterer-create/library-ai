import { toast } from "sonner";

let registered = false;

/** Registriert den Service Worker und meldet neue Versionen. */
export function registerServiceWorker() {
  if (registered) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  registered = true;

  // Nach einer Veröffentlichung existieren alte Seitenteile nicht mehr:
  // einmalig neu laden, statt eine leere Seite zu zeigen.
  window.addEventListener("vite:preloadError", (event) => {
    const key = "chunk-reload-at";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 10_000) return;
    event.preventDefault();
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const msg = String((event.reason as Error)?.message ?? event.reason ?? "");
    if (!/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) return;
    const key = "chunk-reload-at";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  });

  void navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) {
            toast("Neue Version verfügbar", {
              description: "Zum Aktualisieren neu laden.",
              duration: 15000,
              action: {
                label: "Neu laden",
                onClick: () => {
                  next.postMessage("SKIP_WAITING");
                  window.location.reload();
                },
              },
            });
          }
        });
      });
    })
    .catch(() => {
      /* Offline-Unterstützung ist optional */
    });
}
