import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listDriveChildren, type DriveItem } from "@/lib/drive.functions";
import { cn } from "@/lib/utils";

type Crumb = { id: string | null; name: string };

/**
 * Auswahlfenster für Google Drive: durch Ordner navigieren,
 * Dateien/Ordner mehrfach auswählen und importieren.
 */
export function DrivePicker({
  open,
  onOpenChange,
  onImport,
  importing,
  title = "Aus Google Drive hinzufügen",
  actionLabel = "Hinzufügen",
  busyLabel = "Importiere …",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (items: { id: string; name: string; mimeType: string }[]) => void;
  importing: boolean;
  title?: string;
  actionLabel?: string;
  busyLabel?: string;
}) {
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "Mein Drive" }]);
  const [selected, setSelected] = useState<Map<string, DriveItem>>(new Map());
  const current = path[path.length - 1];

  const { data, isLoading, error } = useQuery({
    queryKey: ["drive-children", current.id],
    queryFn: () => listDriveChildren({ data: { folderId: current.id } }),
    enabled: open,
  });
  const items = useMemo(() => data?.items ?? [], [data]);

  const toggle = (item: DriveItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  const reset = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setPath([{ id: null, name: "Mein Drive" }]);
      setSelected(new Map());
    }
  };

  if (error && (error as Error).message === "RECONNECT_REQUIRED") {
    toast.error("Google-Zugriff muss in den Einstellungen erneuert werden.");
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="size-4" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 overflow-x-auto text-sm">
          {path.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1 shrink-0">
              {i > 0 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
              <button
                className={cn(
                  "rounded-lg px-1.5 py-0.5 hover:bg-muted",
                  i === path.length - 1 && "font-medium",
                )}
                onClick={() => setPath(path.slice(0, i + 1))}
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>

        <div className="max-h-80 min-h-40 space-y-1 overflow-y-auto rounded-2xl border p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Dieser Ordner ist leer.
            </p>
          ) : (
            items.map((item) => {
              const active = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm",
                    active && "bg-accent",
                  )}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() =>
                      item.isFolder
                        ? setPath([...path, { id: item.id, name: item.name }])
                        : toggle(item)
                    }
                  >
                    <Folder
                      className={cn(
                        "size-4 shrink-0",
                        item.isFolder ? "text-primary" : "hidden",
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </button>
                  <Button
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="h-7 rounded-lg px-2 text-xs"
                    onClick={() => toggle(item)}
                  >
                    {active ? "Ausgewählt" : "Wählen"}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} ausgewählt
          </span>
          <Button
            className="rounded-xl"
            disabled={!selected.size || importing}
            onClick={() =>
              onImport(
                Array.from(selected.values()).map((s) => ({
                  id: s.id,
                  name: s.name,
                  mimeType: s.mimeType,
                })),
              )
            }
          >
            {importing ? "Importiere …" : "Hinzufügen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
