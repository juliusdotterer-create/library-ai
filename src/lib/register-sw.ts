import { toast } from "sonner";
import { installChunkReloadHandlers } from "./chunk-reload";

let registered = false;

/** Registriert den Service Worker und meldet neue Versionen. */
export function registerServiceWorker() {
  // Nach einer Veröffentlichung existieren alte Seitenteile nicht mehr:
  // einmalig neu laden, statt eine leere Seite zu zeigen (auch ohne Service Worker).
  installChunkReloadHandlers();
  if (registered) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  registered = true;



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
