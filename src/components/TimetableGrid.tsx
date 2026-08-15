import { useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useTimetable } from "@/hooks/useLibrary";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TimetableDialog,
  WEEKDAYS,
  WEEKDAY_LONG,
  colorBlockClass,
  type TimetableDraft,
  type TimetableEntry,
} from "@/components/TimetableDialog";

const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hhmm = (t: string) => t.slice(0, 5);

const PX_PER_MIN = 1;

export function TimetableGrid() {
  const isMobile = useIsMobile();
  const { data, isLoading } = useTimetable();
  const entries = (data ?? []) as TimetableEntry[];
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<TimetableEntry | null>(null);
  const [draft, setDraft] = useState<TimetableDraft | null>(null);
  const [day, setDay] = useState(() => {
    const js = new Date().getDay();
    return js === 0 ? 7 : js;
  });

  const days = useMemo(() => {
    const base = [1, 2, 3, 4, 5];
    for (const d of [6, 7]) if (entries.some((e) => e.weekday === d)) base.push(d);
    return base;
  }, [entries]);

  const bounds = useMemo(() => {
    let start = 7 * 60;
    let end = 20 * 60;
    for (const e of entries) {
      start = Math.min(start, Math.floor(toMin(e.start_time) / 60) * 60);
      end = Math.max(end, Math.ceil(toMin(e.end_time) / 60) * 60);
    }
    return { start, end };
  }, [entries]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let m = bounds.start; m < bounds.end; m += 60) out.push(m);
    return out;
  }, [bounds]);

  const openNew = (weekday: number, startMin: number) => {
    setEntry(null);
    setDraft({
      weekday,
      start_time: fromMin(startMin),
      end_time: fromMin(Math.min(startMin + 90, 23 * 60 + 59)),
    });
    setOpen(true);
  };

  const openEdit = (e: TimetableEntry) => {
    setEntry(e);
    setDraft(null);
    setOpen(true);
  };

  const dialog = (
    <TimetableDialog open={open} onOpenChange={setOpen} entry={entry} draft={draft} />
  );

  if (isLoading) {
    return <div className="glass rounded-3xl p-6 text-sm text-muted-foreground">Lädt …</div>;
  }

  if (!entries.length) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
        <CalendarDays className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Noch kein Stundenplan angelegt. Trage deine wiederkehrenden Termine ein.
        </p>
        <Button className="rounded-2xl" onClick={() => openNew(1, 8 * 60)}>
          <Plus className="mr-2 size-4" /> Eintrag hinzufügen
        </Button>
        {dialog}
      </div>
    );
  }

  if (isMobile) {
    const dayEntries = entries.filter((e) => e.weekday === day);
    return (
      <div className="glass rounded-3xl p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex flex-1 gap-1 overflow-x-auto">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={cn(
                  "rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors",
                  d === day ? "bg-primary text-primary-foreground" : "bg-card/50",
                )}
              >
                {WEEKDAYS[d - 1]}
              </button>
            ))}
          </div>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-2xl"
            onClick={() => openNew(day, 8 * 60)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {dayEntries.map((e) => (
            <button
              key={e.id}
              onClick={() => openEdit(e)}
              className={cn("w-full rounded-2xl p-3 text-left", colorBlockClass(e.color))}
            >
              <p className="truncate text-sm font-medium">{e.title}</p>
              <p className="text-[11px] opacity-80">
                {hhmm(e.start_time)}–{hhmm(e.end_time)}
                {e.room ? ` · ${e.room}` : ""}
                {e.teacher ? ` · ${e.teacher}` : ""}
              </p>
            </button>
          ))}
          {!dayEntries.length && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Keine Einträge an diesem Tag.
            </p>
          )}
        </div>
        {dialog}
      </div>
    );
  }

  const height = (bounds.end - bounds.start) * PX_PER_MIN;

  return (
    <div className="glass rounded-3xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Wochenübersicht</h2>
        <Button size="sm" className="rounded-2xl" onClick={() => openNew(1, 8 * 60)}>
          <Plus className="mr-2 size-4" /> Eintrag
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[42rem]">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}
          >
            <span />
            {days.map((d) => (
              <span key={d} className="pb-1 text-center text-xs font-medium text-muted-foreground">
                {WEEKDAY_LONG[d - 1]}
              </span>
            ))}
          </div>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}
          >
            <div className="relative" style={{ height }}>
              {hours.map((m) => (
                <span
                  key={m}
                  className="absolute right-1 -translate-y-1/2 text-[11px] text-muted-foreground"
                  style={{ top: (m - bounds.start) * PX_PER_MIN }}
                >
                  {fromMin(m)}
                </span>
              ))}
            </div>
            {days.map((d) => (
              <div
                key={d}
                className="relative rounded-2xl bg-card/40"
                style={{ height }}
              >
                {hours.map((m) => (
                  <button
                    key={m}
                    aria-label={`${WEEKDAY_LONG[d - 1]} ${fromMin(m)} – Eintrag hinzufügen`}
                    onClick={() => openNew(d, m)}
                    className="absolute inset-x-0 border-t border-border/40 transition-colors hover:bg-primary/5"
                    style={{ top: (m - bounds.start) * PX_PER_MIN, height: 60 * PX_PER_MIN }}
                  />
                ))}
                {entries
                  .filter((e) => e.weekday === d)
                  .map((e) => {
                    const top = (toMin(e.start_time) - bounds.start) * PX_PER_MIN;
                    const h = Math.max((toMin(e.end_time) - toMin(e.start_time)) * PX_PER_MIN, 24);
                    return (
                      <button
                        key={e.id}
                        onClick={() => openEdit(e)}
                        className={cn(
                          "absolute inset-x-1 overflow-hidden rounded-xl p-1.5 text-left text-[11px] shadow-sm",
                          colorBlockClass(e.color),
                        )}
                        style={{ top, height: h }}
                      >
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="block truncate opacity-80">
                          {hhmm(e.start_time)}–{hhmm(e.end_time)}
                        </span>
                        {(e.room || e.teacher) && (
                          <span className="block truncate opacity-70">
                            {[e.room, e.teacher].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}
