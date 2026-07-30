import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Folder, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { purgeDocuments, purgeFolder, restoreFolder, type PurgeProgress } from "@/lib/tree";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export function TrashPanel() {
  const qc = useQueryClient();

  const trash = useQuery({
    queryKey: ["trash"],
    queryFn: async () => {
      const [f, d] = await Promise.all([
        supabase.from("folders").select("*").not("deleted_at", "is", null),
        supabase.from("documents").select("*").not("deleted_at", "is", null),
      ]);
      if (f.error) throw f.error;
      if (d.error) throw d.error;
      return { folders: f.data, documents: d.data };
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["trash"] });
    void qc.invalidateQueries({ queryKey: ["folders"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const restore = useMutation({
    mutationFn: async ({ table, id }: { table: "folders" | "documents"; id: string }) => {
      if (table === "folders") {
        await restoreFolder(id);
        return;
      }
      const { error } = await supabase.from("documents").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Wiederhergestellt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [progress, setProgress] = useState<PurgeProgress | null>(null);
  const started = useRef(0);

  const begin = () => {
    started.current = Date.now();
    setProgress({ done: 0, total: 1, label: "Löschen wird vorbereitet…" });
  };
  const track = (p: PurgeProgress) => setProgress(p);

  const purge = useMutation({
    mutationFn: async ({
      table,
      id,
      storagePath,
    }: {
      table: "folders" | "documents";
      id: string;
      storagePath?: string | null;
    }) => {
      begin();
      if (table === "folders") {
        await purgeFolder(id, track);
        return;
      }
      await purgeDocuments([{ id, storage_path: storagePath }], track);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Endgültig gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setProgress(null),
  });


  const purgeAll = useMutation({
    mutationFn: async () => {
      begin();
      const docs = trash.data?.documents ?? [];
      const folders = trash.data?.folders ?? [];
      const total = docs.length + folders.length;
      await purgeDocuments(docs, track, 0, total);
      // Unterordner zuerst löschen, damit Verweise nicht blockieren
      const byDepth = [...folders].sort((a, b) => depth(b, folders) - depth(a, folders));
      let done = docs.length;
      for (const f of byDepth) {
        const { error } = await supabase.from("folders").delete().eq("id", f.id);
        if (error) throw error;
        done++;
        track({ done, total, label: `Ordner werden gelöscht (${done}/${total})` });
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Papierkorb wurde geleert");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setProgress(null),
  });

  const deletedFolderIds = new Set((trash.data?.folders ?? []).map((f) => f.id));
  const topFolders = (trash.data?.folders ?? []).filter(
    (f) => !f.parent_id || !deletedFolderIds.has(f.parent_id),
  );
  const looseDocs = (trash.data?.documents ?? []).filter(
    (d) => !d.folder_id || !deletedFolderIds.has(d.folder_id),
  );

  const empty = !trash.data?.folders.length && !trash.data?.documents.length && !trash.isLoading;

  return (
    <div className="space-y-2.5">
      {!empty && (
        <div className="flex justify-end pb-2">
          <ConfirmDelete
            name="Papierkorb"
            title="Papierkorb komplett leeren"
            description="Alle Ordner und Dateien im Papierkorb werden endgültig gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden."
            onConfirm={() => purgeAll.mutateAsync()}
          >
            <Button variant="outline" size="sm" className="rounded-2xl text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-4 mr-2" />
              Alles löschen
            </Button>
          </ConfirmDelete>
        </div>
      )}

      {progress && (
        <div className="glass space-y-2 rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              <span className="truncate font-medium">{progress.label}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {speedLabel(progress, started.current)}
            </span>
          </div>
          <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
        </div>
      )}

      {topFolders.map((f) => (
        <Row
          key={f.id}
          icon={<Folder className="size-5 text-primary" />}
          name={f.name}
          hint="inkl. Inhalt"
          onRestore={() => restore.mutate({ table: "folders", id: f.id })}
          onPurge={() => purge.mutate({ table: "folders", id: f.id })}
        />
      ))}
      {looseDocs.map((d) => (
        <Row
          key={d.id}
          icon={<FileText className="size-5 text-muted-foreground" />}
          name={d.name}
          onRestore={() => restore.mutate({ table: "documents", id: d.id })}
          onPurge={() => purge.mutate({ table: "documents", id: d.id, storagePath: d.storage_path })}
        />
      ))}

      {empty && (
        <p className="py-10 text-center text-sm text-muted-foreground">Der Papierkorb ist leer.</p>
      )}
    </div>
  );
}

type FolderLike = { id: string; parent_id: string | null };

function depth(f: FolderLike, all: FolderLike[]): number {
  let d = 0;
  let cur = f;
  while (cur.parent_id) {
    const parent = all.find((x) => x.id === cur.parent_id);
    if (!parent) break;
    cur = parent;
    d++;
  }
  return d;
}

function Row({
  icon,
  name,
  hint,
  onRestore,
  onPurge,
}: {
  icon: ReactNode;
  name: string;
  hint?: string;
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div className="glass-soft flex items-center gap-3 rounded-2xl p-3">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {name}
        {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>

      <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onRestore} title="Wiederherstellen">
        <RotateCcw className="size-4" />
      </Button>
      <ConfirmDelete name={name} onConfirm={onPurge}>
        <Button variant="ghost" size="icon" className="rounded-2xl text-destructive" title="Endgültig löschen">
          <Trash2 className="size-4" />
        </Button>
      </ConfirmDelete>
    </div>
  );
}

function speedLabel(p: { done: number; total: number }, started: number) {
  const elapsed = (Date.now() - started) / 1000;
  if (!p.done || elapsed < 0.4) return "Geschwindigkeit wird ermittelt…";
  const rate = p.done / elapsed;
  const rest = Math.max(0, Math.round((p.total - p.done) / Math.max(rate, 0.01)));
  const restLabel =
    rest < 60 ? `noch ca. ${rest}s` : `noch ca. ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")} min`;
  return `${rate.toFixed(1)} Objekte/s · ${restLabel}`;
}
