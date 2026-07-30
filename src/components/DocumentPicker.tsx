import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Folder, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReactNode } from "react";

export type PickedDocument = { id: string; name: string; path: string };
export type PickedFolder = { id: string; name: string; path: string };

type Crumb = { id: string | null; name: string };

export function DocumentPicker({
  trigger,
  onPick,
  onPickFolder,
}: {
  trigger: ReactNode;
  onPick: (doc: PickedDocument) => void;
  onPickFolder?: (folder: PickedFolder) => void;
}) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "Library" }]);
  const current = path[path.length - 1];


  const folders = useQuery({
    queryKey: ["picker-folders", current.id],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("folders").select("id,name").is("deleted_at", null).order("name");
      q = current.id ? q.eq("parent_id", current.id) : q.is("parent_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const docs = useQuery({
    queryKey: ["picker-docs", current.id],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("documents").select("id,name").is("deleted_at", null).order("name");
      q = current.id ? q.eq("folder_id", current.id) : q.is("folder_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPath([{ id: null, name: "Library" }]);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="glass max-h-[80vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Dokument aus der Library wählen</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1 text-sm">
          {path.map((c, i) => (
            <span key={`${c.id ?? "root"}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
              <button
                className={
                  i === path.length - 1 ? "font-semibold" : "text-muted-foreground hover:text-foreground"
                }
                onClick={() => setPath(path.slice(0, i + 1))}
              >
                {i === 0 ? <Home className="size-4" /> : c.name}
              </button>
            </span>
          ))}
        </div>

        <div className="space-y-1.5">
          {folders.data?.map((f) => (
            <button
              key={f.id}
              className="glass-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left"
              onClick={() => setPath([...path, { id: f.id, name: f.name }])}
            >
              <Folder className="size-4 text-primary" />
              <span className="truncate text-sm font-medium">{f.name}</span>
            </button>
          ))}
          {docs.data?.map((d) => (
            <button
              key={d.id}
              className="glass-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-primary-soft"
              onClick={() => {
                const folderPath = path
                  .slice(1)
                  .map((c) => c.name)
                  .join(" / ");
                onPick({ id: d.id, name: d.name, path: folderPath });
                setOpen(false);
                setPath([{ id: null, name: "Library" }]);
              }}
            >
              <FileText className="size-4 text-muted-foreground" />
              <span className="truncate text-sm">{d.name}</span>
            </button>
          ))}
          {!folders.data?.length && !docs.data?.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">Dieser Ordner ist leer.</p>
          )}
        </div>

        <div className="flex gap-2">
          {onPickFolder && current.id && (
            <Button
              className="flex-1 rounded-2xl"
              onClick={() => {
                onPickFolder({
                  id: current.id!,
                  name: current.name,
                  path: path
                    .slice(1, -1)
                    .map((c) => c.name)
                    .join(" / "),
                });
                setOpen(false);
                setPath([{ id: null, name: "Library" }]);
              }}
            >
              Ganzen Ordner übernehmen
            </Button>
          )}
          <Button variant="ghost" className="rounded-2xl" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
