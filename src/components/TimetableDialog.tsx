import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/hooks/useLibrary";
import { parseTimetableText, type ParsedTimetableEntry } from "@/lib/timetable.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
export const WEEKDAY_LONG = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

/** Farboptionen ausschließlich auf Basis der Design-Tokens. */
export const TIMETABLE_COLORS: { key: string; label: string; chip: string; block: string }[] = [
  { key: "primary", label: "Akzent", chip: "bg-primary", block: "bg-primary/20 text-foreground" },
  { key: "soft", label: "Akzent hell", chip: "bg-primary-soft", block: "bg-primary-soft text-accent-foreground" },
  { key: "muted", label: "Neutral", chip: "bg-muted-foreground/40", block: "bg-muted text-foreground" },
  { key: "secondary", label: "Sekundär", chip: "bg-secondary", block: "bg-secondary text-secondary-foreground" },
  { key: "destructive", label: "Signal", chip: "bg-destructive", block: "bg-destructive/15 text-foreground" },
];

export function colorBlockClass(color: string | null | undefined) {
  return (TIMETABLE_COLORS.find((c) => c.key === color) ?? TIMETABLE_COLORS[0]).block;
}

export type TimetableEntry = {
  id: string;
  title: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher: string | null;
  color: string | null;
};

export type TimetableDraft = {
  id?: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

const hhmm = (t: string) => t.slice(0, 5);
const toMin = (t: string) => {
  const [h, m] = hhmm(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMin = (m: number) => {
  const c = Math.max(0, Math.min(23 * 60 + 59, m));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};

const DURATIONS = [45, 60, 90, 120, 180];
const PREVIEW_START = 7 * 60;
const PREVIEW_END = 21 * 60;

export function TimetableDialog({
  open,
  onOpenChange,
  entry,
  draft,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry?: TimetableEntry | null;
  draft?: TimetableDraft | null;
}) {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"manuell" | "ki">("manuell");
  const [days, setDays] = useState<number[]>([1]);
  const [form, setForm] = useState({
    title: "",
    start_time: "08:00",
    end_time: "09:00",
    room: "",
    teacher: "",
    color: "primary",
  });

  useEffect(() => {
    if (!open) return;
    setTab("manuell");
    if (entry) {
      setDays([entry.weekday]);
      setForm({
        title: entry.title,
        start_time: hhmm(entry.start_time),
        end_time: hhmm(entry.end_time),
        room: entry.room ?? "",
        teacher: entry.teacher ?? "",
        color: entry.color ?? "primary",
      });
    } else {
      setDays([draft?.weekday ?? 1]);
      setForm({
        title: "",
        start_time: draft?.start_time ?? "08:00",
        end_time: draft?.end_time ?? "09:00",
        room: "",
        teacher: "",
        color: "primary",
      });
    }
  }, [open, entry, draft]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.timetable });

  const duration = toMin(form.end_time) - toMin(form.start_time);
  const invalidTime = duration <= 0;

  const setDuration = (min: number) =>
    setForm((f) => ({ ...f, end_time: fromMin(toMin(f.start_time) + min) }));

  const shiftStart = (min: number) =>
    setForm((f) => ({
      ...f,
      start_time: fromMin(toMin(f.start_time) + min),
      end_time: fromMin(toMin(f.end_time) + min),
    }));

  const toggleDay = (d: number) => {
    if (entry) {
      setDays([d]);
      return;
    }
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Nicht angemeldet");
      const base = {
        title: form.title.trim(),
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim() || null,
        teacher: form.teacher.trim() || null,
        color: form.color,
      };
      if (entry) {
        const { error } = await supabase
          .from("timetable_entries")
          .update({ ...base, weekday: days[0] ?? entry.weekday })
          .eq("id", entry.id)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const rows = days.map((d) => ({ ...base, weekday: d, user_id: uid }));
        const { error } = await supabase.from("timetable_entries").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
      toast.success(entry ? "Eintrag aktualisiert" : "Eintrag gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!uid || !entry) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("timetable_entries")
        .delete()
        .eq("id", entry.id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
      toast.success("Eintrag gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Eintrag bearbeiten" : "Stundenplan-Eintrag"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "manuell" | "ki")}>
          {!entry && (
            <TabsList className="mb-3 grid w-full grid-cols-2 rounded-2xl">
              <TabsTrigger value="manuell" className="rounded-xl">
                Kalender
              </TabsTrigger>
              <TabsTrigger value="ki" className="rounded-xl">
                <Sparkles className="mr-1.5 size-3.5" /> Mit KI einspielen
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="manuell" className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Titel</Label>
              <Input
                className="rounded-2xl"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="z. B. Steuerrecht"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {entry ? "Wochentag" : "Wochentage (mehrere möglich)"}
              </Label>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d, i) => {
                  const active = days.includes(i + 1);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i + 1)}
                      className={cn(
                        "rounded-2xl py-2 text-xs font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="time"
                  className="rounded-2xl"
                  value={form.start_time}
                  onChange={(e) => {
                    const start = e.target.value || "08:00";
                    setForm((f) => ({
                      ...f,
                      start_time: start,
                      end_time: fromMin(toMin(start) + Math.max(15, duration)),
                    }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ende</Label>
                <Input
                  type="time"
                  className="rounded-2xl"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] transition-colors",
                    duration === m ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground",
                  )}
                >
                  {m} Min
                </button>
              ))}
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => shiftStart(-15)}
                  className="rounded-full bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  −15
                </button>
                <button
                  type="button"
                  onClick={() => shiftStart(15)}
                  className="rounded-full bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  +15
                </button>
              </span>
            </div>

            <WeekPreview days={days} start={form.start_time} end={form.end_time} color={form.color} />

            {invalidTime && (
              <p className="text-xs text-destructive">Die Endzeit muss nach der Startzeit liegen.</p>
            )}

            <div className="grid grid-cols-2 gap-3">
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

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {TIMETABLE_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={c.label}
                    onClick={() => setForm({ ...form, color: c.key })}
                    className={cn(
                      "size-7 rounded-full border transition-transform",
                      c.chip,
                      form.color === c.key ? "scale-110 border-foreground" : "border-border",
                    )}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {entry ? (
                <ConfirmDelete
                  name={entry.title}
                  title="Eintrag löschen"
                  confirmLabel="Löschen"
                  onConfirm={() => remove.mutate()}
                >
                  <Button variant="ghost" className="rounded-2xl text-destructive">
                    <Trash2 className="mr-2 size-4" /> Löschen
                  </Button>
                </ConfirmDelete>
              ) : (
                <span />
              )}
              <Button
                className="rounded-2xl"
                disabled={!form.title.trim() || !days.length || invalidTime || save.isPending}
                onClick={() => save.mutate()}
              >
                {entry ? "Speichern" : days.length > 1 ? `${days.length} Einträge speichern` : "Speichern"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="ki">
            <AiImport color={form.color} onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Kompakte Wochenvorschau: zeigt, wo der Block im Raster landet. */
function WeekPreview({
  days,
  start,
  end,
  color,
}: {
  days: number[];
  start: string;
  end: string;
  color: string;
}) {
  const s = Math.max(PREVIEW_START, toMin(start));
  const e = Math.min(PREVIEW_END, Math.max(s + 15, toMin(end)));
  const span = PREVIEW_END - PREVIEW_START;
  const top = ((s - PREVIEW_START) / span) * 100;
  const height = ((e - s) / span) * 100;

  return (
    <div className="rounded-2xl bg-card/40 p-2">
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid h-28 grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className="relative rounded-lg bg-background/40">
            {days.includes(i + 1) && (
              <div
                className={cn("absolute inset-x-0.5 rounded-md", colorBlockClass(color))}
                style={{ top: `${top}%`, height: `${height}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        07:00 – 21:00 · {hhmm(start)}–{hhmm(end)}
      </p>
    </div>
  );
}

/** Import per KI: Text einfügen, prüfen, ausgewählte Einträge übernehmen. */
function AiImport({ color, onDone }: { color: string; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const parse = useServerFn(parseTimetableText);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedTimetableEntry[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const analyze = useMutation({
    mutationFn: async () => parse({ data: { text } }),
    onSuccess: (res) => {
      setRows(res.entries);
      setPicked(new Set(res.entries.map((_, i) => i)));
      if (!res.entries.length) toast.error("Keine Einträge erkannt.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importRows = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      const chosen = (rows ?? []).filter((_, i) => picked.has(i));
      if (!chosen.length) throw new Error("Nichts ausgewählt");
      const { error } = await supabase
        .from("timetable_entries")
        .insert(chosen.map((r) => ({ ...r, color, user_id: user.id })));
      if (error) throw error;
      return chosen.length;
    },
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: queryKeys.timetable });
      toast.success(`${n} Einträge übernommen`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedCount = useMemo(() => picked.size, [picked]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Stundenplan als Text einfügen (kopierte Tabelle, Mail, Notizen) – die KI erkennt Fach,
        Wochentag, Zeiten, Raum und Dozent.
      </p>
      <Textarea
        className="min-h-32 rounded-2xl"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Mo 08:00-09:30 Steuerrecht, Raum A1, Prof. Meier\nDi 10:00-11:30 Bilanzen ..."}
      />
      <Button
        variant="secondary"
        className="w-full rounded-2xl"
        disabled={text.trim().length < 5 || analyze.isPending}
        onClick={() => analyze.mutate()}
      >
        {analyze.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        Analysieren
      </Button>

      {rows && rows.length > 0 && (
        <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-card/40 p-2">
          {rows.map((r, i) => (
            <label
              key={`${r.title}-${i}`}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-background/40"
            >
              <Checkbox
                checked={picked.has(i)}
                onCheckedChange={(v) =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (v) next.add(i);
                    else next.delete(i);
                    return next;
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {WEEKDAY_LONG[r.weekday - 1]} · {r.start_time}–{r.end_time}
                  {r.room ? ` · ${r.room}` : ""}
                  {r.teacher ? ` · ${r.teacher}` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <DialogFooter>
          <Button
            className="rounded-2xl"
            disabled={!selectedCount || importRows.isPending}
            onClick={() => importRows.mutate()}
          >
            {selectedCount} Einträge übernehmen
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}
