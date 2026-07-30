import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Folder, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { purgeFolder, restoreFolder } from "@/lib/tree";

import { Button } from "@/components/ui/button";
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
      if (storagePath) await supabase.storage.from("documents").remove([storagePath]);
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
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
      const paths = docs.map((d) => d.storage_path).filter(Boolean) as string[];
      if (paths.length) {
        const { error } = await supabase.storage.from("documents").remove(paths);
        if (error) throw error;
      }
      if (docs.length) {
        const ids = docs.map((d) => d.id);
        const { error } = await supabase.from("documents").delete().in("id", ids);
        if (error) throw error;
      }
      if (folders.length) {
        const ids = folders.map((f) => f.id);
        const { error } = await supabase.from("folders").delete().in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Papierkorb wurde geleert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empty = !trash.data?.folders.length && !trash.data?.documents.length && !trash.isLoading;

  return (
    <div className="space-y-2.5">
      {!empty && (
        <div className="flex justify-end pb-2">
          <ConfirmDelete
            name="BESTÄTIGT"
            title="Papierkorb komplett leeren"
            description="Alle Ordner und Dateien im Papierkorb werden endgültig gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden. Tippe zur Bestätigung BESTÄTIGT ein."
            onConfirm={() => purgeAll.mutateAsync()}
          >
            <Button variant="outline" size="sm" className="rounded-2xl text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-4 mr-2" />
              Alles löschen
            </Button>
          </ConfirmDelete>
        </div>
      )}
      {trash.data?.folders.map((f) => (
        <Row
          key={f.id}
          icon={<Folder className="size-5 text-primary" />}
          name={f.name}
          onRestore={() => restore.mutate({ table: "folders", id: f.id })}
          onPurge={() => purge.mutate({ table: "folders", id: f.id })}
        />
      ))}
      {trash.data?.documents.map((d) => (
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

function Row({
  icon,
  name,
  onRestore,
  onPurge,
}: {
  icon: ReactNode;
  name: string;
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div className="glass-soft flex items-center gap-3 rounded-2xl p-3">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
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
