import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { id: string; email: string; note: string | null; created_at: string };

export function WhitelistPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("allowed_emails")
      .select("id,email,note,created_at")
      .order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    const value = email.trim().toLowerCase();
    if (!value.includes("@")) return toast.error("Bitte eine gültige E-Mail eintragen.");
    setBusy(true);
    const { error } = await supabase
      .from("allowed_emails")
      .insert({ email: value, note: note.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEmail("");
    setNote("");
    void load();
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`${row.email} wirklich von der Whitelist entfernen?`)) return;
    const { error } = await supabase.from("allowed_emails").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="name@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl"
        />
        <Input
          placeholder="Notiz (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-2xl sm:max-w-[40%]"
        />
        <Button className="rounded-2xl" disabled={busy} onClick={add}>
          <Plus className="size-4" /> Freischalten
        </Button>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{r.email}</p>
              {r.note ? <p className="truncate text-xs text-muted-foreground">{r.note}</p> : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => remove(r)}
              aria-label="Entfernen"
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground">Noch keine Adressen freigeschaltet.</li>
        ) : null}
      </ul>
    </div>
  );
}
