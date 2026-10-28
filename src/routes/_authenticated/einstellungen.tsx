import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrashPanel } from "@/components/TrashPanel";
import { TransferPanel } from "@/components/TransferPanel";
import { WhitelistPanel } from "@/components/WhitelistPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { DrivePanel } from "@/components/DrivePanel";
import { DriveMirrorPanel } from "@/components/DriveMirrorPanel";
import { TextIndexPanel } from "@/components/TextIndexPanel";
import { WebSourcesPanel } from "@/components/WebSourcesPanel";
import { AgentConnectPanel } from "@/components/AgentConnectPanel";
import { ThemePanel } from "@/components/ThemePanel";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";




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
        <h1 className="text-lg font-semibold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Profil, Quellen, Verbindungen und Darstellung deines Archivs.
        </p>
      </div>

      <ThemePanel />

      <section className="glass space-y-3 rounded-3xl p-5">
        <div>
          <h2 className="font-semibold">Profil</h2>
          <p className="text-sm text-muted-foreground">
            Name, E-Mail-Adresse und Passwort deines Accounts.
          </p>
        </div>
        <ProfilePanel isAdmin={isAdmin} />
      </section>

      <section className="glass space-y-3 rounded-3xl p-5">
        <div>
          <h2 className="font-semibold">Internetsuche – Quellen</h2>
          <p className="text-sm text-muted-foreground">
            Lege fest, wo „Auch im Internet suchen“ nachschaut.
          </p>
        </div>
        <WebSourcesPanel />
      </section>

      <section className="glass space-y-3 rounded-3xl p-5">
        <div>
          <h2 className="font-semibold">Mit Agent verbinden</h2>
          <p className="text-sm text-muted-foreground">
            Verbinde ChatGPT, Claude, Anara oder einen anderen MCP-Client mit deiner Library.
          </p>
        </div>
        <AgentConnectPanel />
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
