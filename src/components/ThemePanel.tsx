import { ChevronDown, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SettingsField, usePersistentOpen } from "@/components/SettingsSection";
import { useTheme, ACCENT_PRESETS, presetColor, presetOf } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Darstellung – kompakt als Pulldown, damit die Einstellungsseite kurz bleibt.
 * Im geschlossenen Zustand zeigt die Zeile Modus und aktuelle Akzentfarbe.
 * Die einzelnen Felder (Modus, Akzentfarbe) sind zusätzlich für sich einklappbar.
 */
export function ThemePanel() {
  const { mode, hue, chroma, accent: accentId, darkPages, setTheme } = useTheme();
  const [open, setOpen] = usePersistentOpen("theme", false);

  const preset = presetOf({ accent: accentId, hue, chroma });
  const accent = preset ? presetColor(preset, mode) : `oklch(0.68 ${chroma} ${hue})`;

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
                  onClick={() => setTheme({ hue: p.hue, chroma: p.chroma, accent: p.id })}
                  title={p.label}
                  aria-pressed={preset?.id === p.id}
                  className={cn(
                    "size-10 rounded-2xl border-2 transition-transform hover:scale-105",
                    preset?.id === p.id ? "border-foreground" : "border-field-border/60",
                  )}
                  style={{ background: presetColor(p, mode) }}
                  aria-label={p.label}
                />
              ))}
            </div>
          </SettingsField>

          <SettingsField
            id="theme-dark-pages"
            title="Dokumente im Dunkelmodus"
            value={darkPages === false ? "Hell lassen" : "Abdunkeln"}
          >
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="dark-pages" className="text-sm font-normal text-muted-foreground">
                PDF-Seiten und Notizpapier im Dunkelmodus dunkel anzeigen (helle Schrift auf dunklem
                Grund). Gespeicherte Dateien bleiben unverändert.
              </Label>
              <Switch
                id="dark-pages"
                checked={darkPages !== false}
                onCheckedChange={(v) => setTheme({ darkPages: v })}
              />
            </div>
          </SettingsField>

        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
