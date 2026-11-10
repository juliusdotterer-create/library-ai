import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { resetLocalData } from "@/integrations/local/db";

/** Hinweis zur lokalen Speicherung und Zurücksetzen aller Daten. */
export function LocalDataPanel() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Ordner, Dateien, Termine, Lehrpläne, Links und Notizen werden nur in diesem Browser auf
        diesem Gerät gespeichert. Es gibt kein Konto und keine Synchronisierung. Wenn du die
        Websitedaten des Browsers löschst, sind auch diese Inhalte weg.
      </p>
      <Button
        variant="outline"
        className="w-full rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={busy}
        onClick={() => setConfirm(true)}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Alle lokalen Daten löschen
      </Button>
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        name="Alle lokalen Daten"
        title="Alle lokalen Daten löschen"
        description="Alle Ordner, Dateien, Termine, Lehrpläne, Links und Notizen in diesem Browser werden endgültig gelöscht."
        confirmLabel="Endgültig löschen"
        onConfirm={async () => {
          setBusy(true);
          try {
            await resetLocalData();
            qc.clear();
            toast.success("Lokale Daten gelöscht");
            window.location.assign("/library");
          } finally {
            setBusy(false);
            setConfirm(false);
          }
        }}
      />
    </div>
  );
}
