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

  const library = useQuery({
    queryKey: ["library-search-index"],
    enabled: open,
    queryFn: async () => {
      // Seitenweise laden: pro Abfrage liefert der Server max. 1000 Zeilen
      const fetchAll = async <T,>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => {
        const page = 1000;
        const all: T[] = [];
        for (let from = 0; ; from += page) {
          const { data, error } = await build(from, from + page - 1);
          if (error) throw new Error(error.message);
          const batch = data ?? [];
          all.push(...batch);
          if (batch.length < page) break;
        }
        return all;
      };

      const [docs, allFolders] = await Promise.all([
        fetchAll<{ id: string; name: string; storage_path: string; mime_type: string | null; folder_id: string | null }>((from, to) =>
          supabase
            .from("documents")
            .select("id,name,storage_path,mime_type,folder_id")
            .is("deleted_at", null)
            .not("name", "ilike", "desktop.ini")
            .order("id")
            .range(from, to),
        ),
        fetchAll<FolderNode>((from, to) =>
          supabase.from("folders").select("id,name,parent_id").is("deleted_at", null).order("id").range(from, to),
        ),
      ]);
      return { docs, folders: allFolders };
    },
  });

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[_\-/.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const tokens = norm(q).split(" ").filter(Boolean);
  const matches = (haystack: string) => {
    const h = norm(haystack);
    return tokens.every((t) => h.includes(t));
  };

  const allFolders = library.data?.folders ?? [];
  const results = {
    isLoading: library.isLoading,
    data: q
      ? {
          folders: allFolders
            .map((f) => ({ ...f, path: folderPath(f.id, allFolders) }))
            .filter((f) => matches(`${f.name} ${f.path}`))
            .slice(0, 25),
          docs: (library.data?.docs ?? [])
            .map((d) => ({ ...d, path: folderPath(d.folder_id, allFolders) }))
            .filter((d) => matches(`${d.name} ${d.path}`))
            .slice(0, 100),
        }
      : undefined,
  };


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
                <div className="min-w-0 text-left">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  {f.path && (
                    <span className="block truncate text-xs text-muted-foreground">{f.path}</span>
                  )}
                </div>
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
                  <div className="min-w-0">
                    <span className="block truncate text-sm">{d.name}</span>
                    {d.path && (
                      <span className="block truncate text-xs text-muted-foreground">{d.path}</span>
                    )}
                  </div>
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
