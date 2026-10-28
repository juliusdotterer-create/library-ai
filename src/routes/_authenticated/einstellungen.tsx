import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Bot,
  FileSearch,
  GitCompareArrows,
  Globe,
  HardDrive,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/SettingsSection";
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
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="glass rounded-3xl p-5">
        <h1 className="text-lg font-semibold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Profil, Quellen, Verbindungen und Darstellung deines Archivs.
        </p>
      </div>

      <ThemePanel />

      <SettingsSection
        id="profile"
        title="Profil"
        description="Name, E-Mail-Adresse und Passwort deines Accounts."
        icon={<UserRound className="size-4" />}
      >
        <ProfilePanel isAdmin={isAdmin} />
      </SettingsSection>

      <SettingsSection
        id="web-sources"
        title="Internetsuche – Quellen"
        description="Lege fest, wo „Auch im Internet suchen“ nachschaut."
        icon={<Globe className="size-4" />}
      >
        <WebSourcesPanel />
      </SettingsSection>

      <SettingsSection
        id="agent"
        title="Mit Agent verbinden"
        description="ChatGPT, Claude, Anara oder andere MCP-Clients verbinden."
        icon={<Bot className="size-4" />}
      >
        <AgentConnectPanel />
      </SettingsSection>

      <SettingsSection
        id="drive"
        title="Google Drive"
        description="Dateien aus Drive verknüpfen – sie bleiben in Drive liegen."
        icon={<HardDrive className="size-4" />}
      >
        <DrivePanel />
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
      </SettingsSection>

      <SettingsSection
        id="drive-mirror"
        title="Ordner spiegeln"
        description="Einen Drive-Ordner mit einem Library-Ordner abgleichen."
        icon={<GitCompareArrows className="size-4" />}
      >
        <DriveMirrorPanel />
      </SettingsSection>

      {isAdmin ? (
        <SettingsSection
          id="whitelist"
          title="Zugang / Whitelist"
          description="Nur diese E-Mail-Adressen können sich anmelden oder registrieren."
          icon={<ShieldCheck className="size-4" />}
        >
          <WhitelistPanel />
        </SettingsSection>
      ) : null}

      <SettingsSection
        id="trash"
        title="Papierkorb"
        description="Wiederherstellen oder endgültig löschen."
        icon={<Trash2 className="size-4" />}
      >
        <TrashPanel />
      </SettingsSection>

      <SettingsSection
        id="text-index"
        title="Volltextsuche"
        description="Ältere Dokumente durchsuchbar machen, Scans per Texterkennung."
        icon={<FileSearch className="size-4" />}
      >
        <TextIndexPanel />
      </SettingsSection>

      <SettingsSection
        id="transfer"
        title="Daten an anderen Account übertragen"
        description="Ordner, Dateien, Termine und Links in einen anderen Account kopieren."
        icon={<ArrowRightLeft className="size-4" />}
      >
        <TransferPanel />
      </SettingsSection>
    </div>
  );
}
