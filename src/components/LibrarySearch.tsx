import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Folder, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function LibrarySearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const q = term.trim();

  const results = useQuery({
    queryKey: ["library-search", q],
    enabled: open && q.length > 0,
    queryFn: async () => {
      const [docs, folders] = await Promise.all([
        supabase
          .from("documents")
          .select("id,name,storage_path")
          .is("deleted_at", null)
          .ilike("name", `%${q}%`)
          .limit(12),
        supabase
          .from("folders")
          .select("id,name")
          .is("deleted_at", null)
          .ilike("name", `%${q}%`)
          .limit(12),
      ]);
      if (docs.error) throw docs.error;
      if (folders.error) throw folders.error;
      return { docs: docs.data, folders: folders.data };
    },
  });

  const openDoc = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 600);
    if (error || !data) return toast.error("Datei konnte nicht geöffnet werden");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="hidden text-sm font-semibold tracking-tight hover:opacity-70 sm:block"
          aria-label="Library durchsuchen"
        >
          Library
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="glass w-80 rounded-3xl p-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Dokumente & Ordner suchen"
            className="h-9 rounded-2xl"
          />
        </div>

        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {results.data?.folders.map((f) => (
            <button
              key={f.id}
              className="flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/library", search: { folder: f.id, name: f.name } });
              }}
            >
              <Folder className="size-4 text-primary" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
          {results.data?.docs.map((d) => (
            <button
              key={d.id}
              className="flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setOpen(false);
                void openDoc(d.storage_path);
              }}
            >
              <FileText className="size-4 text-muted-foreground" />
              <span className="truncate">{d.name}</span>
            </button>
          ))}
          {q && !results.isLoading && !results.data?.docs.length && !results.data?.folders.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nichts gefunden.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
