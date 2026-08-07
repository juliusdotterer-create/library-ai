import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderTimers } from "@/components/GlobalTimer";
import { DocumentNotes } from "@/components/DocumentNotes";

/** Handschriftliche Notizen ohne Bezug zu einem Dokument. */
export function FreeNotesOverlay({
  open,
  onClose,
  folderId,
  notebookId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
  /** Gespeicherte Notiz aus der Library direkt öffnen. */
  notebookId?: string | null;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-foreground/20 p-2 backdrop-blur-[2px] lg:p-4">
      <div className="glass flex shrink-0 items-center gap-2 rounded-3xl px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title ?? "Freie Notizen"}
        </span>
        <HeaderTimers />
        <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onClose} title="Schließen">
          <X className="size-4" />
        </Button>
      </div>
      <div className="glass mt-2 min-h-0 flex-1 overflow-hidden rounded-3xl p-0">
        <DocumentNotes
          key={notebookId ?? folderId ?? "root"}
          folderId={notebookId ? null : folderId}
          notebookId={notebookId ?? null}
          saveFolderId={folderId}
          suggestedName={title}
        />
      </div>
    </div>
  );
}
