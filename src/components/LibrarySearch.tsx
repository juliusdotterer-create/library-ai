import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eye, FileText, Folder, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FolderNode = { id: string; name: string; parent_id: string | null };

function folderPath(folderId: string | null, folders: FolderNode[]): string {
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let id: string | null = folderId;
  while (id) {
    const f = map.get(id);
    if (!f) break;
    parts.unshift(f.name);
    id = f.parent_id;
  }
  return parts.join(" -- ");
}

export function LibrarySearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const q = term.trim();
  const navigate = useNavigate();

  const results = useQuery({
    queryKey: ["library-search", q],
    enabled: open && q.length > 0,
    queryFn: async () => {
      const [docs, matchedFolders, allFolders] = await Promise.all([
        supabase
          .from("documents")
          .select("id,name,storage_path,mime_type,folder_id")
          .is("deleted_at", null)
          .not("name", "ilike", "desktop.ini")
          .ilike("name", `%${q}%`)
          .limit(25),
        supabase
          .from("folders")
          .select("id,name")
          .is("deleted_at", null)
          .ilike("name", `%${q}%`)
          .limit(25),
        supabase
          .from("folders")
          .select("id,name,parent_id")
          .is("deleted_at", null)
          .limit(1000),
      ]);
      if (docs.error) throw docs.error;
      if (matchedFolders.error) throw matchedFolders.error;
      if (allFolders.error) throw allFolders.error;

      const folderMap = new Map((allFolders.data ?? []).map((f) => [f.id, f]));
      const docsWithPath = (docs.data ?? []).map((d) => ({
        ...d,
        path: folderPath(d.folder_id, allFolders.data ?? []),
        folder: d.folder_id ? folderMap.get(d.folder_id) ?? null : null,
      }));
      return { docs: docsWithPath, folders: matchedFolders.data };
    },
  });

  const [preview, setPreview] = useState<PreviewDoc | null>(null);

  const goToFolder = (folderId: string | null) => {
    onOpenChange(false);
    void navigate({ to: "/library", search: { folder: folderId ?? "root" } });
  };

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
              <button
                key={f.id}
                onClick={() => goToFolder(f.id)}
                className="glass-soft hover:bg-primary-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left"
              >
                <Folder className="size-4 text-primary" />
                <span className="truncate text-sm font-medium">{f.name}</span>
              </button>
            ))}
            {results.data?.docs.map((d) => (
              <div
                key={d.id}
                className="glass-soft hover:bg-primary-soft flex items-center gap-2 rounded-2xl p-1.5"
              >
                <button
                  onClick={() => goToFolder(d.folder_id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{d.name}</span>
                </button>
                <button
                  aria-label="Vorschau"
                  onClick={() => openDoc(d)}
                  className="rounded-xl p-2 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="size-4" />
                </button>
              </div>
            ))}
            {q &&
              !results.isLoading &&
              !results.data?.docs.length &&
              !results.data?.folders.length && (
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
