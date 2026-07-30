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
      if (table === "folders") {
        await purgeFolder(id);
        return;
      }
      await purgeDocuments([{ id, storage_path: storagePath }]);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Endgültig gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const purgeAll = useMutation({
    mutationFn: async () => {
      const docs = trash.data?.documents ?? [];
      const folders = trash.data?.folders ?? [];
      await purgeDocuments(docs);
      // Unterordner zuerst löschen, damit Verweise nicht blockieren
      const byDepth = [...folders].sort((a, b) => depth(b, folders) - depth(a, folders));
      for (const f of byDepth) {
        const { error } = await supabase.from("folders").delete().eq("id", f.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Papierkorb wurde geleert");
    },
    onError: (e: Error) => toast.error(e.message),
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
