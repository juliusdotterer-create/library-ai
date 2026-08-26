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


        <div className="mb-2 flex items-center justify-between sm:mb-4">
          <h1 className="text-base font-semibold capitalize sm:text-lg">
            {format(month, "LLLL yyyy", { locale: de })}
          </h1>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-2xl sm:h-9 sm:w-9"
              onClick={() => setMonth(subMonths(month, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-2xl sm:h-9 sm:w-9"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-muted-foreground sm:text-xs">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <span key={d} className="py-0.5 sm:py-1">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {range.days.map((d) => {
            const evts = dayEvents(d);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={cn(
                  "flex min-h-10 flex-col rounded-xl p-1 text-left text-xs transition-colors sm:min-h-20 sm:rounded-2xl sm:p-2 sm:text-sm",
                  isSameMonth(d, month) ? "bg-card/50" : "opacity-40",
                  isSameDay(d, selected) && "bg-primary text-primary-foreground",
                )}
              >
                <span className="font-medium">{format(d, "d")}</span>
                <span className="mt-0.5 flex flex-1 flex-col gap-0.5 sm:mt-1 sm:space-y-0.5">
                  {evts.slice(0, 1).map((e) => (
                    <span
                      key={e.id}
                      className={cn(
                        "block truncate rounded px-0.5 text-[9px] sm:rounded-lg sm:px-1 sm:text-[11px]",
                        isSameDay(d, selected) ? "bg-white/20" : "bg-primary-soft text-accent-foreground",
                      )}
                    >
                      {e.title}
                    </span>
                  ))}
                  {evts.length > 1 && (
                    <span className="block text-[9px] opacity-70 sm:text-[11px]">+{evts.length - 1}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="glass h-fit rounded-3xl p-2 sm:p-4">
        <div className="mb-2 flex items-center justify-between sm:mb-3">
          <h2 className="text-sm font-semibold sm:text-base">{format(selected, "EEEE, d. MMM", { locale: de })}</h2>
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

        <div className="space-y-1.5 sm:space-y-2">
          {dayEvents(selected).map((e) => (
            <div key={e.id} className="glass-soft flex items-start gap-2 rounded-xl p-2 sm:rounded-2xl sm:p-3">
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium sm:text-sm">{e.title}</p>
                <p className="text-[10px] text-muted-foreground sm:text-xs">
                  {format(new Date(e.start_at), "HH:mm")} Uhr
                </p>
                {e.notes && <p className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">{e.notes}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-2xl text-destructive sm:h-9 sm:w-9"
                onClick={() => remove.mutate(e.id)}
              >
                <Trash2 className="size-3.5 sm:size-4" />
              </Button>
            </div>
          ))}
          {!dayEvents(selected).length && (
            <p className="py-4 text-center text-xs text-muted-foreground sm:py-8 sm:text-sm">Keine Termine.</p>
          )}
        </div>
      </aside>
        </div>
      )}
    </div>
  );
}

