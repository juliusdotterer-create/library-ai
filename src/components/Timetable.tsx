import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Plus, Trash2, Upload } from "lucide-react";
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

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function Timetable() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [form, setForm] = useState({
    title: "",
    weekday: 1,
    start_time: "08:00",
    end_time: "09:30",
    room: "",
    teacher: "",
  });

  const entries = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_entries")
        .select("*")
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (rows: (typeof form)[]) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user!.id;
      const { error } = await supabase.from("timetable_entries").insert(
        rows.map((r) => ({
          user_id: uid,
          title: r.title,
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
          room: r.room || null,
          teacher: r.teacher || null,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setImportOpen(false);
      setRaw("");
      setForm({ title: "", weekday: 1, start_time: "08:00", end_time: "09:30", room: "", teacher: "" });
      void qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Stundenplan aktualisiert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["timetable"] }),
  });

  const doImport = () => {
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, day, start, end, room, teacher] = line.split(/[;,\t]/).map((s) => s?.trim() ?? "");
        const idx = DAYS.findIndex((d) =>
          d.toLowerCase().startsWith((day ?? "").toLowerCase().slice(0, 2)),
        );
        return {
          title,
          weekday: idx >= 0 ? idx + 1 : 1,
          start_time: start || "08:00",
          end_time: end || "09:30",
          room: room || "",
          teacher: teacher || "",
        };
      })
      .filter((r) => r.title);
    if (!rows.length) return toast.error("Keine gültigen Zeilen gefunden");
    create.mutate(rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarRange className="size-4 text-primary" /> Stundenplan
        </h2>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="rounded-2xl">
                <Upload className="size-4" /> Importieren
              </Button>
            </DialogTrigger>
            <DialogContent className="glass rounded-3xl">
              <DialogHeader>
                <DialogTitle>Stundenplan importieren</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Eine Zeile pro Fach: Titel; Wochentag; Start; Ende; Raum; Dozent
                <br />
                Beispiel: Staatsrecht; Montag; 08:00; 09:30; A1.02; Dr. Weber
              </p>
              <Textarea
                rows={8}
                className="rounded-2xl"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              <DialogFooter>
                <Button className="rounded-2xl" onClick={doImport}>
                  Importieren
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl">
                <Plus className="size-4" /> Eintrag
              </Button>
            </DialogTrigger>
            <DialogContent className="glass rounded-3xl">
              <DialogHeader>
                <DialogTitle>Neuer Stundenplan-Eintrag</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fach / Titel</Label>
                  <Input
                    className="rounded-2xl"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tag</Label>
                    <select
                      className="h-9 w-full rounded-2xl border border-input bg-background px-2 text-sm"
                      value={form.weekday}
                      onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}
                    >
                      {DAYS.map((d, i) => (
                        <option key={d} value={i + 1}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Von</Label>
                    <Input
                      type="time"
                      className="rounded-2xl"
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bis</Label>
                    <Input
                      type="time"
                      className="rounded-2xl"
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Raum</Label>
                    <Input
                      className="rounded-2xl"
                      value={form.room}
                      onChange={(e) => setForm({ ...form, room: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dozent</Label>
                    <Input
                      className="rounded-2xl"
                      value={form.teacher}
                      onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="rounded-2xl"
                  disabled={!form.title.trim()}
                  onClick={() => create.mutate([form])}
                >
                  Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {DAYS.slice(0, 5).map((day, i) => {
          const rows = (entries.data ?? []).filter((e) => e.weekday === i + 1);
          return (
            <div key={day} className="glass-soft rounded-3xl p-3">
              <p className="mb-2 text-sm font-semibold">{day}</p>
              <div className="space-y-2">
                {rows.map((e) => (
                  <div key={e.id} className="group bg-primary-soft rounded-2xl p-2.5">
                    <div className="flex items-start gap-1">
                      <p className="flex-1 text-sm font-medium">{e.title}</p>
                      <button
                        className="text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => remove.mutate(e.id)}
                        aria-label="Eintrag löschen"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {String(e.start_time).slice(0, 5)}–{String(e.end_time).slice(0, 5)}
                      {e.room ? ` · ${e.room}` : ""}
                    </p>
                    {e.teacher && <p className="text-xs text-muted-foreground">{e.teacher}</p>}
                  </div>
                ))}
                {!rows.length && <p className="py-4 text-center text-xs text-muted-foreground">frei</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
