import { useState } from "react";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SettingsField } from "@/components/SettingsSection";
import { useTheme, ACCENT_PRESETS } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Darstellung – kompakt als Pulldown, damit die Einstellungsseite kurz bleibt.
 * Im geschlossenen Zustand zeigt die Zeile Modus und aktuelle Akzentfarbe.
 * Die einzelnen Felder (Modus, Farben, Akzente) sind zusätzlich für sich einklappbar.
 */
export function ThemePanel() {
  const { mode, hue, chroma, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const preset = ACCENT_PRESETS.find((p) => Math.round(hue) === p.hue);
  const accent = `oklch(0.68 ${chroma} ${hue})`;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="glass rounded-3xl px-5 py-4"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-3 text-left">
        <span
          className="size-8 shrink-0 rounded-2xl border border-field-border"
          style={{ background: accent }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Darstellung</span>
          <span className="block truncate text-sm text-muted-foreground">
            {mode === "dark" ? "Dunkel" : "Hell"}
            {" · "}
            {preset ? preset.label : "Eigener Akzent"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-4">
        <div className="space-y-2 border-t border-field-border pt-4">
          <SettingsField
            id="theme-mode"
            title="Modus"
            value={mode === "dark" ? "Dunkel" : "Hell"}
          >
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
          </SettingsField>

          <SettingsField
            id="theme-accent"
            title="Akzentfarbe"
            value={
              <span className="flex items-center gap-1.5">
                <span
                  className="size-3 shrink-0 rounded-full border border-field-border"
                  style={{ background: accent }}
                  aria-hidden
                />
                {preset ? preset.label : "Eigener Akzent"}
              </span>
            }
          >
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
            <div
              className="mt-1 rounded-2xl p-4 text-sm"
              style={{ background: accent, color: "oklch(0.99 0 0)" }}
            >
              Vorschau der Akzentfarbe
            </div>
          </SettingsField>

          <SettingsField
            id="theme-hue"
            title="Farbton fein justieren"
            value={`${Math.round(hue)}°`}
          >
            <Slider
              value={[hue]}
              min={0}
              max={360}
              step={1}
              onValueChange={([v]) => setTheme({ hue: v })}
            />
          </SettingsField>

          <SettingsField
            id="theme-chroma"
            title="Farbintensität"
            value={`${Math.round(chroma * 1000)}`}
          >
            <Slider
              value={[chroma * 1000]}
              min={20}
              max={220}
              step={2}
              onValueChange={([v]) => setTheme({ chroma: v / 1000 })}
            />
          </SettingsField>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
