import { useEffect, useRef, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { colorOf, endOf, layoutDay, type CalEvent } from "./types";

const HOUR = 48; // px pro Stunde
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const sameDay = (e: CalEvent, d: Date) => isSameDay(new Date(e.start_at), d);

export function DayWeekGrid({
  days,
  events,
  onSlot,
  onEvent,
  onDay,
}: {
  days: Date[];
  events: CalEvent[];
  onSlot: (d: Date) => void;
  onEvent: (e: CalEvent) => void;
  onDay?: (d: Date) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const h = Math.max(0, new Date().getHours() - 1);
    scroller.current?.scrollTo({ top: h * HOUR });
  }, [days.length]);

  const multi = days.length > 1;
  const allDay = days.map((d) => events.filter((e) => e.all_day && sameDay(e, d)));
  const hasAllDay = allDay.some((l) => l.length);
  const cols = `3rem repeat(${days.length}, minmax(${multi ? "5.5rem" : "0"}, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div className={cn(multi && "min-w-[42rem] sm:min-w-0")}>
        <div className="grid border-b border-border/60" style={{ gridTemplateColumns: cols }}>
          <span />
          {days.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => onDay?.(d)}
              className="flex flex-col items-center py-1.5"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {format(d, "EEE", { locale: de })}
              </span>
              <span
                className={cn(
                  "mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday(d) && "bg-primary text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </span>
            </button>
          ))}
        </div>
        {hasAllDay && (
          <div className="grid border-b border-border/60 py-1" style={{ gridTemplateColumns: cols }}>
            <span className="pr-1 text-right text-[9px] text-muted-foreground">ganztägig</span>
            {allDay.map((list, i) => (
              <div key={i} className="space-y-0.5 px-0.5">
                {list.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEvent(e)}
                    className={cn(
                      "block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-primary-foreground",
                      colorOf(e).solid,
                    )}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <div ref={scroller} className="max-h-[65dvh] overflow-y-auto">
          <div className="grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, h) => (
                <span
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: h * HOUR }}
                >
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const laid = layoutDay(events.filter((e) => !e.all_day && sameDay(e, d)));
              return (
                <div key={d.toISOString()} className="relative border-l border-border/60">
                  {Array.from({ length: 24 }, (_, h) => (
                    <button
                      key={h}
                      aria-label={`Termin um ${h}:00 anlegen`}
                      onClick={() => {
                        const t = new Date(d);
                        t.setHours(h, 0, 0, 0);
                        onSlot(t);
                      }}
                      className="absolute inset-x-0 border-t border-border/40 hover:bg-primary/5"
                      style={{ top: h * HOUR, height: HOUR }}
                    />
                  ))}
                  {laid.map(({ e, col, cols: n }) => {
                    const s = new Date(e.start_at);
                    const en = endOf(e);
                    const top = (s.getHours() + s.getMinutes() / 60) * HOUR;
                    const endH = isSameDay(en, s) ? en.getHours() + en.getMinutes() / 60 : 24;
                    const height = Math.max(20, endH * HOUR - top - 2);
                    return (
                      <button
                        key={e.id}
                        onClick={() => onEvent(e)}
                        className={cn(
                          "absolute overflow-hidden rounded-lg border-l-[3px] px-1.5 py-0.5 text-left text-foreground shadow-sm backdrop-blur-sm",
                          colorOf(e).soft,
                        )}
                        style={{
                          top: top + 1,
                          height,
                          left: `calc(${(col / n) * 100}% + 2px)`,
                          width: `calc(${100 / n}% - 4px)`,
                        }}
                      >
                        <p className="truncate text-[11px] font-semibold leading-tight">{e.title}</p>
                        {height > 30 && (
                          <p className="truncate text-[10px] text-muted-foreground">
                            {format(s, "HH:mm")}–{format(en, "HH:mm")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {isToday(d) && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
                      style={{ top: (now.getHours() + now.getMinutes() / 60) * HOUR }}
                    >
                      <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-destructive" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MonthGrid({
  month,
  events,
  onDay,
  onEvent,
}: {
  month: Date;
  events: CalEvent[];
  onDay: (d: Date) => void;
  onEvent: (e: CalEvent) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <div>
      <div className="mb-1 grid grid-cols-7">
        {WD.map((d, i) => (
          <span
            key={d}
            className={cn(
              "py-0.5 text-center text-[10px] font-semibold uppercase tracking-widest sm:text-xs",
              i >= 5 ? "text-muted-foreground/50" : "text-muted-foreground",
            )}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-border/60">
        {days.map((d) => {
          const list = events
            .filter((e) => sameDay(e, d))
            .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start_at.localeCompare(b.start_at));
          return (
            <div
              key={d.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onDay(d)}
              onKeyDown={(ev) => ev.key === "Enter" && onDay(d)}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col gap-0.5 border-b border-r border-border/40 p-0.5 transition-colors hover:bg-card/70 sm:min-h-24 sm:p-1",
                !isSameMonth(d, month) && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center self-center rounded-full text-[11px] font-medium sm:size-6 sm:self-start sm:text-xs",
                  isToday(d) && "bg-primary text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </span>
              {list.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEvent(e);
                  }}
                  className={cn(
                    "flex items-center gap-1 truncate rounded px-1 text-left text-[9px] font-medium sm:text-[11px]",
                    e.all_day ? cn(colorOf(e).solid, "text-primary-foreground") : "hover:bg-muted",
                  )}
                >
                  {!e.all_day && <span className={cn("size-1.5 shrink-0 rounded-full", colorOf(e).dot)} />}
                  <span className="truncate">
                    {!e.all_day && (
                      <span className="hidden text-muted-foreground sm:inline">
                        {format(new Date(e.start_at), "HH:mm")}{" "}
                      </span>
                    )}
                    {e.title}
                  </span>
                </button>
              ))}
              {list.length > 3 && (
                <span className="px-1 text-[9px] text-muted-foreground sm:text-[11px]">
                  +{list.length - 3} weitere
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearGrid({
  year,
  events,
  onMonth,
}: {
  year: Date;
  events: CalEvent[];
  onMonth: (m: Date) => void;
}) {
  const marked = new Set(events.map((e) => format(new Date(e.start_at), "yyyy-MM-dd")));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const month = new Date(year.getFullYear(), m, 1);
        const start = startOfWeek(month, { weekStartsOn: 1 });
        const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
        return (
          <button
            key={m}
            onClick={() => onMonth(month)}
            className="rounded-2xl p-2 text-left transition-colors hover:bg-card/70"
          >
            <p className="mb-1 text-sm font-semibold capitalize text-primary">
              {format(month, "LLLL", { locale: de })}
            </p>
            <div className="grid grid-cols-7 gap-y-0.5 text-center text-[9px] sm:text-[10px]">
              {WD.map((d) => (
                <span key={d} className="text-muted-foreground/60">
                  {d[0]}
                </span>
              ))}
              {days.map((d) => (
                <span key={d.toISOString()} className="relative flex justify-center">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full sm:size-5",
                      !isSameMonth(d, month) && "invisible",
                      isToday(d) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  {isSameMonth(d, month) && marked.has(format(d, "yyyy-MM-dd")) && (
                    <span className="absolute -bottom-0.5 size-1 rounded-full bg-primary" />
                  )}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
