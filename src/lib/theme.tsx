import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemeMode = "light" | "dark";

export type ThemeSettings = {
  mode: ThemeMode;
  hue: number;
  chroma: number;
};

export const ACCENT_PRESETS: { id: string; label: string; hue: number; chroma: number }[] = [
  { id: "claude", label: "Claude", hue: 39, chroma: 0.13 },
  { id: "orange", label: "Orange", hue: 55, chroma: 0.16 },
  { id: "amber", label: "Bernstein", hue: 78, chroma: 0.15 },
  { id: "olive", label: "Olive", hue: 128, chroma: 0.1 },
  { id: "teal", label: "Petrol", hue: 195, chroma: 0.11 },
  { id: "indigo", label: "Indigo", hue: 275, chroma: 0.13 },
  { id: "rose", label: "Rosé", hue: 12, chroma: 0.14 },
];

const DEFAULTS: ThemeSettings = { mode: "light", hue: 39, chroma: 0.13 };
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
        void supabase.auth.getSession().then(({ data }) => {
          const uid = data.session?.user.id;
          if (!uid) return;
          void supabase.from("user_settings").upsert(
            {
              user_id: uid,
              theme_mode: next.mode,
              accent_hue: next.hue,
              accent: String(next.chroma),
            },
            { onConflict: "user_id" },
          );
        });
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
