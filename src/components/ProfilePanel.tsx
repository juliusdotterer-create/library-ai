import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleUserRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Anzeigename des lokalen Profils (ohne Konto, E-Mail oder Passwort). */
export function ProfilePanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(profile?.display_name ?? "");
      setLoading(false);
    })();
  }, [user]);

  const saveName = async () => {
    const name = displayName.trim();
    if (name.length < 2 || name.length > 50) {
      toast.error("Der Name muss zwischen 2 und 50 Zeichen lang sein.");
      return;
    }
    setSavingName(true);
    try {
      if (!user) throw new Error("Profil nicht geladen");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: name }, { onConflict: "id" });
      if (error) throw error;
      setDisplayName(name);
      toast.success("Name gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Profil wird geladen …
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CircleUserRound className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName || "Ohne Namen"}</p>
          <p className="truncate text-xs text-muted-foreground">Lokales Profil auf diesem Gerät</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Anzeigename</Label>
        <div className="flex gap-2">
          <Input
            value={displayName}
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Dein Name"
            className="rounded-2xl"
          />
          <Button className="rounded-2xl" onClick={saveName} disabled={savingName}>
            {savingName ? <Loader2 className="size-4 animate-spin" /> : "Speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
