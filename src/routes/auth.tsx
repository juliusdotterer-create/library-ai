import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden – Library Studienarchiv" },
      {
        name: "description",
        content:
          "Melde dich an, um deine Dokumente, Termine, Lehrpläne und Links im persönlichen Archiv zu verwalten.",
      },
      { property: "og:title", content: "Anmelden – Library Studienarchiv" },
      {
        property: "og:description",
        content: "Dein privater Ort für PDFs, Klausuren, Termine und Lernpläne.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("access_blocked") === "1") {
      window.localStorage.removeItem("access_blocked");
      setBlocked(true);
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/library", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/library", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const signUp = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) toast.success("Fast geschafft – bestätige bitte die E-Mail in deinem Postfach.");
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google-Anmeldung fehlgeschlagen.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-[2rem] p-7">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Library</h1>
            <p className="text-sm text-muted-foreground">Dokumente, Termine & Lernpläne</p>
          </div>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="mb-5 grid w-full grid-cols-2 rounded-2xl">
            <TabsTrigger value="login" className="rounded-xl">
              Anmelden
            </TabsTrigger>
            <TabsTrigger value="signup" className="rounded-xl">
              Registrieren
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-3">
            <Field label="E-Mail" value={email} onChange={setEmail} type="email" />
            <Field label="Passwort" value={password} onChange={setPassword} type="password" />
            <Button className="w-full rounded-2xl" disabled={busy} onClick={signIn}>
              Anmelden
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-3">
            <Field label="Anzeigename" value={name} onChange={setName} />
            <Field label="E-Mail" value={email} onChange={setEmail} type="email" />
            <Field label="Passwort" value={password} onChange={setPassword} type="password" />
            <Button className="w-full rounded-2xl" disabled={busy} onClick={signUp}>
              Konto erstellen
            </Button>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> oder <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full rounded-2xl" onClick={google}>
          Mit Google fortfahren
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl"
      />
    </div>
  );
}
