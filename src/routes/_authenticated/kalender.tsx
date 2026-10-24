import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { de } from "date-fns/locale";
import { CalendarArrowUp, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvents } from "@/hooks/useLibrary";
import { Button } from "@/components/ui/button";
import { TimetableGrid } from "@/components/TimetableGrid";
import { CalendarSkeleton } from "@/components/Skeletons";
import { DayWeekGrid, MonthGrid, YearGrid } from "@/components/calendar/CalendarViews";
import { EventDialog, draftFrom, type EventDraft } from "@/components/calendar/EventDialog";
import type { CalEvent } from "@/components/calendar/types";
import { cn } from "@/lib/utils";
import { buildIcs, downloadIcs, icsFileName, type IcsEvent } from "@/lib/ics";

const VIEWS = ["tag", "woche", "monat", "jahr", "stundenplan"] as const;
type View = (typeof VIEWS)[number];
const LABEL: Record<View, string> = {
  tag: "Tag",
  woche: "Woche",
  monat: "Monat",
  jahr: "Jahr",
  stundenplan: "Stundenplan",
};

/** Parses "yyyy-MM-dd" as local midnight (never UTC) so the calendar day and default times stay correct. */
function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const Route = createFileRoute("/_authenticated/kalender")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: (VIEWS as readonly string[]).includes(String(search.view))
      ? (search.view as View)
      : ("monat" as View),
    date: typeof search.date === "string" ? search.date : undefined,
    create: search.create === "1" || search.create === 1 || search.create === true,
  }),
  head: () => ({
    meta: [
      { title: "Kalender – Termine & Stundenpläne" },
      {
        name: "description",
        content: "Termine in Tages-, Wochen-, Monats- und Jahresansicht planen und den Stundenplan pflegen.",
      },
      { property: "og:title", content: "Kalender – Termine & Stundenpläne" },
      { property: "og:description", content: "Tag, Woche, Monat, Jahr und Stundenplan deines Studienarchivs." },
    ],
  }),
  component: KalenderPage,
});

function KalenderPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const view = search.view;
  // Date-only URL strings ("2026-10-23") must parse as LOCAL midnight, not UTC —
  // new Date("2026-10-23") shifts to 01:00/02:00 in UTC+1/+2 and west of UTC it moves the day back one.
  const parsed = search.date ? parseLocalDate(search.date) : new Date();
  const date = parsed ?? new Date();

  const [dialog, setDialog] = useState<{ open: boolean; draft: EventDraft; event: CalEvent | null }>({
    open: false,
    draft: draftFrom(null),
    event: null,
  });

  const go = (v: View, d: Date = date) =>
    void navigate({ search: (p) => ({ ...p, view: v, date: format(d, "yyyy-MM-dd"), create: false }) });

  useEffect(() => {
    if (!search.create) return;
    setDialog({ open: true, draft: draftFrom(null, date), event: null });
    void navigate({ search: (p) => ({ ...p, create: false }), replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.create]);

  // Zeitraum laden: Monatsraster deckt Tag/Woche/Monat ab, Jahr ganz.
  const range = useMemo(() => {
    if (view === "jahr") {
      return { start: new Date(startOfYear(date).getTime() - 1000), end: endOfYear(date) };
    }
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    const ms = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    const start = ws < ms ? ws : ms;
    const end = endOfWeek(endOfMonth(addDays(ws, 6) > endOfMonth(date) ? addDays(ws, 6) : date), {
      weekStartsOn: 1,
    });
    return { start, end };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, format(date, "yyyy-MM-dd")]);

  const events = useEvents(range.start.toISOString(), range.end.toISOString());
  const list = (events.data ?? []) as CalEvent[];

  const save = useMutation({
    mutationFn: async (d: EventDraft) => {
      if (!user) throw new Error("Nicht angemeldet");
      const [y, mo, da] = d.date.split("-").map(Number);
      const at = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return new Date(y, mo - 1, da, d.all_day ? 0 : h || 0, d.all_day ? 0 : m || 0);
      };
      const row = {
        title: d.title.trim(),
        notes: d.notes.trim() || null,
        start_at: at(d.start).toISOString(),
        end_at: d.all_day ? null : at(d.end).toISOString(),
        all_day: d.all_day,
        color: d.color,
      };
      const { error } = d.id
        ? await supabase.from("events").update(row).eq("id", d.id).eq("user_id", user.id)
        : await supabase.from("events").insert({ ...row, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setDialog((s) => ({ ...s, open: false }));
      void qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Termin gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDialog((s) => ({ ...s, open: false }));
      void qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Termin gelöscht");
    },
  });

  const exportIcs = async (items: IcsEvent[], filename: string) => {
    if (!items.length) return void toast.error("Keine Termine zum Exportieren.");
    try {
      await downloadIcs(filename, buildIcs(items));
      toast.success(items.length === 1 ? "Termin exportiert" : `${items.length} Termine exportiert`);
    } catch {
      toast.error("Export fehlgeschlagen");
    }
  };

  const openNew = (at?: Date) => setDialog({ open: true, draft: draftFrom(null, at ?? date), event: null });
  const openEvent = (e: CalEvent) => setDialog({ open: true, draft: draftFrom(e), event: e });

  const step = (dir: 1 | -1) => {
    const fn = { tag: addDays, woche: addWeeks, monat: addMonths, jahr: addYears, stundenplan: addDays }[view];
    go(view, fn(date, dir));
  };

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const title =
    view === "tag"
      ? format(date, "EEEE, d. MMMM", { locale: de })
      : view === "woche"
        ? `${format(weekStart, "d. MMM", { locale: de })} – ${format(addDays(weekStart, 6), "d. MMM", { locale: de })}`
        : view === "monat"
          ? format(date, "LLLL", { locale: de })
          : format(date, "yyyy");

  const visible =
    view === "tag"
      ? list.filter((e) => format(new Date(e.start_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd"))
      : view === "woche"
        ? list.filter((e) => new Date(e.start_at) >= weekStart && new Date(e.start_at) < addDays(weekStart, 7))
        : view === "monat"
          ? list.filter((e) => isSameMonth(new Date(e.start_at), date))
          : list.filter((e) => isSameYear(new Date(e.start_at), date));

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="glass flex w-full gap-1 overflow-x-auto rounded-2xl p-1 sm:inline-flex sm:w-auto">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => go(v)}
            className={cn(
              "flex-1 shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:text-sm",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABEL[v]}
          </button>
        ))}
      </div>

      {view === "stundenplan" ? (
        <TimetableGrid />
      ) : (
        <div className="glass rounded-3xl p-2 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="truncate text-xl font-semibold capitalize tracking-tight sm:text-3xl">{title}</h1>
              {view !== "jahr" && view !== "tag" && (
                <span className="text-xl font-light text-muted-foreground/70 sm:text-3xl">{format(date, "yyyy")}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs text-muted-foreground"
                onClick={() => go(view, new Date())}
              >
                Heute
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground"
                title="Sichtbare Termine in den Handy-Kalender übernehmen"
                onClick={() => void exportIcs(visible, `kalender-${format(date, "yyyy-MM-dd")}.ics`)}
              >
                <CalendarArrowUp className="size-4" />
              </Button>
              <div className="glass-soft flex rounded-full p-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Zurück" onClick={() => step(-1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Weiter" onClick={() => step(1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <Button size="icon" className="h-8 w-8 rounded-2xl" aria-label="Neuer Termin" onClick={() => openNew()}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {events.isLoading ? (
            <CalendarSkeleton />
          ) : view === "tag" ? (
            <DayWeekGrid days={[date]} events={list} onSlot={openNew} onEvent={openEvent} />
          ) : view === "woche" ? (
            <DayWeekGrid days={weekDays} events={list} onSlot={openNew} onEvent={openEvent} onDay={(d) => go("tag", d)} />
          ) : view === "monat" ? (
            <MonthGrid month={date} events={list} onDay={(d) => go("tag", d)} onEvent={openEvent} />
          ) : (
            <YearGrid year={date} events={list} onMonth={(m) => go("monat", m)} />
          )}
        </div>
      )}

      <EventDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}
        initial={dialog.draft}
        saving={save.isPending}
        onSave={(d) => save.mutate(d)}
        onDelete={dialog.event ? () => remove.mutate(dialog.event!.id) : undefined}
        onExport={dialog.event ? () => void exportIcs([dialog.event!], icsFileName(dialog.event!.title)) : undefined}
      />
    </div>
  );
}
