import { useEffect, useRef } from "react";
import { Pause, Play, Timer as TimerIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acknowledgeTimer,
  extendTimer,
  fmt,
  remainingOf,
  removeTimer,
  toggleTimer,
  useTick,
  useTimers,
  type StudyTimer,
} from "@/lib/timers";

/** Watches all timers app-wide: fires notifications and renders the expiry overlay. */
export function GlobalTimerWatcher() {
  const timers = useTimers();
  useTick();
  const notified = useRef<Set<string>>(new Set());

  const expired = timers.filter((t) => remainingOf(t) <= 0 && !t.done);

  useEffect(() => {
    for (const t of expired) {
      if (notified.current.has(t.id)) continue;
      notified.current.add(t.id);
      toast.success(`Timer abgelaufen: ${t.label || "Lernzeit"}`, { duration: 10000 });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Lern-Timer abgelaufen", { body: t.label || "Lernzeit beendet" });
        }
      } catch {
        /* ignore */
      }
    }
    for (const id of [...notified.current]) {
      if (!expired.some((t) => t.id === id)) notified.current.delete(id);
    }
  }, [expired]);

  if (!expired.length) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass animate-scale-in w-full max-w-md space-y-5 rounded-3xl border-2 border-primary p-6 text-center">
        <TimerIcon className="mx-auto size-12 text-primary" />
        <div className="space-y-1">
          <p className="text-3xl font-bold text-primary">Zeit abgelaufen!</p>
          {expired.map((t) => (
            <p key={t.id} className="text-lg font-medium">
              {t.label}
            </p>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            className="rounded-2xl"
            onClick={() => expired.forEach((t) => acknowledgeTimer(t.id))}
          >
            Verstanden
          </Button>
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => expired.forEach((t) => extendTimer(t.id, 5))}
          >
            +5 Min
          </Button>
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => expired.forEach((t) => extendTimer(t.id, 15))}
          >
            +15 Min
          </Button>
          <Button
            variant="ghost"
            className="rounded-2xl text-destructive"
            onClick={() => expired.forEach((t) => removeTimer(t.id))}
          >
            Löschen
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Compact running-timer pill for the header (hidden on the Lehrpläne page). */
export function HeaderTimers() {
  const timers = useTimers();
  useTick();

  const active: StudyTimer[] = [...timers].sort((a, b) => remainingOf(a) - remainingOf(b));
  if (!active.length) return null;
  const t = active[0];
  const rest = remainingOf(t);

  return (
    <div className="glass-soft flex shrink-0 items-center gap-1.5 rounded-2xl px-2 py-1">
      <TimerIcon className="size-4 shrink-0 text-primary" />
      <span className="hidden max-w-28 truncate text-xs font-medium md:inline">{t.label}</span>
      <span className="tabular-nums text-sm font-semibold">{fmt(Math.max(0, rest))}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-xl"
        title={t.running ? "Anhalten" : "Fortsetzen"}
        onClick={() => toggleTimer(t.id)}
      >
        {t.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
      {active.length > 1 && (
        <span className="text-xs text-muted-foreground">+{active.length - 1}</span>
      )}
    </div>
  );
}
