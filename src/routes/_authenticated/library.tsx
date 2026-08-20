import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  FolderUp,
  MoreVertical,
  NotebookPen,
  Pencil,
  Star,
  Trash2,
  Upload,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDocuments, useFolders, queryKeys } from "@/hooks/useLibrary";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { saveDocumentText } from "@/lib/document-text.functions";
import { extractPdfText, isPdfFile, runQueue } from "@/lib/pdf-text";
import { softDeleteFolder } from "@/lib/tree";
import { Progress } from "@/components/ui/progress";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import { FreeNotesOverlay } from "@/components/FreeNotesOverlay";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/library")({
  validateSearch: (search: Record<string, unknown>): { folder?: string } =>
    typeof search.folder === "string" ? { folder: search.folder } : {},
  head: () => ({
    meta: [
      { title: "Library – Ordner & Dokumente" },
      {
        name: "description",
        content: "Lege Ordner und Unterordner an und speichere PDFs sowie andere Dateien sicher ab.",
      },
      { property: "og:title", content: "Library – Ordner & Dokumente" },
      { property: "og:description", content: "Ordner, Unterordner und Dateien an einem Ort." },
    ],
  }),
  component: LibraryPage,
});

type Crumb = { id: string | null; name: string };

/** Systemdateien, die Windows/macOS beim Ordner-Upload mitschickt – nie importieren. */
const JUNK = /^(desktop\.ini|thumbs\.db|\.ds_store|\.localized|icon\r?)$/i;
const isJunk = (name: string) => JUNK.test(name) || name.startsWith("._");

function LibraryPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id;
  const { folder: folderParam } = Route.useSearch();
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "Library" }]);
  const current = path[path.length - 1];
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [newFolder, setNewFolder] = useState("");
  const [rename, setRename] = useState<{
    table: "folders" | "documents";
    id: string;
    name: string;
  } | null>(null);

  // Sprung aus der Suche: Pfad zum verlinkten Ordner aufbauen
  useEffect(() => {
    if (!folderParam) return;
    if (folderParam === "root") {
      setPath([{ id: null, name: "Library" }]);
      return;
    }
    let cancelled = false;
    (async () => {
      const crumbs: Crumb[] = [];
      let id: string | null = folderParam;
      while (id && uid) {
        const res: {
          data: { id: string; name: string; parent_id: string | null } | null;
          error: unknown;
        } = await supabase
          .from("folders")
          .select("id,name,parent_id")
          .eq("id", id)
          .eq("user_id", uid)
          .maybeSingle();
        if (res.error || !res.data) break;
        crumbs.unshift({ id: res.data.id, name: res.data.name });
        id = res.data.parent_id;
      }
      if (!cancelled) setPath([{ id: null, name: "Library" }, ...crumbs]);
    })();
    return () => {
      cancelled = true;
    };
  }, [folderParam, uid]);


  const folders = useFolders(current.id);
  const docs = useDocuments(current.id);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["folders"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("folders")
        .insert({ name, parent_id: current.id, user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewFolder("");
      invalidate();
      toast.success("Ordner erstellt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    bytesDone: number;
    bytesTotal: number;
    started: number;
    name: string;
  } | null>(null);
  const [indexing, setIndexing] = useState<{ done: number; total: number } | null>(null);
  const saveText = useServerFn(saveDocumentText);


  const uploadFile = async (file: File, folderId: string | null) => {
    if (!uid) throw new Error("Nicht angemeldet");
    const storagePath = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, { contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { data, error } = await supabase
      .from("documents")
      .insert({
        user_id: uid,
        folder_id: folderId,
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  /** Extrahiert PDF-Text im Hintergrund, damit die Volltextsuche greift. */
  const indexPdfs = async (items: { id: string; file: File }[]) => {
    if (!items.length) return;
    setIndexing({ done: 0, total: items.length });
    await runQueue(
      items,
      async (item) => {
        try {
          const res = await extractPdfText(item.file);
          await saveText({
            data: {
              documentId: item.id,
              content: res.content,
              pages: res.pages,
              pageCount: res.pageCount,
              status: res.status,
            },
          });
        } catch {
          await saveText({
            data: {
              documentId: item.id,
              content: "",
              pages: [],
              pageCount: 0,
              status: "failed",
            },
          }).catch(() => undefined);
        }
        setIndexing((p) => (p ? { ...p, done: p.done + 1 } : p));
      },
      2,
    );
    setIndexing(null);
  };

  const runUpload = async (all: { file: File; segments: string[] }[]) => {
    const entries = all.filter((e) => !isJunk(e.file.name));
    if (!entries.length) {
      toast.info("Nur Systemdateien (z. B. desktop.ini) – nichts importiert");
      return;
    }
    if (!uid) {
      toast.error("Nicht angemeldet");
      return;
    }
    const cache = new Map<string, string | null>([["", current.id]]);


    const ensureFolder = async (segments: string[]): Promise<string | null> => {
      const key = segments.join("/");
      if (cache.has(key)) return cache.get(key)!;
      const parent = await ensureFolder(segments.slice(0, -1));
      const name = segments[segments.length - 1];
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: uid, parent_id: parent, name })
        .select("id")
        .single();
      if (error) throw error;
      cache.set(key, data.id);
      return data.id;
    };

    const bytesTotal = entries.reduce((s, e) => s + e.file.size, 0);
    const started = Date.now();
    let bytesDone = 0;
    setProgress({
      done: 0,
      total: entries.length,
      bytesDone: 0,
      bytesTotal,
      started,
      name: entries[0]?.file.name ?? "",
    });

    const failed: { name: string; reason: string }[] = [];

    for (let i = 0; i < entries.length; i++) {
      const { file, segments } = entries[i];
      setProgress((p) => (p ? { ...p, name: file.name } : p));
      // Einzelne Fehler dürfen den restlichen Import nicht abbrechen.
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const folderId = await ensureFolder(segments);
          await uploadFile(file, folderId);
          break;
        } catch (err) {
          if (attempt === 3) {
            failed.push({ name: file.name, reason: (err as Error).message });
          } else {
            await new Promise((r) => setTimeout(r, 400 * attempt));
          }
        }
      }
      bytesDone += file.size;
      const doneCount = i + 1;
      setProgress((p) => (p ? { ...p, done: doneCount, bytesDone } : p));
    }
    setProgress(null);
    return { total: entries.length, failed };
  };

  const uploadEntries = useMutation({
    mutationFn: runUpload,
    onSuccess: (res) => {
      invalidate();
      if (!res) return;
      if (res.failed.length) {
        toast.error(
          `${res.failed.length} von ${res.total} Dateien fehlgeschlagen: ${res.failed
            .slice(0, 3)
            .map((f) => `${f.name} (${f.reason})`)
            .join(", ")}`,
        );
        return;
      }
      toast.success("Import abgeschlossen");
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error(e.message);
    },
  });


  const fromFileList = (files: FileList) =>
    Array.from(files).map((file) => {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return { file, segments: rel.split("/").slice(0, -1) };
    });

  const [dragging, setDragging] = useState(false);

  const readEntry = async (
    entry: FileSystemEntry,
    segments: string[],
    out: { file: File; segments: string[] }[],
  ): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej),
      );
      out.push({ file, segments });
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
        reader.readEntries(res, rej),
      );
      if (!batch.length) break;
      children.push(...batch);
    }
    for (const child of children) await readEntry(child, [...segments, entry.name], out);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = Array.from(e.dataTransfer.items ?? []);
    const out: { file: File; segments: string[] }[] = [];
    const entries = items
      .map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null))
      .filter(Boolean) as FileSystemEntry[];
    if (entries.length) {
      for (const entry of entries) await readEntry(entry, [], out);
    } else if (e.dataTransfer.files?.length) {
      out.push(...fromFileList(e.dataTransfer.files));
    }
    if (out.length) uploadEntries.mutate(out);
  };




  const [confirmDel, setConfirmDel] = useState<{
    table: "folders" | "documents";
    id: string;
    name: string;
  } | null>(null);

  const softDelete = useMutation({
    mutationFn: async ({ table, id }: { table: "folders" | "documents"; id: string }) => {
      if (!uid) throw new Error("Nicht angemeldet");
      if (table === "folders") {
        await softDeleteFolder(id, uid);
        return;
      }
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;
    },

    onSuccess: () => {
      invalidate();
      toast.success("In den Papierkorb verschoben");
    },
    onError: (e: Error) => toast.error(e.message || "Löschen fehlgeschlagen"),
  });

  const doRename = useMutation({
    mutationFn: async (r: { table: "folders" | "documents"; id: string; name: string }) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from(r.table)
        .update({ name: r.name })
        .eq("id", r.id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      setRename(null);
      invalidate();
      toast.success("Umbenannt");
    },
  });

  const favorites = useQuery({
    queryKey: ["favorite-folders", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return [];
      const { data, error } = await supabase
        .from("folders")
        .select("id,name")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .eq("is_favorite", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("folders")
        .update({ is_favorite: value })
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["favorite-folders", uid] });
      toast.success(v.value ? "Zu Favoriten hinzugefügt" : "Aus Favoriten entfernt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openFolder = async (id: string, name: string) => {
    if (!uid) return;
    const crumbs: Crumb[] = [];
    let cur: string | null = id;
    while (cur) {
      const res: { data: { id: string; name: string; parent_id: string | null } | null } =
        await supabase
          .from("folders")
          .select("id,name,parent_id")
          .eq("id", cur)
          .eq("user_id", uid)
          .maybeSingle();
      const data = res.data;
      if (!data) break;
      crumbs.unshift({ id: data.id, name: data.name });
      cur = data.parent_id;
    }
    setPath([{ id: null, name: "Library" }, ...(crumbs.length ? crumbs : [{ id, name }])]);
  };

  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [freeNotes, setFreeNotes] = useState(false);
  const [noteDoc, setNoteDoc] = useState<{ notebookId: string; name: string } | null>(null);
  const open = (d: {
    id: string;
    name: string;
    storage_path: string;
    mime_type: string | null;
    kind?: string | null;
    notebook_id?: string | null;
  }) => {
    if (d.kind === "note" && d.notebook_id) {
      setNoteDoc({ notebookId: d.notebook_id, name: d.name });
      return;
    }
    setPreview({
      id: d.id,
      name: d.name,
      storage_path: d.storage_path,
      mime_type: d.mime_type,
      folder_id: current.id,
    });
  };


  return (
    <div
      className="relative space-y-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => void onDrop(e)}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[2px]">
          <span className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium">
            <Upload className="size-4 text-primary" /> Dateien oder Ordner hier ablegen
          </span>
        </div>
      )}
      <div className="glass flex flex-wrap items-center gap-3 rounded-3xl p-4">

        <div className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {path.map((c, i) => (
            <span key={`${c.id ?? "root"}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
              <button
                className={
                  i === path.length - 1
                    ? "font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }
                onClick={() => setPath(path.slice(0, i + 1))}
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newFolder}
            placeholder="Neuer Ordner"
            className="h-9 w-44 rounded-2xl"
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolder.trim()) createFolder.mutate(newFolder.trim());
            }}
          />
          <Button
            variant="secondary"
            className="rounded-2xl"
            disabled={!newFolder.trim()}
            onClick={() => createFolder.mutate(newFolder.trim())}
          >
            <FolderPlus className="size-4" />
          </Button>
          <Button
            variant="secondary"
            className="rounded-2xl"
            aria-label="Freie Notizen"
            title="Notizen ohne Dokument"
            onClick={() => setFreeNotes(true)}
          >
            <NotebookPen className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-2xl" aria-label="Importieren">
                <Upload className="size-4" />
                <span className="hidden sm:inline">Importieren</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass rounded-2xl">
              <DropdownMenuItem onClick={() => fileInput.current?.click()}>
                <FilePlus2 className="size-4" /> Dateien
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => folderInput.current?.click()}>
                <FolderUp className="size-4" /> Ordner
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) uploadEntries.mutate(fromFileList(e.target.files));
              e.target.value = "";
            }}

          />
          <input
            ref={folderInput}
            type="file"
            multiple
            hidden
            // @ts-expect-error nicht-standardisierte Ordner-Auswahl
            webkitdirectory=""
            directory=""
            onChange={(e) => {
              if (e.target.files?.length) uploadEntries.mutate(fromFileList(e.target.files));
              e.target.value = "";
            }}

          />

        </div>
      </div>

      {progress && (
        <div className="glass space-y-2 rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Upload className="size-4 shrink-0 animate-pulse text-primary" />
              <span className="truncate font-medium">{progress.name}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {progress.done}/{progress.total} · {remainingLabel(progress)}
            </span>
          </div>
          <Progress
            value={
              progress.bytesTotal
                ? (progress.bytesDone / progress.bytesTotal) * 100
                : (progress.done / Math.max(progress.total, 1)) * 100
            }
          />
          <p className="text-xs text-muted-foreground">
            {mb(progress.bytesDone)} von {mb(progress.bytesTotal)} hochgeladen
          </p>
        </div>
      )}

      {!current.id && !!favorites.data?.length && (
        <div className="glass flex flex-wrap items-center gap-2 rounded-3xl p-4">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Star className="size-4 fill-primary text-primary" /> Favoriten
          </span>
          {favorites.data.map((f) => (
            <button
              key={f.id}
              onClick={() => void openFolder(f.id, f.name)}
              className="glass-soft hover:bg-primary-soft flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm"
            >
              <Folder className="size-4 text-primary" />
              <span className="max-w-40 truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {folders.data?.map((f) => (
          <div
            key={f.id}
            className="glass group flex items-center gap-3 rounded-3xl p-4 transition-transform hover:-translate-y-0.5"
          >
            <button
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => setPath([...path, { id: f.id, name: f.name }])}
            >
              <span className="bg-primary-soft flex size-10 items-center justify-center rounded-2xl">
                <Folder className="size-5 text-primary" />
              </span>
              <span className="truncate font-medium">{f.name}</span>
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-2xl"
              title={f.is_favorite ? "Favorit entfernen" : "Als Favorit markieren"}
              onClick={() => toggleFavorite.mutate({ id: f.id, value: !f.is_favorite })}
            >
              <Star
                className={cn("size-4", f.is_favorite && "fill-primary text-primary")}
              />
            </Button>
            <RowMenu
              onRename={() => setRename({ table: "folders", id: f.id, name: f.name })}
              onDelete={() => setConfirmDel({ table: "folders", id: f.id, name: f.name })}
            />
          </div>
        ))}


        {docs.data?.map((d) => (
          <div
            key={d.id}
            className="glass group flex items-center gap-3 rounded-3xl p-4 transition-transform hover:-translate-y-0.5"
          >
            <button className="flex flex-1 items-center gap-3 text-left" onClick={() => open(d)}>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-muted">
                {d.kind === "note" ? (
                  <NotebookPen className="size-5 text-primary" />
                ) : (
                  <FileText className="size-5 text-muted-foreground" />
                )}
              </span>

              <span className="min-w-0">
                <span className="block truncate font-medium">{d.name}</span>
              </span>

            </button>
            <RowMenu
              onOpen={() => open(d)}
              onRename={() => setRename({ table: "documents", id: d.id, name: d.name })}
              onDelete={() => setConfirmDel({ table: "documents", id: d.id, name: d.name })}
            />
          </div>
        ))}

        {!folders.isLoading &&
          !docs.isLoading &&
          !folders.data?.length &&
          !docs.data?.length && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Dieser Ordner ist leer. Lege einen Unterordner an oder lade Dateien hoch.
            </p>
          )}
      </div>

      <Dialog open={!!rename} onOpenChange={(o) => !o && setRename(null)}>
        <DialogContent className="glass rounded-3xl">
          <DialogHeader>
            <DialogTitle>Umbenennen</DialogTitle>
          </DialogHeader>
          <Input
            className="rounded-2xl"
            value={rename?.name ?? ""}
            onChange={(e) => setRename((r) => (r ? { ...r, name: e.target.value } : r))}
          />
          <DialogFooter>
            <Button
              className="rounded-2xl"
              disabled={!rename?.name.trim()}
              onClick={() => rename && doRename.mutate(rename)}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        name={confirmDel?.name ?? ""}
        title={confirmDel?.table === "folders" ? "Ordner löschen" : "Datei löschen"}
        description={
          confirmDel?.table === "folders"
            ? `„${confirmDel?.name}“ wird mit allen Unterordnern und Dateien in den Papierkorb verschoben.`
            : `„${confirmDel?.name}“ wird in den Papierkorb verschoben.`
        }
        confirmLabel="In den Papierkorb"
        onConfirm={async () => {
          if (!confirmDel) return;
          await softDelete.mutateAsync({ table: confirmDel.table, id: confirmDel.id });
          setConfirmDel(null);
        }}
      />

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      <FreeNotesOverlay
        key={current.id ?? "root"}
        open={freeNotes}
        folderId={current.id}
        onClose={() => setFreeNotes(false)}
      />
      <FreeNotesOverlay
        key={noteDoc?.notebookId ?? "note"}
        open={!!noteDoc}
        folderId={current.id}
        notebookId={noteDoc?.notebookId ?? null}
        title={noteDoc?.name}
        onClose={() => {
          setNoteDoc(null);
          invalidate();
        }}
      />

    </div>
  );
}

function RowMenu({
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

function mb(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function remainingLabel(p: {
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  started: number;
}) {
  const elapsed = (Date.now() - p.started) / 1000;
  const ratio = p.bytesTotal ? p.bytesDone / p.bytesTotal : p.done / Math.max(p.total, 1);
  if (!ratio || elapsed < 0.5) return "Restzeit wird berechnet…";
  const rest = Math.max(0, Math.round(elapsed / ratio - elapsed));
  if (rest < 60) return `noch ca. ${rest}s`;
  return `noch ca. ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")} min`;
}
