import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickerFolder = { id: string; name: string; parent_id: string | null };
export type PickerDoc = { id: string; name: string; folder_id: string | null };

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

/** Baut den lesbaren Ordnerpfad („Oberordner / Unterordner“). */
export function buildFolderPath(folders: PickerFolder[], id: string | null): string {
  const parts: string[] = [];
  let cur = folders.find((f) => f.id === id);
  let guard = 0;
  while (cur && guard++ < 20) {
    parts.unshift(cur.name);
    cur = folders.find((f) => f.id === cur!.parent_id);
  }
  return parts.join(" / ");
}

function useTree(folders: PickerFolder[], docs: PickerDoc[]) {
  return useMemo(
    () => ({
      subFolders: (parentId: string | null) =>
        folders
          .filter((f) => (f.parent_id ?? null) === parentId)
          .sort((a, b) => collator.compare(a.name, b.name)),
      docsIn: (folderId: string | null) =>
        docs
          .filter((d) => (d.folder_id ?? null) === folderId)
          .sort((a, b) => collator.compare(a.name, b.name)),
    }),
    [folders, docs],
  );
}

/** Auswahl eines einzelnen Dokuments – per Ordner-Navigation oder Suche. */
export function DocumentPicker({
  folders,
  docs,
  selectedId,
  label,
  onPick,
}: {
  folders: PickerFolder[];
  docs: PickerDoc[];
  selectedId?: string | null;
  label: string;
  onPick: (doc: PickerDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nav, setNav] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { subFolders, docsIn } = useTree(folders, docs);
  const path = (id: string | null) => buildFolderPath(folders, id);

  const q = query.trim().toLowerCase();
  const searchResults = docs
    .filter((d) => !q || d.name.toLowerCase().includes(q) || path(d.folder_id).toLowerCase().includes(q))
    .sort(
      (a, b) =>
        collator.compare(path(a.folder_id), path(b.folder_id)) || collator.compare(a.name, b.name),
    );

  const pick = (d: PickerDoc) => {
    onPick(d);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 w-56 justify-between rounded-2xl font-normal">
          <span className="truncate">{label}</span>
          <ChevronRight className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="glass w-80 rounded-2xl p-2">
        <Input
          autoFocus
          placeholder="Dokumente suchen…"
          className="mb-2 h-8 rounded-xl text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {!q && (
          <div className="mb-2 flex items-center gap-1 px-1 text-xs text-muted-foreground">
            {nav && (
              <button
                className="rounded-lg p-1 hover:bg-muted"
                onClick={() => setNav(folders.find((f) => f.id === nav)?.parent_id ?? null)}
              >
                <ArrowLeft className="size-3.5" />
              </button>
            )}
            <span className="truncate">{nav ? path(nav) : "Library"}</span>
          </div>
        )}

        <div className="max-h-80 space-y-0.5 overflow-y-auto">
          {!q &&
            subFolders(nav).map((f) => (
              <button
                key={f.id}
                onClick={() => setNav(f.id)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Folder className="size-4 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{f.name}</span>
                <ChevronRight className="size-3.5 shrink-0 opacity-50" />
              </button>
            ))}
          {!q &&
            docsIn(nav).map((d) => (
              <button
                key={d.id}
                onClick={() => pick(d)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted",
                  selectedId === d.id && "bg-muted",
                )}
              >
                <FileText className="size-4 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{d.name}</span>
              </button>
            ))}

          {!!q &&
            searchResults.map((d) => (
              <button
                key={`all-${d.id}`}
                onClick={() => pick(d)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted",
                  selectedId === d.id && "bg-muted",
                )}
              >
                <FileText className="mt-0.5 size-4 shrink-0 opacity-60" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{d.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {path(d.folder_id) || "Library"}
                  </span>
                </span>
              </button>
            ))}
          {!!q && !searchResults.length && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Keine Dokumente gefunden.
            </p>
          )}
          {!q && !subFolders(nav).length && !docsIn(nav).length && (
            <p className="py-6 text-center text-xs text-muted-foreground">Ordner ist leer.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Auswahl eines ganzen Ordners, dessen Dokumente gesammelt eingeplant werden. */
export function FolderPicker({
  folders,
  onPick,
}: {
  folders: PickerFolder[];
  onPick: (folder: PickerFolder) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nav, setNav] = useState<string | null>(null);
  const path = (id: string | null) => buildFolderPath(folders, id);
  const subFolders = (parentId: string | null) =>
    folders
      .filter((f) => (f.parent_id ?? null) === parentId)
      .sort((a, b) => collator.compare(a.name, b.name));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 w-52 justify-between rounded-2xl font-normal">
          <span className="truncate">Ganzer Ordner</span>
          <ChevronRight className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="glass w-72 rounded-2xl p-2">
        <div className="mb-2 flex items-center gap-1 px-1 text-xs text-muted-foreground">
          {nav && (
            <button
              className="rounded-lg p-1 hover:bg-muted"
              onClick={() => setNav(folders.find((f) => f.id === nav)?.parent_id ?? null)}
            >
              <ArrowLeft className="size-3.5" />
            </button>
          )}
          <span className="truncate">{nav ? path(nav) : "Library"}</span>
        </div>
        {nav && (
          <Button
            size="sm"
            className="mb-2 w-full rounded-xl"
            onClick={() => {
              const f = folders.find((x) => x.id === nav);
              if (f) {
                onPick(f);
                setOpen(false);
              }
            }}
          >
            Diesen Ordner einplanen
          </Button>
        )}
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {subFolders(nav).map((f) => (
            <button
              key={f.id}
              onClick={() => setNav(f.id)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <Folder className="size-4 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{f.name}</span>
              <ChevronRight className="size-3.5 shrink-0 opacity-50" />
            </button>
          ))}
          {!subFolders(nav).length && (
            <p className="py-6 text-center text-xs text-muted-foreground">Keine Unterordner.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
