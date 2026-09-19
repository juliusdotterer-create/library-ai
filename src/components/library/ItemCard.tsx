import {
  Download,
  FileText,
  Folder,
  HardDrive,
  MoreVertical,
  NotebookPen,
  Pencil,
  RefreshCw,
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
  onDriveSync,
  driveSyncLabel,
}: {
  onOpen?: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDriveSync?: () => void;
  driveSyncLabel?: string;
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
        {onDriveSync && (
          <DropdownMenuItem onClick={onDriveSync}>
            <RefreshCw className="size-4" /> {driveSyncLabel ?? "Aus Drive aktualisieren"}
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
  onDriveSync,
  selectMode,
  selected,
  onSelectChange,
}: {
  folder: {
    id: string;
    name: string;
    is_favorite?: boolean | null;
    created_at?: string | null;
    source?: string | null;
    external_id?: string | null;
  };
  view: ViewMode;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDriveSync?: () => void;
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
        onDriveSync={folder.source === "gdrive" || folder.external_id ? onDriveSync : undefined}
        driveSyncLabel="Ordner aus Drive aktualisieren"
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
  onDriveSync,
  selectMode,
  selected,
  onSelectChange,
}: {
  doc: {
    id: string;
    name: string;
    kind?: string | null;
    created_at?: string | null;
    source?: string;
    drive_state?: string | null;
  };
  view: ViewMode;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDriveSync?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onSelectChange?: (v: boolean) => void;
}) {
  const driveBadge =
    doc.source === "gdrive" ? (
      doc.drive_state === "missing" ? (
        <span className="ml-2 inline-flex shrink-0 items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
          In Drive nicht gefunden
        </span>
      ) : doc.drive_state === "changed" ? (
        <span className="ml-2 inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          In Drive aktualisiert
        </span>
      ) : null
    ) : null;
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
          ) : doc.source === "gdrive" ? (
            <HardDrive className={cn("text-primary", iconSize(view))} />
          ) : (
            <FileText className={cn("text-muted-foreground", iconSize(view))} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {doc.name}
            {driveBadge}
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
        onDriveSync={doc.source === "gdrive" ? onDriveSync : undefined}
      />
    </MotionItem>
  );
}
