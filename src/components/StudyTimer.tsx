import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Pause, Play, Plus, Timer as TimerIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type StudyTimer = {
  id: string;
  label: string;
  /** epoch ms when the timer ends (only meaningful while running) */
  endsAt: number;
  /** remaining ms while paused */
  remaining: number;
  running: boolean;
  done: boolean;
};

const KEY = "library.timers";

function load(): StudyTimer[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StudyTimer[]) : [];
  } catch {
    return [];
  }
}

function fmt(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function StudyTimers({ defaultLabel = "" }: { defaultLabel?: string }) {
  const [timers, setTimers] = useState<StudyTimer[]>([]);
  const [label, setLabel] = useState(defaultLabel);
  const [minutes, setMinutes] = useState(25);
  const [, force] = useState(0);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => setTimers(load()), []);

  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(i);
  }, []);

  const persist = (next: StudyTimer[]) => {
    setTimers(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const remainingOf = (t: StudyTimer) => (t.running ? t.endsAt - Date.now() : t.remaining);

  // fire notifications
  useEffect(() => {
    for (const t of timers) {
      if (t.running && t.endsAt - Date.now() <= 0 && !notified.current.has(t.id)) {
        notified.current.add(t.id);
        toast.success(`Timer abgelaufen: ${t.label || "Lernzeit"}`, { duration: 10000 });
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Lern-Timer abgelaufen", { body: t.label || "Lernzeit beendet" });
          }
        } catch {
          /* ignore */
        }
        persist(
          timers.map((x) => (x.id === t.id ? { ...x, running: false, remaining: 0, done: true } : x)),
        );
      }
    }
  });

  const add = () => {
    void (async () => {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          await Notification.requestPermission();
        }
      } catch {
        /* ignore */
      }
    })();
    const ms = Math.max(1, minutes) * 60_000;
    persist([
      ...timers,
      {
        id: crypto.randomUUID(),
        label: label.trim() || "Lernzeit",
        endsAt: Date.now() + ms,
        remaining: ms,
        running: true,
        done: false,
      },
    ]);
    setLabel(defaultLabel);
  };

  const toggle = (t: StudyTimer) => {
    notified.current.delete(t.id);
    persist(
      timers.map((x) =>
        x.id !== t.id
          ? x
          : x.running
            ? { ...x, running: false, remaining: Math.max(0, x.endsAt - Date.now()) }
            : { ...x, running: true, done: false, endsAt: Date.now() + Math.max(1000, x.remaining) },
      ),
    );
  };

  const extend = (t: StudyTimer, min: number) => {
    notified.current.delete(t.id);
    persist(
      timers.map((x) =>
        x.id !== t.id
          ? x
          : x.running
            ? { ...x, done: false, endsAt: Math.max(Date.now(), x.endsAt) + min * 60_000 }
            : { ...x, done: false, remaining: Math.max(0, x.remaining) + min * 60_000 },
      ),
    );
  };

  const remove = (id: string) => {
    notified.current.delete(id);
    persist(timers.filter((x) => x.id !== id));
  };

  const sorted = useMemo(
    () => [...timers].sort((a, b) => remainingOf(a) - remainingOf(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timers],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Was lernst du?</Label>
          <Input
            className="h-9 rounded-2xl"
            placeholder="z. B. Dokument 1 durcharbeiten"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="w-24 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Minuten</Label>
          <Input
            type="number"
            min={1}
            className="h-9 rounded-2xl"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </div>
        <Button className="h-9 rounded-2xl" onClick={add}>
          <Plus className="size-4" /> Timer
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.map((t) => {
          const rest = remainingOf(t);
          const expired = rest <= 0;
          return (
            <div
              key={t.id}
              className={cn(
                "glass-soft flex flex-wrap items-center gap-2 rounded-2xl p-3 transition-all",
                expired &&
                  "animate-scale-in border-2 border-destructive bg-destructive/10 p-5 shadow-lg",
              )}
            >
              <TimerIcon
                className={cn(
                  expired ? "size-7 text-destructive" : "size-4 text-primary",
                )}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  expired ? "text-lg" : "text-sm",
                )}
              >
                {t.label}
              </span>
              <span
                className={cn(
                  "tabular-nums font-semibold",
                  expired ? "text-2xl font-bold text-destructive sm:text-3xl" : "text-sm",
                  !t.running && !expired && "opacity-60",
                )}
              >
                {expired ? "Abgelaufen!" : fmt(rest)}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl"
                title={t.running ? "Anhalten" : "Fortsetzen"}
                onClick={() => toggle(t)}
              >
                {t.running ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-2xl"
                title="Um 5 Minuten verlängern"
                onClick={() => extend(t, 5)}
              >
                +5
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-2xl"
                title="Um 15 Minuten verlängern"
                onClick={() => extend(t, 15)}
              >
                +15
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl text-destructive"
                title="Timer löschen"
                onClick={() => remove(t.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
        {!timers.length && (
          <p className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Bell className="size-4" /> Noch kein Timer aktiv.
          </p>
        )}
      </div>
    </div>
  );
}
