import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CircleUserRound, Loader2, Mail, KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isEmailAllowed } from "@/lib/access.functions";
import { useAuth } from "@/hooks/useAuth";

export function ProfilePanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(profile?.display_name ?? (user.email ?? "").split("@")[0] ?? "");
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
      const uid = user?.id;
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: uid, display_name: name }, { onConflict: "id" });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { display_name: name } });
      setDisplayName(name);
      toast.success("Name gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingName(false);
    }
  };

  const changeEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    if (email === currentEmail.toLowerCase()) {
      toast.error("Das ist bereits deine aktuelle Adresse.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await isEmailAllowed({ data: { email } });
      if (!res.allowed) {
        toast.error("Diese Adresse steht nicht auf der Zugangsliste. Bitte zuerst freischalten.");
        return;
      }
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: window.location.origin },
      );
      if (error) throw error;
      toast.success("Bestätigungsmail an die neue Adresse gesendet.");
      setNewEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Änderung fehlgeschlagen");
    } finally {
      setSavingEmail(false);
    }
  };

  const changePassword = async () => {
    if (pw1.length < 8) {
      toast.error("Das Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (pw1 !== pw2) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPw1("");
      setPw2("");
      toast.success("Passwort aktualisiert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Änderung fehlgeschlagen");
    } finally {
      setSavingPw(false);
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
          <p className="truncate text-xs text-muted-foreground">{currentEmail}</p>
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

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">E-Mail ändern</Label>
        <Input value={currentEmail} readOnly disabled className="rounded-2xl" />
        <div className="flex gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="neue@adresse.de"
            className="rounded-2xl"
          />
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={changeEmail}
            disabled={savingEmail}
          >
            {savingEmail ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            <span className="hidden sm:inline">Ändern</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Du erhältst eine Bestätigungsmail an die neue Adresse – erst nach dem Klick darin gilt sie.
          Wichtig: Die neue Adresse muss auf der Zugangsliste stehen, sonst kommst du danach nicht
          mehr rein.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Passwort ändern</Label>
        <Input
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="Neues Passwort"
          autoComplete="new-password"
          className="rounded-2xl"
        />
        <div className="flex gap-2">
          <Input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Wiederholen"
            autoComplete="new-password"
            className="rounded-2xl"
          />
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={changePassword}
            disabled={savingPw}
          >
            {savingPw ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            <span className="hidden sm:inline">Setzen</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
      </div>
    </div>
  );
}
