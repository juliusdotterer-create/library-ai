import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { COLOR_CLASS, EVENT_COLORS, endOf, type CalEvent, type EventColor } from "./types";

export type EventDraft = {
  id?: string;
  title: string;
  notes: string;
  date: string;
  start: string;
  end: string;
  all_day: boolean;
  color: EventColor;
};

export function draftFrom(e: CalEvent | null, at?: Date): EventDraft {
  if (e) {
    const s = new Date(e.start_at);
    return {
      id: e.id,
      title: e.title,
      notes: e.notes ?? "",
      date: format(s, "yyyy-MM-dd"),
      start: format(s, "HH:mm"),
      end: format(endOf(e), "HH:mm"),
      all_day: e.all_day,
      color: (EVENT_COLORS as readonly string[]).includes(e.color ?? "") ? (e.color as EventColor) : "orange",
    };
  }
  const s = at ?? new Date();
  const hasTime = at && (at.getHours() || at.getMinutes());
  const h = hasTime ? s.getHours() : 9;
  return {
    title: "",
    notes: "",
    date: format(s, "yyyy-MM-dd"),
    start: `${String(h).padStart(2, "0")}:00`,
    end: `${String(Math.min(23, h + 1)).padStart(2, "0")}:${h >= 23 ? "59" : "00"}`,
    all_day: false,
    color: "orange",
  };
}

export function EventDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
  onExport,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: EventDraft;
  onSave: (d: EventDraft) => void;
  onDelete?: () => void;
  onExport?: () => void;
  saving?: boolean;
}) {
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);
  const invalid = !f.title.trim() || !f.date || (!f.all_day && f.end <= f.start);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass rounded-3xl">
        <DialogHeader>
          <DialogTitle>{f.id ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Titel</Label>
            <Input autoFocus className="rounded-2xl bg-field border-field-border" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Datum</Label>
              <Input type="date" className="rounded-2xl bg-field border-field-border" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>
            <label className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={f.all_day} onCheckedChange={(v) => setF({ ...f, all_day: v })} />
              Ganztägig
            </label>
          </div>
          {!f.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Beginn</Label>
                <Input type="time" className="rounded-2xl bg-field border-field-border" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ende</Label>
                <Input type="time" className="rounded-2xl bg-field border-field-border" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Farbe</Label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setF({ ...f, color: c })}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-background transition",
                    COLOR_CLASS[c].solid,
                    f.color === c && "ring-2 ring-foreground",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notiz</Label>
            <Textarea className="rounded-2xl bg-field border-field-border" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <div className="flex gap-1">
            {onDelete && (
              <Button variant="ghost" size="icon" className="rounded-2xl hover:text-destructive" title="Löschen" onClick={onDelete}>
                <Trash2 className="size-4" />
              </Button>
            )}
            {onExport && (
              <Button variant="ghost" size="icon" className="rounded-2xl" title="In Handy-Kalender übernehmen" onClick={onExport}>
                <CalendarArrowUp className="size-4" />
              </Button>
            )}
          </div>
          <Button className="ml-auto rounded-2xl" disabled={invalid || saving} onClick={() => onSave(f)}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
