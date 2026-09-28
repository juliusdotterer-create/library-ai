import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CheckSquare,
  ChevronRight,
  Trash2,
  X,
  FilePlus2,
  Folder,
  FolderPlus,
  FolderUp,
  HardDrive,
  LayoutGrid,
  List,
  NotebookPen,
  RefreshCw,
  Star,
  Upload,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDocuments, useFolders } from "@/hooks/useLibrary";
import { cn } from "@/lib/utils";
import { useLibraryView, sortItems, SORT_LABELS, type SortKey } from "@/hooks/useLibraryView";
import { useLibraryUpload } from "@/hooks/useLibraryUpload";
import { restoreFolder, softDeleteFolder } from "@/lib/tree";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { EmptyState } from "@/components/EmptyState";
import { PullToRefresh } from "@/components/PullToRefresh";
import { LibrarySkeleton } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentCard, FolderCard } from "@/components/library/ItemCard";
import { VirtualGrid } from "@/components/library/VirtualGrid";
import { UploadProgressPanel } from "@/components/library/UploadProgressPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import { FreeNotesOverlay } from "@/components/FreeNotesOverlay";
import { DrivePicker } from "@/components/DrivePicker";
import {
  deltaSyncDrive,
  getDriveStatus,
  importDriveItems,
  syncDriveItems,
} from "@/lib/drive.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/library")({
  validateSearch: (search: Record<string, unknown>): { folder?: string; create?: "folder" } => ({
    folder: typeof search.folder === "string" ? search.folder : undefined,
    create: search.create === "folder" ? ("folder" as const) : undefined,
  }),
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
  const { user } = useAuth();
  const uid = user?.id;
  const search = useSearch({ strict: false }) as { folder?: string; create?: "folder" } | undefined;
  const folderParam = search?.folder;
  const createFolderParam = search?.create;
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "Library" }]);
  const current = path[path.length - 1];
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const [newFolder, setNewFolder] = useState("");
  const [rename, setRename] = useState<{
    table: "folders" | "documents";
    id: string;
    name: string;
    prev?: string;
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

  useEffect(() => {
    if (createFolderParam === "folder") {
      newFolderRef.current?.focus();
    }
  }, [createFolderParam]);

  const folders = useFolders(current.id);
  const docs = useDocuments(current.id);
  const { sort, view, setSort, setView } = useLibraryView();
  const sortedFolders = sortItems(folders.data ?? undefined, sort);
  const sortedDocs = sortItems(docs.data ?? undefined, sort);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["folders"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const { progress, indexing, dragging, dropZone, uploadFileList } = useLibraryUpload({
    uid,
    folderId: current.id,
    onDone: invalidate,
  });

  // ---- Google Drive ----
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const driveStatus = useQuery({
    queryKey: ["drive-status", uid],
    enabled: !!uid,
    queryFn: () => getDriveStatus({ data: undefined }),
    staleTime: 60_000,
  });
  const driveConnected = driveStatus.data?.connected === true;

  const driveImport = useMutation({
    mutationFn: (items: { id: string; name: string; mimeType: string }[]) =>
      importDriveItems({ data: { targetFolderId: current.id, items } }),
    onSuccess: (res) => {
      setDrivePickerOpen(false);
      invalidate();
      toast.success(
        `${res.createdDocs} Datei(en) und ${res.createdFolders} Ordner aus Drive hinzugefügt`,
      );
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "RECONNECT_REQUIRED"
          ? "Google-Zugriff muss in den Einstellungen erneuert werden."
          : e.message,
      ),
  });

  const driveSync = useMutation({
    mutationFn: async (scope?: { documentIds?: string[]; folderIds?: string[] }) => {
      const total = { added: 0, addedFolders: 0, changed: 0, missing: 0, failed: 0, checked: 0 };
      let cursor: Awaited<ReturnType<typeof syncDriveItems>>["cursor"] = null;
      const toastId = toast.loading("Drive-Abgleich läuft …");
      try {
        // „Alles abgleichen": nur Änderungen seit dem letzten Mal abfragen.
        if (!scope) {
          let needsFull = false;
          for (let i = 0; i < 200; i++) {
            const res = await deltaSyncDrive({ data: {} });
            total.added += res.added;
            total.addedFolders += res.addedFolders;
            total.changed += res.changed;
            total.missing += res.missing;
            total.failed += res.failed;
            total.checked += res.checked;
            if (res.needsFull) needsFull = true;
            toast.loading(`Drive-Änderungen: ${total.checked} geprüft …`, { id: toastId });
            if (res.done) break;
          }
          if (!needsFull) return total;
          toast.loading("Erster vollständiger Abgleich läuft …", { id: toastId });
        }
        // In 50er-Paketen weiterlaufen, bis alles geprüft ist.
        for (let i = 0; i < 2000; i++) {
          const res = await syncDriveItems({ data: { ...(scope ?? {}), cursor } });
          total.added += res.added;
          total.addedFolders += res.addedFolders;
          total.changed += res.changed;
          total.missing += res.missing;
          total.failed += res.failed;
          total.checked += res.checked;
          toast.loading(`Drive-Abgleich: ${total.checked} geprüft …`, { id: toastId });
          if (res.done) break;
          cursor = res.cursor;
        }
        return total;
      } finally {
        toast.dismiss(toastId);
      }
    },
    onSuccess: (res) => {
      invalidate();
      const parts: string[] = [];
      if (res.added) parts.push(`${res.added} neu`);
      if (res.addedFolders) parts.push(`${res.addedFolders} Ordner neu`);
      if (res.changed) parts.push(`${res.changed} aktualisiert`);
      if (res.missing) parts.push(`${res.missing} nicht mehr gefunden`);
      if (!parts.length && !res.failed) {
        toast.success(`Drive-Abgleich abgeschlossen – ${res.checked} geprüft, alles aktuell`);
      } else if (res.failed) {
        toast.error(`Abgleich teilweise fehlgeschlagen (${res.failed}). ${parts.join(", ")}`);
      } else {
        toast.success(`Drive-Abgleich: ${parts.join(", ")} (${res.checked} geprüft)`);
      }
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "RECONNECT_REQUIRED"
          ? "Google-Zugriff muss in den Einstellungen erneuert werden."
          : e.message,
      ),
  });

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

  const [confirmDel, setConfirmDel] = useState<{
    table: "folders" | "documents";
    id: string;
    name: string;
  } | null>(null);

  /** Optimistisch: Listen sofort anpassen, damit die UI nicht auf den Server wartet. */
  const patchList = (
    table: "folders" | "documents",
    apply: (rows: Record<string, unknown>[]) => Record<string, unknown>[],
  ) => {
    const snapshot = qc.getQueriesData({ queryKey: [table] });
    qc.setQueriesData({ queryKey: [table] }, (old: unknown) =>
      Array.isArray(old) ? apply(old as Record<string, unknown>[]) : old,
    );
    return snapshot;
  };

  const restore = (snapshot?: [readonly unknown[], unknown][]) => {
    snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
  };

  /** Rückgängig-Hinweis mit Knopf. */
  const undoToast = (message: string, undo: () => Promise<void>) => {
    toast.success(message, {
      duration: 10000,
      action: {
        label: "Rückgängig",
        onClick: () => {
          void (async () => {
            try {
              await undo();
              invalidate();
              void qc.invalidateQueries({ queryKey: ["trash"] });
              toast.success("Rückgängig gemacht");
            } catch (e) {
              toast.error((e as Error).message || "Rückgängig fehlgeschlagen");
            }
          })();
        },
      },
    });
  };

  const restoreItems = async (folderIds: string[], documentIds: string[]) => {
    if (!uid) throw new Error("Nicht angemeldet");
    for (const id of folderIds) await restoreFolder(id, uid);
    if (documentIds.length) {
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: null })
        .eq("user_id", uid)
        .in("id", documentIds);
      if (error) throw error;
    }
  };

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
    onMutate: ({ table, id }) => ({
      snapshot: patchList(table, (rows) => rows.filter((r) => r.id !== id)),
    }),
    onSuccess: (_d, v) => {
      invalidate();
      undoToast("In den Papierkorb verschoben", () =>
        restoreItems(v.table === "folders" ? [v.id] : [], v.table === "documents" ? [v.id] : []),
      );
    },
    onError: (e: Error, _v, ctx) => {
      restore(ctx?.snapshot);
      toast.error(e.message || "Löschen fehlgeschlagen");
    },
  });

  // ---- Schnellauswahl (Mehrfachlöschen) ----
  const [selectMode, setSelectMode] = useState(false);
  const [selFolders, setSelFolders] = useState<string[]>([]);
  const [selDocs, setSelDocs] = useState<string[]>([]);
  const selectedCount = selFolders.length + selDocs.length;
  const clearSelection = () => {
    setSelFolders([]);
    setSelDocs([]);
  };
  useEffect(() => {
    clearSelection();
  }, [current.id]);

  const toggleIn = (list: string[], id: string, on: boolean) =>
    on ? [...new Set([...list, id])] : list.filter((x) => x !== id);

  const bulkDelete = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Nicht angemeldet");
      for (const id of selFolders) await softDeleteFolder(id, uid);
      if (selDocs.length) {
        const stamp = new Date().toISOString();
        for (let i = 0; i < selDocs.length; i += 50) {
          const part = selDocs.slice(i, i + 50);
          const { error } = await supabase
            .from("documents")
            .update({ deleted_at: stamp })
            .eq("user_id", uid)
            .in("id", part);
          if (error) throw error;
        }
      }
      return { folderIds: [...selFolders], documentIds: [...selDocs] };
    },
    onMutate: () => {
      const s1 = patchList("folders", (rows) =>
        rows.filter((r) => !selFolders.includes(r.id as string)),
      );
      const s2 = patchList("documents", (rows) =>
        rows.filter((r) => !selDocs.includes(r.id as string)),
      );
      return { snapshot: [...s1, ...s2] };
    },
    onSuccess: (v) => {
      clearSelection();
      setSelectMode(false);
      invalidate();
      undoToast(
        `${v.folderIds.length + v.documentIds.length} Element(e) in den Papierkorb verschoben`,
        () => restoreItems(v.folderIds, v.documentIds),
      );
    },
    onError: (e: Error, _v, ctx) => {
      restore(ctx?.snapshot);
      toast.error(e.message || "Löschen fehlgeschlagen");
    },
  });

  const doRename = useMutation({
    mutationFn: async (r: {
      table: "folders" | "documents";
      id: string;
      name: string;
      prev?: string;
    }) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from(r.table)
        .update({ name: r.name })
        .eq("id", r.id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onMutate: (r) => {
      setRename(null);
      return {
        snapshot: patchList(r.table, (rows) =>
          rows.map((row) => (row.id === r.id ? { ...row, name: r.name } : row)),
        ),
      };
    },
    onSuccess: (_d, r) => {
      invalidate();
      if (!r.prev || r.prev === r.name) {
        toast.success("Umbenannt");
        return;
      }
      undoToast("Umbenannt", async () => {
        if (!uid) throw new Error("Nicht angemeldet");
        const { error } = await supabase
          .from(r.table)
          .update({ name: r.prev! })
          .eq("id", r.id)
          .eq("user_id", uid);
        if (error) throw error;
      });
    },
    onError: (e: Error, _v, ctx) => {
      restore(ctx?.snapshot);
      toast.error(e.message || "Umbenennen fehlgeschlagen");
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
    onMutate: ({ id, value }) => ({
      snapshot: patchList("folders", (rows) =>
        rows.map((row) => (row.id === id ? { ...row, is_favorite: value } : row)),
      ),
    }),
    onSuccess: (_d, v) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["favorite-folders", uid] });
      toast.success(v.value ? "Zu Favoriten hinzugefügt" : "Aus Favoriten entfernt");
    },
    onError: (e: Error, _v, ctx) => {
      restore(ctx?.snapshot);
      toast.error(e.message);
    },
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
    source?: string | null;
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
      source: d.source,
    });
  };

  return (
    <div className="relative space-y-5" {...dropZone}>
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
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="rounded-2xl text-muted-foreground"
                title="Sortierung"
                aria-label="Sortierung"
              >
                <ArrowUpDown className="size-4" />
                <span className="hidden lg:inline">{SORT_LABELS[sort]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass rounded-2xl">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSort(key)}
                  className={cn(sort === key && "font-semibold text-primary")}
                >
                  {SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-2xl text-muted-foreground"
            title={view === "grid" ? "Listenansicht" : "Kachelansicht"}
            aria-label={view === "grid" ? "Listenansicht" : "Kachelansicht"}
            onClick={() => setView(view === "grid" ? "list" : "grid")}
          >
            {view === "grid" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
          </Button>
          <Button
            variant={selectMode ? "default" : "ghost"}
            size="icon"
            className={cn("rounded-2xl", !selectMode && "text-muted-foreground")}
            title={selectMode ? "Auswahl beenden" : "Schnellauswahl"}
            aria-label={selectMode ? "Auswahl beenden" : "Schnellauswahl"}
            onClick={() => {
              clearSelection();
              setSelectMode((v) => !v);
            }}
          >
            <CheckSquare className="size-4" />
          </Button>
          {driveConnected && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-2xl text-muted-foreground"
                  title="Google Drive abgleichen"
                  aria-label="Google Drive abgleichen"
                  disabled={driveSync.isPending}
                >
                  <RefreshCw className={cn("size-4", driveSync.isPending && "animate-spin")} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass rounded-2xl">
                {current.id && (
                  <DropdownMenuItem
                    onClick={() => driveSync.mutate({ folderIds: [current.id!] })}
                  >
                    Diesen Ordner abgleichen
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => driveSync.mutate(undefined)}>
                  Alles abgleichen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Input
            ref={newFolderRef}
            value={newFolder}
            placeholder="Neuer Ordner"
            className="h-9 min-w-0 flex-1 rounded-2xl sm:w-44 sm:flex-none"
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
              {driveConnected && (
                <DropdownMenuItem onClick={() => setDrivePickerOpen(true)}>
                  <HardDrive className="size-4" /> Aus Google Drive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) uploadFileList(e.target.files);
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
              if (e.target.files?.length) uploadFileList(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <UploadProgressPanel progress={progress} indexing={indexing} />

      {selectMode && (
        <div className="glass sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-3xl p-3">
          <span className="text-sm font-semibold">{selectedCount} ausgewählt</span>
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => {
              setSelFolders(sortedFolders.map((f) => f.id));
              setSelDocs(sortedDocs.map((d) => d.id));
            }}
          >
            Alle
          </Button>
          <Button variant="ghost" className="rounded-2xl" onClick={clearSelection}>
            Keine
          </Button>
          <div className="flex-1" />
          <Button
            variant="destructive"
            className="rounded-2xl"
            disabled={!selectedCount || bulkDelete.isPending}
            onClick={() => bulkDelete.mutate()}
          >
            <Trash2 className="size-4" /> In den Papierkorb
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-2xl"
            aria-label="Auswahl beenden"
            onClick={() => {
              clearSelection();
              setSelectMode(false);
            }}
          >
            <X className="size-4" />
          </Button>
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

      <PullToRefresh onRefresh={invalidate} className="-mx-3 px-3 sm:-mx-5 sm:px-5">
        {folders.isLoading || docs.isLoading ? (
          <LibrarySkeleton view={view} />
        ) : (
          <VirtualGrid
            grid={view === "grid"}
            items={[
            ...sortedFolders.map((f) => ({ key: "f" + f.id, node: (
              <FolderCard
                key={f.id}
                folder={f}
                view={view}
                onOpen={() => setPath([...path, { id: f.id, name: f.name }])}
                onToggleFavorite={() => toggleFavorite.mutate({ id: f.id, value: !f.is_favorite })}
                onRename={() =>
                  setRename({ table: "folders", id: f.id, name: f.name, prev: f.name })
                }
                onDelete={() => setConfirmDel({ table: "folders", id: f.id, name: f.name })}
                onDriveSync={() => driveSync.mutate({ folderIds: [f.id] })}
                selectMode={selectMode}
                selected={selFolders.includes(f.id)}
                onSelectChange={(v) => setSelFolders((l) => toggleIn(l, f.id, v))}
              />
            )})),
            ...sortedDocs.map((d) => ({ key: "d" + d.id, node: (
              <DocumentCard
                key={d.id}
                doc={d}
                view={view}
                onOpen={() => open(d)}
                onRename={() =>
                  setRename({ table: "documents", id: d.id, name: d.name, prev: d.name })
                }
                onDelete={() => setConfirmDel({ table: "documents", id: d.id, name: d.name })}
                onDriveSync={() => driveSync.mutate({ documentIds: [d.id] })}
                selectMode={selectMode}
                selected={selDocs.includes(d.id)}
                onSelectChange={(v) => setSelDocs((l) => toggleIn(l, d.id, v))}
              />
            )})),
            ]}
            after={!sortedFolders.length && !sortedDocs.length && (
              <EmptyState
                icon={<Folder className="size-7" />}
                title={current.id ? "Dieser Ordner ist leer" : "Deine Library ist noch leer"}
                description={
                  current.id
                    ? "Lege einen Unterordner an oder lade Dateien hoch, um hier Inhalte zu sehen."
                    : "Erstelle Ordner oder importiere Dateien, um dein Studienarchiv aufzubauen."
                }
                action={{
                  label: "Ordner erstellen",
                  onClick: () => newFolderRef.current?.focus(),
                }}
              />
            )}
          />
        )}
      </PullToRefresh>

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
            ? `„${confirmDel?.name}“ wird mit allen Unterordnern und Dateien in den Papierkorb verschoben. In Google Drive bleibt alles unverändert.`
            : `„${confirmDel?.name}“ wird in den Papierkorb verschoben. Bei Google-Drive-Dateien bleibt die Datei in Drive erhalten.`
        }
        confirmLabel="In den Papierkorb"
        onConfirm={async () => {
          if (!confirmDel) return;
          await softDelete.mutateAsync({ table: confirmDel.table, id: confirmDel.id });
          setConfirmDel(null);
        }}
      />

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      <DrivePicker
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        importing={driveImport.isPending}
        onImport={(items) => driveImport.mutate(items)}
      />
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
