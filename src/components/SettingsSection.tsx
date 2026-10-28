import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Einklappbare Bereiche für die Einstellungen.
 * Der offene/geschlossene Zustand bleibt pro Bereich auf dem Gerät gespeichert,
 * damit die Seite beim nächsten Besuch so bleibt, wie man sie verlassen hat.
 */
function usePersistentOpen(id: string, fallback: boolean) {
  const [open, setOpen] = useState(fallback);
  const key = `settings-open:${id}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setOpen(stored === "1");
    } catch {
      /* Speicher nicht verfügbar – dann bleibt es beim Standardwert. */
    }
  }, [key]);

  const change = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignorieren */
      }
    },
    [key],
  );

  return [open, change] as const;
}

type SectionProps = {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
};

/** Einklappbare Karte – im geschlossenen Zustand nur Titel, Beschreibung und Pfeil. */
export function SettingsSection({ id, title, description, icon, children }: SectionProps) {
  const [open, setOpen] = usePersistentOpen(id, false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="glass rounded-3xl px-5 py-4"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 text-left">
        {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          {description ? (
            <span className="block truncate text-sm text-muted-foreground">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-4">
        <div className="space-y-3 border-t border-field-border pt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type FieldProps = {
  id: string;
  title: string;
  value?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Unterbereich innerhalb einer Karte – zeigt im geschlossenen Zustand den aktuellen Wert. */
export function SettingsField({ id, title, value, defaultOpen = false, children }: FieldProps) {
  const [open, setOpen] = usePersistentOpen(id, defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="glass-soft rounded-2xl px-4 py-3"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {value ? (
            <span className="block truncate text-xs text-muted-foreground">{value}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3">
        <div className="space-y-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
