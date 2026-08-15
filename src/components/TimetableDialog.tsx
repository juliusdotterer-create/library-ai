import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/hooks/useLibrary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

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
  const [form, setForm] = useState({
    title: "",
    weekday: 1,
    start_time: "08:00",
    end_time: "09:00",
    room: "",
    teacher: "",
    color: "primary",
  });

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        title: entry.title,
        weekday: entry.weekday,
        start_time: hhmm(entry.start_time),
        end_time: hhmm(entry.end_time),
        room: entry.room ?? "",
        teacher: entry.teacher ?? "",
        color: entry.color ?? "primary",
      });
    } else {
      setForm({
        title: "",
        weekday: draft?.weekday ?? 1,
        start_time: draft?.start_time ?? "08:00",
        end_time: draft?.end_time ?? "09:00",
        room: "",
        teacher: "",
        color: "primary",
      });
    }
  }, [open, entry, draft]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.timetable });

  const save = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Nicht angemeldet");
      const payload = {
        title: form.title.trim(),
        weekday: form.weekday,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim() || null,
        teacher: form.teacher.trim() || null,
        color: form.color,
      };
      if (entry) {
        const { error } = await supabase
          .from("timetable_entries")
          .update(payload)
          .eq("id", entry.id)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("timetable_entries")
          .insert({ ...payload, user_id: uid });
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

  const invalidTime = form.end_time <= form.start_time;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Eintrag bearbeiten" : "Neuer Stundenplan-Eintrag"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
            <Label className="text-xs text-muted-foreground">Wochentag</Label>
            <Select
              value={String(form.weekday)}
              onValueChange={(v) => setForm({ ...form, weekday: Number(v) })}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {WEEKDAY_LONG.map((d, i) => (
                  <SelectItem key={d} value={String(i + 1)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input
                type="time"
                className="rounded-2xl"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
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
            disabled={!form.title.trim() || invalidTime || save.isPending}
            onClick={() => save.mutate()}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
