import { Bell, Pause, Play, Plus, Timer as TimerIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  startStudyTimer,
  extendTimer,
  fmt,
  remainingOf,
  removeTimer,
  toggleTimer,
  useTick,
  useTimers,
} from "@/lib/timers";

/**
 * Laufende Lern-Timer plus Dauer-Einstellung. Timer werden an den Aufgaben gestartet
 * (Uhr-Symbol in der Aufgabenliste), damit es nur ein Feld für „was lerne ich“ gibt.
 */
export function StudyTimers({
  minutes,
  onMinutesChange,
}: {
  minutes: number;
  onMinutesChange: (minutes: number) => void;
}) {
  const timers = useTimers();
  useTick();

  const sorted = [...timers].sort((a, b) => remainingOf(a) - remainingOf(b));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="timer-minutes" className="text-xs text-muted-foreground">
          Timer-Dauer
        </Label>
        <Input
          id="timer-minutes"
          type="number"
          min={1}
          className="h-8 w-20 rounded-2xl"
          value={minutes}
          onChange={(e) => onMinutesChange(Number(e.target.value))}
        />
        <span className="text-xs text-muted-foreground">Minuten</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto rounded-2xl"
          onClick={() => startStudyTimer("Lernzeit", minutes)}
        >
          <Plus className="size-4" /> Timer ohne Aufgabe
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
            <Bell className="size-4" /> Noch kein Timer aktiv. Starte ihn mit der Uhr an einer Aufgabe.
          </p>
        )}
      </div>
    </div>
  );
}
