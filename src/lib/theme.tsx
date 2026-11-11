import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark";

export type ThemeSettings = {
  mode: ThemeMode;
  hue: number;
  chroma: number;
  /** Gewählte Akzentfarbe (id aus ACCENT_PRESETS). */
  accent?: string;
};

export type AccentPreset = {
  id: string;
  label: string;
  hue: number;
  chroma: number;
  /** Helligkeit der Akzentfarbe im hellen / dunklen Modus (Standard 0.645 / 0.71). */
  light?: number;
  dark?: number;
};

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "claude", label: "Claude", hue: 39, chroma: 0.13 },
  { id: "orange", label: "Orange", hue: 55, chroma: 0.16 },
  { id: "amber", label: "Bernstein", hue: 78, chroma: 0.15 },
  { id: "olive", label: "Olive", hue: 128, chroma: 0.1 },
  { id: "teal", label: "Petrol", hue: 195, chroma: 0.11 },
  { id: "indigo", label: "Indigo", hue: 275, chroma: 0.13 },
  { id: "rose", label: "Rosé", hue: 12, chroma: 0.14 },
  // Neutral: Schwarz wird im Dunkelmodus zu fast Weiß, damit es sichtbar bleibt.
  { id: "graphite", label: "Grau", hue: 80, chroma: 0.006, light: 0.52, dark: 0.72 },
  { id: "black", label: "Schwarz", hue: 80, chroma: 0.004, light: 0.22, dark: 0.93 },
];

/** Findet die Akzentfarbe zu gespeicherten Einstellungen (auch ältere ohne `accent`). */
export function presetOf(settings: Pick<ThemeSettings, "accent" | "hue" | "chroma">): AccentPreset | undefined {
  return (
    ACCENT_PRESETS.find((p) => p.id === settings.accent) ??
    ACCENT_PRESETS.find(
      (p) => Math.round(settings.hue) === p.hue && Math.abs(settings.chroma - p.chroma) < 0.02,
    )
  );
}

/** CSS-Farbe einer Akzentfarbe für Vorschauen. */
export function presetColor(p: AccentPreset, mode: ThemeMode = "light") {
  const l = mode === "dark" ? (p.dark ?? 0.71) : (p.light ?? 0.645);
  return `oklch(${l} ${p.chroma} ${p.hue})`;
}

const DEFAULTS: ThemeSettings = { mode: "light", hue: 39, chroma: 0.13, accent: "claude" };
const STORAGE_KEY = "archiv.theme";

type ThemeContextValue = ThemeSettings & {
  setTheme: (patch: Partial<ThemeSettings>) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  ...DEFAULTS,
  setTheme: () => {},
  toggleMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function apply(settings: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", settings.mode === "dark");
  root.style.setProperty("--accent-h", String(settings.hue));
  root.style.setProperty("--accent-c", String(settings.chroma));
  const preset = presetOf(settings);
  root.style.setProperty("--accent-l", String(preset?.light ?? 0.645));
  root.style.setProperty("--accent-l-dark", String(preset?.dark ?? 0.71));
  root.style.colorScheme = settings.mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULTS, ...JSON.parse(raw) } as ThemeSettings;
        setSettings(parsed);
        apply(parsed);
        return;
      }
    } catch {
      /* ignore */
    }
    apply(DEFAULTS);
  }, []);

  const setTheme = useMemo(
    () => (patch: Partial<ThemeSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        apply(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const value: ThemeContextValue = {
    ...settings,
    setTheme,
    toggleMode: () => setTheme({ mode: settings.mode === "dark" ? "light" : "dark" }),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
