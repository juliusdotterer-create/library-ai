import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, FileText, Folder, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildFolderPath, type PickerFolder } from "@/components/lehrplan/DocumentPicker";

export type StudyTask = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  document_id: string | null;
};

/** Aufgabenliste eines Lehrplans – gleiche Ordner mit gleichem Datum werden gruppiert. */
export function TaskList({
  tasks,
  folders,
  docNames,
  docFolders,
  onToggle,
  onRemove,
  onOpenDoc,
}: {
  tasks: StudyTask[];
  folders: PickerFolder[];
  docNames: Record<string, string>;
  docFolders: Record<string, string | null>;
  onToggle: (task: { id: string; done: boolean }) => void;
  onRemove: (id: string) => void;
  onOpenDoc: (id: string) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const renderTask = (t: StudyTask, nested = false) => {
    const done = t.status === "done";
    return (
      <div
        key={t.id}
        className={cn(
          "flex items-center gap-3 rounded-2xl p-3",
          nested ? "bg-muted/40" : "glass-soft",
        )}
      >
        <button onClick={() => onToggle({ id: t.id, done })}>
          {done ? (
            <CheckCircle2 className="size-5 text-primary" />
          ) : (
            <Circle className="size-5 text-muted-foreground" />
          )}
        </button>
        <span className={cn("flex-1 text-sm", done && "line-through opacity-60")}>
          {t.title}
          {t.document_id && docNames[t.document_id] && (
            <button
              onClick={() => onOpenDoc(t.document_id!)}
              className="bg-primary-soft text-accent-foreground ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 align-middle text-[11px]"
            >
              <FileText className="size-3" />
              {docNames[t.document_id]}
            </button>
          )}
        </span>

        {!nested && t.due_date && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(t.due_date), "d. MMM", { locale: de })}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl text-destructive"
          onClick={() => onRemove(t.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    );
  };

  const groups: { key: string; folderId: string | null; items: StudyTask[] }[] = [];
  const index = new Map<string, number>();
  for (const t of tasks) {
    const folderId = t.document_id ? (docFolders[t.document_id] ?? null) : null;
    const key = folderId ? `${folderId}|${t.due_date ?? ""}` : `single-${t.id}`;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, groups.length);
      groups.push({ key, folderId, items: [t] });
    } else {
      groups[at].items.push(t);
    }
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        if (g.items.length < 2 || !g.folderId) return renderTask(g.items[0]);
        const open = !!openGroups[g.key];
        const doneCount = g.items.filter((t) => t.status === "done").length;
        const due = g.items[0].due_date;
        const name = folders.find((f) => f.id === g.folderId)?.name ?? "Ordner";
        return (
          <div key={g.key} className="glass-soft rounded-2xl p-2">
            <button
              onClick={() => setOpenGroups((s) => ({ ...s, [g.key]: !s[g.key] }))}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-muted/50"
            >
              {open ? (
                <ChevronDown className="size-4 shrink-0 opacity-60" />
              ) : (
                <ChevronRight className="size-4 shrink-0 opacity-60" />
              )}
              <Folder className="size-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {buildFolderPath(folders, g.folderId)} · {doneCount}/{g.items.length} erledigt
                </span>
              </span>
              {due && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(due), "d. MMM", { locale: de })}
                </span>
              )}
            </button>
            {open && (
              <div className="mt-1 space-y-1 pl-6">{g.items.map((t) => renderTask(t, true))}</div>
            )}
          </div>
        );
      })}
      {!tasks.length && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Noch keine Aufgaben in diesem Plan.
        </p>
      )}
    </div>
  );
}
