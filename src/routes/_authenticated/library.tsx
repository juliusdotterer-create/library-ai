import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { softDeleteFolder } from "@/lib/tree";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/library")({
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

function LibraryPage() {
  const qc = useQueryClient();
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

  const folders = useQuery({
    queryKey: ["folders", current.id],
    queryFn: async () => {
      let q = supabase.from("folders").select("*").is("deleted_at", null).order("name");
      q = current.id ? q.eq("parent_id", current.id) : q.is("parent_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const docs = useQuery({
    queryKey: ["documents", current.id],
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      q = current.id ? q.eq("folder_id", current.id) : q.is("folder_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["folders"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("folders")
        .insert({ name, parent_id: current.id, user_id: auth.user!.id });
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

  const uploadFile = async (file: File, uid: string, folderId: string | null) => {
    const storagePath = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, { contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { error } = await supabase.from("documents").insert({
      user_id: uid,
      folder_id: folderId,
      name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (error) throw error;
  };

  const runUpload = async (entries: { file: File; segments: string[] }[]) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user!.id;
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

    for (let i = 0; i < entries.length; i++) {
      const { file, segments } = entries[i];
      setProgress((p) => (p ? { ...p, name: file.name } : p));
      const folderId = await ensureFolder(segments);
      await uploadFile(file, uid, folderId);
      bytesDone += file.size;
      const doneCount = i + 1;
      setProgress((p) => (p ? { ...p, done: doneCount, bytesDone } : p));
    }
    setProgress(null);
  };

  const uploadEntries = useMutation({
    mutationFn: runUpload,
    onSuccess: () => {
      invalidate();
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




  const softDelete = useMutation({
    mutationFn: async ({ table, id }: { table: "folders" | "documents"; id: string }) => {
      if (table === "folders") {
        await softDeleteFolder(id);
        return;
      }
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    onSuccess: () => {
      invalidate();
      toast.success("In den Papierkorb verschoben");
    },
  });

  const doRename = useMutation({
    mutationFn: async (r: { table: "folders" | "documents"; id: string; name: string }) => {
      const { error } = await supabase.from(r.table).update({ name: r.name }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRename(null);
      invalidate();
      toast.success("Umbenannt");
    },
  });

  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const open = (d: { name: string; storage_path: string; mime_type: string | null }) =>
    setPreview({ name: d.name, storage_path: d.storage_path, mime_type: d.mime_type });

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-2xl">
                <Upload className="size-4" /> Importieren
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



      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {folders.data?.map((f) => (
          <div
            key={f.id}
            className="glass group flex items-center gap-3 rounded-3xl p-4 transition-transform hover:-translate-y-0.5"
          >
            <button
              className="flex flex-1 items-center gap-3 text-left"
              onClick={() => setPath([...path, { id: f.id, name: f.name }])}
            >
              <span className="bg-primary-soft flex size-10 items-center justify-center rounded-2xl">
                <Folder className="size-5 text-primary" />
              </span>
              <span className="truncate font-medium">{f.name}</span>
            </button>
            <RowMenu
              onRename={() => setRename({ table: "folders", id: f.id, name: f.name })}
              onDelete={() => softDelete.mutate({ table: "folders", id: f.id })}
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
                <FileText className="size-5 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{d.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {d.size_bytes ? `${Math.round(Number(d.size_bytes) / 1024)} KB` : ""}
                </span>
              </span>
            </button>
            <RowMenu
              onOpen={() => open(d)}
              onRename={() => setRename({ table: "documents", id: d.id, name: d.name })}
              onDelete={() => softDelete.mutate({ table: "documents", id: d.id })}
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

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
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
