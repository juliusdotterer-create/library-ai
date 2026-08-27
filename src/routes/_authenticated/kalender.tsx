import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvents } from "@/hooks/useLibrary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TimetableGrid } from "@/components/TimetableGrid";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/kalender")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search.view === "stundenplan" ? ("stundenplan" as const) : ("monat" as const),
  }),
  head: () => ({
    meta: [
      { title: "Kalender – Termine & Stundenpläne" },
      {
        name: "description",
        content:
          "Trage Termine, Klausuren und Lernblöcke ein und pflege deinen wöchentlichen Stundenplan.",
      },
      { property: "og:title", content: "Kalender – Termine & Stundenpläne" },
      { property: "og:description", content: "Monatsansicht und Stundenplan deines Studienarchivs." },
    ],
  }),
  component: KalenderPage,
});

function KalenderPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const { view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", time: "09:00" });



  const range = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return { start, end, days };
  }, [month]);

  const events = useEvents(range.start.toISOString(), range.end.toISOString());


  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      const [h, m] = form.time.split(":").map(Number);
      const start = new Date(selected);
      start.setHours(h || 0, m || 0, 0, 0);
      const { error } = await supabase.from("events").insert({
        user_id: user.id,
        title: form.title,
        notes: form.notes || null,
        start_at: start.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ title: "", notes: "", time: "09:00" });
      void qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Termin gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("events").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const dayEvents = (d: Date) =>
    (events.data ?? []).filter((e) => isSameDay(new Date(e.start_at), d));

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="glass inline-flex gap-1 rounded-2xl p-1">
        {(["monat", "stundenplan"] as const).map((v) => (
          <button
            key={v}
            onClick={() => void navigate({ search: { view: v } })}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {v === "monat" ? "Monat" : "Stundenplan"}
          </button>
        ))}
      </div>

      {view === "stundenplan" ? (
        <TimetableGrid />
      ) : (
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="glass rounded-3xl p-2 sm:p-4">


        <div className="mb-2 flex items-center justify-between sm:mb-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-semibold tracking-tight capitalize sm:text-3xl">
              {format(month, "LLLL", { locale: de })}
            </h1>
            <span className="text-xl font-light text-muted-foreground/70 sm:text-3xl">
              {format(month, "yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                const now = new Date();
                setMonth(now);
                setSelected(now);
              }}
            >
              Heute
            </Button>
            <div className="glass-soft flex rounded-full p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full sm:h-8 sm:w-8"
                onClick={() => setMonth(subMonths(month, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full sm:h-8 sm:w-8"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 sm:mb-3">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d, i) => (
            <span
              key={d}
              className={cn(
                "py-1 text-center text-[10px] font-semibold uppercase tracking-widest sm:text-xs",
                i >= 5 ? "text-muted-foreground/50" : "text-muted-foreground",
              )}
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {range.days.map((d) => {
            const evts = dayEvents(d);
            const today = isToday(d);
            const isSelected = isSameDay(d, selected);
            const inMonth = isSameMonth(d, month);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={cn(
                  "group flex min-h-12 flex-col items-stretch rounded-2xl p-1.5 text-left transition-all duration-200 sm:min-h-24 sm:p-2.5",
                  inMonth ? "bg-card/60 hover:bg-card" : "opacity-35",
                  isSelected && "bg-primary-soft ring-1 ring-primary/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium transition-colors sm:h-7 sm:w-7 sm:text-sm",
                    today && !isSelected && "bg-primary text-primary-foreground shadow-sm",
                    isSelected && "text-accent-foreground font-semibold",
                    !today && !isSelected && "group-hover:bg-muted",
                  )}
                >
                  {format(d, "d")}
                </span>
                <span className="mt-1 flex flex-1 flex-col gap-0.5 sm:mt-1.5 sm:gap-1">
                  {evts.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className="flex items-center gap-1 truncate rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-medium text-accent-foreground sm:px-2 sm:text-[11px]"
                    >
                      <span className="size-1 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{e.title}</span>
                    </span>
                  ))}
                  {evts.length > 2 && (
                    <span className="px-1.5 text-[9px] font-medium text-muted-foreground sm:text-[11px]">
                      +{evts.length - 2} weitere
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="glass h-fit rounded-3xl p-3 sm:p-5">
        <div className="mb-3 flex items-start justify-between sm:mb-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold sm:h-12 sm:w-12 sm:text-xl",
                isToday(selected)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-primary-soft text-accent-foreground",
              )}
            >
              {format(selected, "d")}
            </span>
            <div>
              <h2 className="text-sm font-semibold capitalize leading-tight sm:text-base">
                {format(selected, "EEEE", { locale: de })}
              </h2>
              <p className="text-[10px] capitalize text-muted-foreground sm:text-xs">
                {format(selected, "d. MMMM yyyy", { locale: de })}
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-8 w-8 rounded-2xl sm:h-9 sm:w-9">
                <CalendarPlus className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="glass rounded-3xl">
              <DialogHeader>
                <DialogTitle>Neuer Termin</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Titel</Label>
                  <Input
                    className="rounded-2xl"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
                  <Input
                    type="time"
                    className="rounded-2xl"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Notiz</Label>
                  <Textarea
                    className="rounded-2xl"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="rounded-2xl"
                  disabled={!form.title.trim()}
                  onClick={() => create.mutate()}
                >
                  Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {dayEvents(selected).map((e) => (
            <div
              key={e.id}
              className="group glass-soft relative flex items-start gap-3 overflow-hidden rounded-2xl p-3 transition-colors hover:bg-card/70"
            >
              <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary" />
              <div className="min-w-0 flex-1 pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-foreground sm:text-[11px]">
                  {format(new Date(e.start_at), "HH:mm")} Uhr
                </p>
                <p className="mt-0.5 truncate text-sm font-medium">{e.title}</p>
                {e.notes && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{e.notes}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-2xl text-muted-foreground/50 transition-colors hover:text-destructive"
                onClick={() => remove.mutate(e.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {!dayEvents(selected).length && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-muted">
                <CalendarPlus className="size-4 text-muted-foreground" />
              </span>
              <p className="text-xs text-muted-foreground sm:text-sm">Keine Termine an diesem Tag.</p>
            </div>
          )}
        </div>
      </aside>
        </div>
      )}
    </div>
  );
}

