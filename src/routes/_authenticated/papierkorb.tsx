import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Folder, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/papierkorb")({
  head: () => ({
    meta: [
      { title: "Papierkorb – Gelöschtes wiederherstellen" },
      {
        name: "description",
        content:
          "Gelöschte Ordner und Dateien wiederherstellen oder mit Namensbestätigung endgültig entfernen.",
      },
      { property: "og:title", content: "Papierkorb – Gelöschtes wiederherstellen" },
      { property: "og:description", content: "Erschwertes Löschen schützt vor Versehen." },
    ],
  }),
  component: TrashPage,
});

function TrashPage() {
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
      const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Wiederhergestellt");
    },
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
      if (storagePath) await supabase.storage.from("documents").remove([storagePath]);
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Endgültig gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empty =
    !trash.data?.folders.length && !trash.data?.documents.length && !trash.isLoading;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="glass rounded-3xl p-4">
        <h1 className="text-lg font-semibold">Papierkorb</h1>
        <p className="text-sm text-muted-foreground">
          Wiederherstellen oder endgültig löschen – dafür musst du den Namen exakt eintippen.
        </p>
      </div>

      <div className="space-y-2.5">
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
            onPurge={() =>
              purge.mutate({ table: "documents", id: d.id, storagePath: d.storage_path })
            }
          />
        ))}
        {empty && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Der Papierkorb ist leer.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  name,
  onRestore,
  onPurge,
}: {
  icon: React.ReactNode;
  name: string;
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-3xl p-4">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onRestore}>
        <RotateCcw className="size-4" />
      </Button>
      <ConfirmDelete name={name} onConfirm={onPurge}>
        <Button variant="ghost" size="icon" className="rounded-2xl text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </ConfirmDelete>
    </div>
  );
}
