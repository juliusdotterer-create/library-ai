import { useState } from "react";
import { Bell, Pause, Play, Plus, Timer as TimerIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  addTimer,
  extendTimer,
  fmt,
  remainingOf,
  removeTimer,
  toggleTimer,
  useTick,
  useTimers,
} from "@/lib/timers";

export function StudyTimers({ defaultLabel = "" }: { defaultLabel?: string }) {
  const timers = useTimers();
  const [label, setLabel] = useState(defaultLabel);
  const [minutes, setMinutes] = useState(25);
  useTick();

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
    addTimer(label, minutes);
    setLabel(defaultLabel);
  };

  const sorted = [...timers].sort((a, b) => remainingOf(a) - remainingOf(b));

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
                  "animate-scale-in border-2 border-primary bg-primary/10 p-5 shadow-lg",
              )}
            >
              <TimerIcon className={cn(expired ? "size-7 text-primary" : "size-4 text-primary")} />
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
                  expired ? "text-2xl font-bold text-primary sm:text-3xl" : "text-sm",
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
                onClick={() => toggleTimer(t.id)}
              >
                {t.running ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-2xl"
                title="Um 5 Minuten verlängern"
                onClick={() => extendTimer(t.id, 5)}
              >
                +5
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-2xl"
                title="Um 15 Minuten verlängern"
                onClick={() => extendTimer(t.id, 15)}
              >
                +15
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl text-destructive"
                title="Timer löschen"
                onClick={() => removeTimer(t.id)}
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
