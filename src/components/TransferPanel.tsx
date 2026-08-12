import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, Check, X, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  createTransferRequest,
  listTransferRequests,
  respondToTransferRequest,
  cancelTransferRequest,
  type Scopes,
} from "@/lib/transfer.functions";

type Request = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  scopes: Scopes;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
  updated_at: string;
  expires_at: string;
  from_profile?: { display_name: string | null } | null;
  to_profile?: { display_name: string | null } | null;
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });


export function TransferPanel() {
  const { user } = useAuth();
  const userId = user?.id;
  const createReq = useServerFn(createTransferRequest);
  const listReq = useServerFn(listTransferRequests);
  const respond = useServerFn(respondToTransferRequest);
  const cancel = useServerFn(cancelTransferRequest);

  const [email, setEmail] = useState("");
  const [scopes, setScopes] = useState<Scopes>({
    library: true,
    calendar: true,
    plans: true,
    links: true,
  });
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);



  const load = async () => {
    const { requests } = await listReq();
    setRequests(requests);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const send = async () => {
    const value = email.trim().toLowerCase();
    if (!value.includes("@")) return toast.error("Bitte eine gültige E-Mail eintragen.");
    if (!scopes.library && !scopes.calendar && !scopes.plans && !scopes.links)
      return toast.error("Bitte mindestens einen Bereich auswählen.");
    setBusy(true);
    try {
      await createReq({ data: { email: value, scopes } });
      toast.success("Anfrage wurde gesendet – sofern die Adresse registriert ist.");
      setEmail("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const answer = async (id: string, action: "accept" | "reject") => {
    setActingId(id);
    try {
      const res = await respond({ data: { requestId: id, action } });
      if (action === "accept" && res.accepted) {
        toast.success(
          `Übertragung abgeschlossen: ${res.summary.folders} Ordner, ${res.summary.copied} Dateien, ${res.summary.events} Termine, ${res.summary.plans} Lehrpläne, ${res.summary.tasks} Aufgaben, ${res.summary.links} Links.` +
            (res.summary.failed ? ` (${res.summary.failed} Dateien fehlgeschlagen)` : ""),
        );
      } else {
        toast.success("Anfrage abgelehnt.");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Antwort fehlgeschlagen");
    } finally {
      setActingId(null);
    }
  };

  const remove = async (id: string) => {
    setActingId(id);
    try {
      await cancel({ data: { requestId: id } });
      toast.success("Anfrage zurückgezogen.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zurückziehen fehlgeschlagen");
    } finally {
      setActingId(null);
    }
  };

  const incoming = userId
    ? requests.filter((r) => r.status === "pending" && r.to_user_id === userId)
    : [];
  const outgoing = userId
    ? requests.filter((r) => r.status === "pending" && r.from_user_id === userId)
    : [];
  const history = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Daten an einen anderen Account senden</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="ziel@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl"
          />
          <Button className="rounded-2xl" onClick={send} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Anfrage senden
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Der andere Nutzer muss der Übertragung erst zustimmen. Es werden keine Daten kopiert, bevor er
          akzeptiert.
        </p>

        <div className="flex flex-wrap gap-3 py-1">
          {(
            [
              ["library", "Library (Ordner & Dateien)"],
              ["calendar", "Kalender"],
              ["plans", "Lehrpläne"],
              ["links", "Linktree"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={scopes[key]}
                onChange={(e) => setScopes((p) => ({ ...p, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Lade Anfragen …
        </div>
      ) : (
        <>
          {incoming.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Eingehende Anfragen</Label>
              <ul className="space-y-2">
                {incoming.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-2xl border border-border/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        Von {r.from_profile?.display_name ?? "Unbekannt"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bereiche: {scopeLabel(r.scopes)} · Gültig bis {fmtDate(r.expires_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-2xl"
                        onClick={() => answer(r.id, "reject")}
                        disabled={actingId !== null}
                      >
                        <X className="size-4" /> Ablehnen
                      </Button>
                      <Button size="sm" className="rounded-2xl" onClick={() => answer(r.id, "accept")} disabled={actingId !== null}>
                        {actingId === r.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Annehmen
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {outgoing.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Ausgehende Anfragen</Label>
              <ul className="space-y-2">
                {outgoing.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">An {r.to_profile?.display_name ?? r.to_user_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        Bereiche: {scopeLabel(r.scopes)} · Gültig bis {fmtDate(r.expires_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      onClick={() => remove(r.id)}
                      disabled={actingId !== null}
                      aria-label="Zurückziehen"
                    >
                      {actingId === r.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {history.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Verlauf</Label>
              <ul className="space-y-2">
                {history.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-border/60 p-3 text-sm text-muted-foreground"
                  >
                    {r.status === "accepted" ? "Angenommen" : r.status === "rejected" ? "Abgelehnt" : "Abgelaufen"} ·{" "}
                    {scopeLabel(r.scopes)} · {fmtDate(r.updated_at ?? r.created_at)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function scopeLabel(scopes: Scopes) {
  const parts: string[] = [];
  if (scopes.library) parts.push("Library");
  if (scopes.calendar) parts.push("Kalender");
  if (scopes.plans) parts.push("Lehrpläne");
  if (scopes.links) parts.push("Linktree");
  return parts.join(", ") || "–";
}
