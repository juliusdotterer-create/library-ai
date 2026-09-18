import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HardDrive, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  completeDriveConnection,
  disconnectDrive,
  getDriveStatus,
  startDriveConnect,
} from "@/lib/drive.functions";

function waitForOAuthCompletion(popup: Window): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== "google_drive" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("Verbindung fehlgeschlagen."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Fenster geschlossen, bevor die Verbindung fertig war."));
    }, 500);
  });
}

/** Google-Drive-Verbindung in den Einstellungen: verbinden, Status, trennen. */
export function DrivePanel() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const statusFn = useServerFn(getDriveStatus);
  const { data: status } = useQuery({
    queryKey: ["drive-status"],
    queryFn: () => statusFn(),
  });
  const startFn = useServerFn(startDriveConnect);
  const completeFn = useServerFn(completeDriveConnection);

  const disconnect = useMutation({
    mutationFn: useServerFn(disconnectDrive),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["drive-status"] });
      toast.success("Google Drive getrennt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onConnect = async () => {
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) {
      toast.error("Popup blockiert – bitte Popups erlauben.");
      return;
    }
    setBusy(true);
    try {
      const { authorizationUrl } = await startFn();
      const completion = waitForOAuthCompletion(popup);
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await completeFn({ data: { code } });
      await qc.invalidateQueries({ queryKey: ["drive-status"] });
      toast.success(status?.connected ? "Google Drive erneuert" : "Google Drive verbunden");
    } catch (e) {
      popup.close();
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reconnect = status && "reconnectRequired" in status && status.reconnectRequired;

  return (
    <section className="glass space-y-3 rounded-3xl p-5">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <HardDrive className="size-4" /> Google Drive
        </h2>
        <p className="text-sm text-muted-foreground">
          Verknüpfe Dateien aus deinem Google Drive mit der Library. Es wird nur gelesen –
          in Drive wird nichts verändert oder gelöscht.
        </p>
      </div>
      {status?.connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Verbunden{status.email ? ` als ${status.email}` : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            <Unplug className="size-4" /> Trennen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {reconnect ? (
            <p className="text-sm text-muted-foreground">
              Dein Google-Zugriff muss erneuert werden.
            </p>
          ) : null}
          <Button
            size="sm"
            className="rounded-xl"
            disabled={busy}
            onClick={() => void onConnect()}
          >
            <RefreshCw className="size-4" />
            {reconnect ? "Google Drive erneut verbinden" : "Mit Google Drive verbinden"}
          </Button>
        </div>
      )}
    </section>
  );
}
