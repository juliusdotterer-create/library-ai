import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Folder, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function LibrarySearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const q = term.trim();

  const results = useQuery({
    queryKey: ["library-search", q],
    enabled: open && q.length > 0,
    queryFn: async () => {
      const [docs, folders] = await Promise.all([
        supabase
          .from("documents")
          .select("id,name,storage_path,mime_type")
          .is("deleted_at", null)
          .ilike("name", `%${q}%`)
          .limit(25),
        supabase
          .from("folders")
          .select("id,name")
          .is("deleted_at", null)
          .ilike("name", `%${q}%`)
          .limit(25),
      ]);
      if (docs.error) throw docs.error;
      if (folders.error) throw folders.error;
      return { docs: docs.data, folders: folders.data };
    },
  });

  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const openDoc = (d: { name: string; storage_path: string; mime_type: string | null }) => {
    onOpenChange(false);
    setPreview({ name: d.name, storage_path: d.storage_path, mime_type: d.mime_type });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[80vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Library durchsuchen</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Dokumente und Ordner suchen…"
            className="rounded-2xl pl-9"
          />
        </div>

        <div className="space-y-1.5">
          {results.data?.folders.map((f) => (
            <div key={f.id} className="glass-soft flex items-center gap-3 rounded-2xl p-3">
              <Folder className="size-4 text-primary" />
              <span className="truncate text-sm font-medium">{f.name}</span>
            </div>
          ))}
          {results.data?.docs.map((d) => (
            <button
              key={d.id}
              onClick={() => openDoc(d)}
              className="glass-soft hover:bg-primary-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left"
            >
              <FileText className="size-4 text-muted-foreground" />
              <span className="truncate text-sm">{d.name}</span>
            </button>
          ))}
          {q && !results.isLoading && !results.data?.docs.length && !results.data?.folders.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nichts gefunden.</p>
          )}
          {!q && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tippe, um Dokumente und Ordner zu finden.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </>
  );
}
