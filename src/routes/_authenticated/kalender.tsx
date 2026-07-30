import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kalender")({
  head: () => ({
    meta: [
      { title: "Kalender – Termine & Lernblöcke" },
      {
        name: "description",
        content: "Trage Termine, Klausuren und Lernblöcke in deinen integrierten Kalender ein.",
      },
      { property: "og:title", content: "Kalender – Termine & Lernblöcke" },
      { property: "og:description", content: "Alle Termine deines Studienarchivs im Monatsblick." },
    ],
  }),
  component: KalenderPage,
});

function KalenderPage() {
  const qc = useQueryClient();
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

  const events = useQuery({
    queryKey: ["events", range.start.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("start_at", range.start.toISOString())
        .lte("start_at", range.end.toISOString())
        .order("start_at");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const [h, m] = form.time.split(":").map(Number);
      const start = new Date(selected);
      start.setHours(h || 0, m || 0, 0, 0);
      const { error } = await supabase.from("events").insert({
        user_id: auth.user!.id,
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
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const dayEvents = (d: Date) =>
    (events.data ?? []).filter((e) => isSameDay(new Date(e.start_at), d));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="glass rounded-3xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold capitalize">
            {format(month, "LLLL yyyy", { locale: de })}
          </h1>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl"
              onClick={() => setMonth(subMonths(month, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted-foreground">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {range.days.map((d) => {
            const evts = dayEvents(d);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={cn(
                  "min-h-20 rounded-2xl p-2 text-left text-sm transition-colors",
                  isSameMonth(d, month) ? "bg-card/50" : "opacity-40",
                  isSameDay(d, selected) && "bg-primary text-primary-foreground",
                )}
              >
                <span className="font-medium">{format(d, "d")}</span>
                <span className="mt-1 block space-y-0.5">
                  {evts.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className={cn(
                        "block truncate rounded-lg px-1 text-[11px]",
                        isSameDay(d, selected) ? "bg-white/20" : "bg-primary-soft text-accent-foreground",
                      )}
                    >
                      {e.title}
                    </span>
                  ))}
                  {evts.length > 2 && (
                    <span className="block text-[11px] opacity-70">+{evts.length - 2}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="glass h-fit rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{format(selected, "EEEE, d. MMM", { locale: de })}</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-2xl">
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
            <div key={e.id} className="glass-soft flex items-start gap-2 rounded-2xl p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.start_at), "HH:mm")} Uhr
                </p>
                {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl text-destructive"
                onClick={() => remove.mutate(e.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {!dayEvents(selected).length && (
            <p className="py-8 text-center text-sm text-muted-foreground">Keine Termine.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
