import { useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  lookupTransferTarget,
  transferStart,
  transferDocsChunk,
  transferFinish,
} from "@/lib/transfer.functions";

const fmtDur = (s: number) => {
  if (!isFinite(s) || s <= 0) return "–";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m} min ${r}s` : `${r}s`;
};

export function TransferPanel() {
  const lookup = useServerFn(lookupTransferTarget);
  const start = useServerFn(transferStart);
  const chunk = useServerFn(transferDocsChunk);
  const finish = useServerFn(transferFinish);

  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [scopes, setScopes] = useState({
    library: true,
    calendar: true,
    plans: true,
    links: true,
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const cancelRef = useRef(false);


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
    cancelRef.current = false;
    setDoneCount(0);
    setEta(null);
    try {
      setStatus("Ordnerstruktur wird angelegt …");
      const s = await start({ data: { email: checked, confirm } });
      setTotal(s.totalDocs);
      setStatus(`Ordner übertragen: ${s.folders}. Dateien werden kopiert …`);

      const limit = 20;
      let offset = 0;
      let copied = 0;
      let failed = 0;
      const t0 = Date.now();
      for (;;) {
        if (cancelRef.current) throw new Error("Abgebrochen");
        const r = await chunk({ data: { email: checked, offset, limit } });
        copied += r.copied;
        failed += r.failed;
        offset += r.processed;
        setDoneCount(offset);
        const elapsed = (Date.now() - t0) / 1000;
        const rate = offset / Math.max(elapsed, 0.001);
        setEta(rate > 0 ? Math.max(s.totalDocs - offset, 0) / rate : null);
        setStatus(`Dateien: ${offset} / ${s.totalDocs}`);
        if (r.done || r.processed === 0) break;
      }

      setEta(null);
      setStatus("Termine, Lehrpläne und Links werden übertragen …");
      const f = await finish({ data: { email: checked } });

      setStatus("");
      toast.success(
        `Übertragen an ${f.email}: ${s.folders} Ordner, ${copied} Dateien, ${f.events} Termine, ${f.plans} Lehrpläne, ${f.tasks} Aufgaben, ${f.links} Links` +
          (failed ? ` (${failed} Dateien fehlgeschlagen)` : ""),
      );
      setConfirm("");
    } catch (e) {
      setStatus("");
      toast.error(e instanceof Error ? e.message : "Übertragung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const pct = total ? Math.min(100, Math.round((doneCount / total) * 100)) : 0;

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
            Kopiert Ordner, alle Dateien darin, Termine, Lehrpläne und Links zu <b>{checked}</b>.
            Deine eigenen Daten bleiben unverändert. Tippe zur Bestätigung „ÜBERTRAGEN“.
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

      {busy || status ? (
        <div className="space-y-2 rounded-2xl border border-border/60 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{status || "Läuft …"}</span>
            {eta !== null ? <span>Noch ca. {fmtDur(eta)}</span> : null}
          </div>
          <Progress value={pct} className="h-2" />
          {total ? (
            <p className="text-xs text-muted-foreground">
              {doneCount} von {total} Dateien ({pct}%)
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
