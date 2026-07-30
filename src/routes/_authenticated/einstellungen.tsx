import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTheme, THEME_PRESETS } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – Farben & Darkmode" },
      {
        name: "description",
        content:
          "Passe Akzentfarbe, Glas-Intensität und Darkmode deines Archivs individuell an.",
      },
      { property: "og:title", content: "Einstellungen – Farben & Darkmode" },
      { property: "og:description", content: "Off-White, Orange und frei wählbare Akzente." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { mode, setMode, hue, chroma, setAccent, glass, setGlass } = useTheme();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="glass rounded-3xl p-5">
        <h1 className="text-lg font-semibold">Darstellung</h1>
        <p className="text-sm text-muted-foreground">
          Liquid Glass trifft auf ruhiges Off-White. Alles lässt sich anpassen.
        </p>
      </div>

      <section className="glass space-y-3 rounded-3xl p-5">
        <Label className="text-xs text-muted-foreground">Modus</Label>
        <div className="flex gap-2">
          {(
            [
              ["light", "Hell", Sun],
              ["dark", "Dunkel", Moon],
              ["system", "System", Monitor],
            ] as const
          ).map(([v, label, Icon]) => (
            <Button
              key={v}
              variant={mode === v ? "default" : "outline"}
              className="flex-1 rounded-2xl"
              onClick={() => setMode(v)}
            >
              <Icon className="size-4" /> {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="glass space-y-4 rounded-3xl p-5">
        <Label className="text-xs text-muted-foreground">Akzentfarbe</Label>
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => setAccent(p.hue, p.chroma)}
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
            onValueChange={([v]) => setAccent(v, chroma)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Farbintensität</Label>
          <Slider
            value={[chroma * 1000]}
            min={20}
            max={220}
            step={2}
            onValueChange={([v]) => setAccent(hue, v / 1000)}
          />
        </div>
      </section>

      <section className="glass space-y-2 rounded-3xl p-5">
        <Label className="text-xs text-muted-foreground">Glas-Intensität</Label>
        <Slider value={[glass]} min={0} max={100} step={1} onValueChange={([v]) => setGlass(v)} />
        <p className="text-xs text-muted-foreground">
          Steuert Unschärfe und Transparenz der Oberflächen.
        </p>
      </section>
    </div>
  );
}
