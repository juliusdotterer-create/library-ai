import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TrashPanel } from "@/components/TrashPanel";
import { TransferPanel } from "@/components/TransferPanel";
import { WhitelistPanel } from "@/components/WhitelistPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { DrivePanel } from "@/components/DrivePanel";
import { DriveMirrorPanel } from "@/components/DriveMirrorPanel";
import { TextIndexPanel } from "@/components/TextIndexPanel";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, ACCENT_PRESETS } from "@/lib/theme";
import { cn } from "@/lib/utils";



export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – Farben & Darkmode" },
      {
        name: "description",
        content: "Passe Akzentfarbe, Farbintensität und Darkmode deines Archivs individuell an.",
      },
      { property: "og:title", content: "Einstellungen – Farben & Darkmode" },
      { property: "og:description", content: "Off-White, Orange und frei wählbare Akzente." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode, hue, chroma, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(Boolean(roles));
    })();
  }, [user]);




  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="glass rounded-3xl p-5">
        <h1 className="text-lg font-semibold">Darstellung</h1>
        <p className="text-sm text-muted-foreground">
          Passe Modus, Akzentfarbe und Intensität deines Archivs an.
        </p>
      </div>

      <section className="glass space-y-3 rounded-3xl p-5">
        <div>
          <h2 className="font-semibold">Profil</h2>
          <p className="text-sm text-muted-foreground">
            Name, E-Mail-Adresse und Passwort deines Accounts.
          </p>
        </div>
        <ProfilePanel />
      </section>

      <section className="glass space-y-3 rounded-3xl p-5">
        <div>
          <h2 className="font-semibold">Google Drive</h2>
          <p className="text-sm text-muted-foreground">
            Verknüpfe Dateien aus deinem Google Drive mit der Library. Sie bleiben in Drive liegen
            und werden hier nur geöffnet und durchsucht.
          </p>
        </div>
        <DrivePanel />
        <DriveMirrorPanel />
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-2xl text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void navigate({ to: "/library", search: { newsDemo: true } })}
          >
            <Sparkles className="size-3.5" />
            Beispielansicht öffnen
          </Button>
        </div>
      </section>




      <section className="glass space-y-3 rounded-3xl p-5">
        <Label className="text-xs text-muted-foreground">Modus</Label>
        <div className="flex gap-2">
          {(
            [
              ["light", "Hell", Sun],
              ["dark", "Dunkel", Moon],
            ] as const
          ).map(([v, label, Icon]) => (
            <Button
              key={v}
              variant={mode === v ? "default" : "outline"}
              className="flex-1 rounded-2xl"
              onClick={() => setTheme({ mode: v })}
            >
              <Icon className="size-4" /> {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="glass space-y-4 rounded-3xl p-5">
        <Label className="text-xs text-muted-foreground">Akzentfarbe</Label>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setTheme({ hue: p.hue, chroma: p.chroma })}
              title={p.label}
              className={cn(
                "size-10 rounded-2xl border-2 transition-transform hover:scale-105",
                Math.round(hue) === p.hue ? "border-foreground" : "border-transparent",
              )}
              style={{ background: `oklch(0.68 ${p.chroma} ${p.hue})` }}
              aria-label={p.label}
            />
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Farbton fein justieren</Label>
          <Slider
            value={[hue]}
            min={0}
            max={360}
            step={1}
            onValueChange={([v]) => setTheme({ hue: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Farbintensität</Label>
          <Slider
            value={[chroma * 1000]}
            min={20}
            max={220}
            step={2}
            onValueChange={([v]) => setTheme({ chroma: v / 1000 })}
          />
        </div>

        <div
          className="rounded-2xl p-4 text-sm"
          style={{ background: `oklch(0.68 ${chroma} ${hue})`, color: "oklch(0.99 0 0)" }}
        >
          Vorschau der Akzentfarbe
        </div>
      </section>

      {isAdmin ? (
        <section className="glass space-y-3 rounded-3xl p-5">
          <div>
            <h2 className="font-semibold">Zugang / Whitelist</h2>
            <p className="text-sm text-muted-foreground">
              Nur diese E-Mail-Adressen können sich anmelden oder registrieren.
            </p>
          </div>
          <WhitelistPanel />
        </section>
      ) : null}

      <section className="glass space-y-3 rounded-3xl p-5">
        <div>
          <h2 className="font-semibold">Papierkorb</h2>
          <p className="text-sm text-muted-foreground">
            Wiederherstellen oder endgültig löschen – dafür musst du den Namen exakt eintippen.
          </p>
        </div>
        <TrashPanel />
      </section>

      <TextIndexPanel />


      <section className="glass space-y-3 rounded-3xl p-5">
        <div>
          <h2 className="font-semibold">Daten an anderen Account übertragen</h2>
          <p className="text-sm text-muted-foreground">
            Kopiert deine Ordner, Dateien, Termine, Lehrpläne und Links in einen anderen, bereits
            registrierten Account.
          </p>
        </div>
        <TransferPanel />
      </section>


    </div>

  );
}
