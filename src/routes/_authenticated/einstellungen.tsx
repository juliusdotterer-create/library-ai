import { createFileRoute } from "@tanstack/react-router";
import { Database, FileSearch, Trash2, UserRound } from "lucide-react";
import { SettingsSection } from "@/components/SettingsSection";
import { TrashPanel } from "@/components/TrashPanel";
import { ProfilePanel } from "@/components/ProfilePanel";
import { TextIndexPanel } from "@/components/TextIndexPanel";
import { ThemePanel } from "@/components/ThemePanel";
import { LocalDataPanel } from "@/components/LocalDataPanel";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="glass rounded-3xl p-5">
        <h1 className="text-lg font-semibold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Profil, Darstellung und Daten deines Archivs.</p>
      </div>

      <ThemePanel />

      <SettingsSection
        id="profile"
        title="Profil"
        description="Dein Anzeigename."
        icon={<UserRound className="size-4" />}
      >
        <ProfilePanel />
      </SettingsSection>

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
        id="local-data"
        title="Lokale Daten"
        description="Alles liegt nur in diesem Browser."
        icon={<Database className="size-4" />}
      >
        <LocalDataPanel />
      </SettingsSection>
    </div>
  );
}
