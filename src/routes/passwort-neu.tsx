import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/passwort-neu")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Neues Passwort setzen – Library Studienarchiv" },
      {
        name: "description",
        content: "Setze über den Link aus deiner E-Mail ein neues Passwort für dein Library-Konto.",
      },
      { property: "og:title", content: "Neues Passwort setzen – Library Studienarchiv" },
      {
        property: "og:description",
        content: "Vergebe ein neues Passwort für dein persönliches Studienarchiv.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async () => {
    if (pw1.length < 8) return toast.error("Das Passwort muss mindestens 8 Zeichen haben.");
    if (pw1 !== pw2) return toast.error("Die beiden Passwörter stimmen nicht überein.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Passwort aktualisiert");
    navigate({ to: "/library", replace: true, search: { folder: undefined, create: undefined } });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-[2rem] p-7">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Neues Passwort</h1>
            <p className="text-sm text-muted-foreground">Vergebe ein neues Passwort für dein Konto.</p>
          </div>
        </div>

        {ready ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Neues Passwort</Label>
              <Input
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Wiederholen</Label>
              <Input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <Button className="w-full rounded-2xl" disabled={busy} onClick={save}>
              Passwort speichern
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Öffne den Link aus der E-Mail „Passwort zurücksetzen“, damit du hier ein neues
              Passwort vergeben kannst. Der Link ist nur eine begrenzte Zeit gültig.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-2xl"
              onClick={() => navigate({ to: "/auth", search: {} })}
            >
              Zur Anmeldung
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
