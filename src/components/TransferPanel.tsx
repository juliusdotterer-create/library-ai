import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupTransferTarget, transferAccountData } from "@/lib/transfer.functions";

export function TransferPanel() {
  const lookup = useServerFn(lookupTransferTarget);
  const transfer = useServerFn(transferAccountData);
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    const value = email.trim().toLowerCase();
    if (!value.includes("@")) return toast.error("Bitte eine gültige E-Mail eintragen.");
    setBusy(true);
    try {
      const res = await lookup({ data: { email: value } });
      if (!res.found) {
        setChecked(null);
        toast.error(
          "self" in res && res.self
            ? "Das ist dein eigener Account."
            : "Kein registrierter Account mit dieser E-Mail gefunden.",
        );
        return;
      }
      setChecked(res.email);
      toast.success(`Account gefunden: ${res.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Prüfung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!checked) return toast.error("Bitte zuerst den Ziel-Account prüfen.");
    if (confirm.trim().toUpperCase() !== "ÜBERTRAGEN")
      return toast.error('Bitte "ÜBERTRAGEN" eintippen.');
    setBusy(true);
    try {
      const r = await transfer({ data: { email: checked, confirm } });
      toast.success(
        `Übertragen an ${r.email}: ${r.folders} Ordner, ${r.filesCopied} Dateien, ${r.events} Termine, ${r.plans} Lehrpläne, ${r.links} Links` +
          (r.filesFailed ? ` (${r.filesFailed} Dateien fehlgeschlagen)` : ""),
      );
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Übertragung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="ziel@beispiel.de"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setChecked(null);
          }}
          className="rounded-2xl"
        />
        <Button variant="outline" className="rounded-2xl" onClick={check} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} Account prüfen
        </Button>
      </div>

      {checked ? (
        <div className="space-y-2 rounded-2xl border border-border/60 p-3">
          <Label className="text-xs text-muted-foreground">
            Kopiert Ordner, Dateien, Termine, Lehrpläne und Links zu <b>{checked}</b>. Deine eigenen
            Daten bleiben unverändert. Tippe zur Bestätigung „ÜBERTRAGEN“.
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="ÜBERTRAGEN"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-2xl"
            />
            <Button className="rounded-2xl" onClick={run} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{" "}
              Übertragen
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
