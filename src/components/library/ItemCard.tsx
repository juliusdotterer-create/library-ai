import {
  Download,
  FileText,
  Folder,
  MoreVertical,
  NotebookPen,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MotionItem } from "@/components/MotionItem";
import { cn } from "@/lib/utils";
import { LockedBadge } from "@/components/library/LockedBadge";
import type { ViewMode } from "@/hooks/useLibraryView";

/** Auswahlkästchen für die Schnellauswahl (Mehrfachlöschen). */
function SelectBox({
  selected,
  onChange,
  label,
}: {
  selected: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Checkbox
      checked={selected}
      onCheckedChange={(v) => onChange(v === true)}
      aria-label={`${label} auswählen`}
      className="size-5 shrink-0 rounded-md"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** Kurzes Datum für die Listenansicht. */
function dateLabel(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function RowMenu({
  onOpen,
  onRename,
  onDelete,
}: {
  onOpen?: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-2xl">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass rounded-2xl">
        {onOpen && (
          <DropdownMenuItem onClick={onOpen}>
            <Download className="size-4" /> Öffnen
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="size-4" /> Umbenennen
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="size-4" /> In den Papierkorb
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const shell = (view: ViewMode) =>
  cn(
    "glass group flex items-center gap-3 transition-transform",
    view === "grid" ? "rounded-3xl p-4 hover:-translate-y-0.5" : "rounded-2xl px-4 py-2",
  );

const iconBox = (view: ViewMode, tone: "primary" | "muted") =>
  cn(
    "flex items-center justify-center rounded-2xl",
    tone === "primary" ? "bg-primary-soft" : "bg-muted",
    view === "grid" ? "size-10" : "size-8",
  );

const iconSize = (view: ViewMode) => (view === "grid" ? "size-5" : "size-4");

export function FolderCard({
  folder,
  view,
  onOpen,
  onToggleFavorite,
  onRename,
  onDelete,
  selectMode,
  selected,
  onSelectChange,
}: {
  folder: {
    id: string;
    name: string;
    is_favorite?: boolean | null;
    created_at?: string | null;
  };
  view: ViewMode;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onRename: () => void;
  onDelete: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onSelectChange?: (v: boolean) => void;
}) {
  return (
    <MotionItem className={cn(shell(view), selected && "ring-2 ring-primary")}>
      {selectMode && (
        <SelectBox
          selected={!!selected}
          onChange={(v) => onSelectChange?.(v)}
          label={folder.name}
        />
      )}
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => (selectMode ? onSelectChange?.(!selected) : onOpen())}
      >
        <span className={iconBox(view, "primary")}>
          <Folder className={cn("text-primary", iconSize(view))} />
        </span>
        <span className="truncate font-medium">{folder.name}</span>
      </button>
      {view === "list" && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {dateLabel(folder.created_at)}
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="rounded-2xl"
        title={folder.is_favorite ? "Favorit entfernen" : "Als Favorit markieren"}
        onClick={onToggleFavorite}
      >
        <Star className={cn("size-4", folder.is_favorite && "fill-primary text-primary")} />
      </Button>
      <RowMenu
        onRename={onRename}
        onDelete={onDelete}
      />
    </MotionItem>
  );
}

export function DocumentCard({
  doc,
  view,
  onOpen,
  onRename,
  onDelete,
  selectMode,
  selected,
  onSelectChange,
}: {
  doc: {
    id: string;
    name: string;
    kind?: string | null;
    created_at?: string | null;
  };
  view: ViewMode;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onSelectChange?: (v: boolean) => void;
}) {
  return (
    <MotionItem className={cn(shell(view), selected && "ring-2 ring-primary")}>
      {selectMode && (
        <SelectBox selected={!!selected} onChange={(v) => onSelectChange?.(v)} label={doc.name} />
      )}
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => (selectMode ? onSelectChange?.(!selected) : onOpen())}
      >
        <span className={iconBox(view, "muted")}>
          {doc.kind === "note" ? (
            <NotebookPen className={cn("text-primary", iconSize(view))} />
          ) : (
            <FileText className={cn("text-muted-foreground", iconSize(view))} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {doc.name}
            <LockedBadge id={doc.id} name={doc.name} />
          </span>
        </span>
      </button>
      {view === "list" && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {dateLabel(doc.created_at)}
        </span>
      )}
      <RowMenu
        onOpen={onOpen}
        onRename={onRename}
        onDelete={onDelete}
      />
    </MotionItem>
  );
}
