import { useEffect, useState } from "react";
import { Download, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HeaderTimers } from "@/components/GlobalTimer";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { PdfAnnotator } from "@/components/PdfAnnotator";
import { DocumentNotes } from "@/components/DocumentNotes";
import { DocxViewer } from "@/components/DocxViewer";
import { useIsMobile } from "@/hooks/use-mobile";

export type PreviewDoc = {
  id?: string;
  name: string;
  storage_path: string;
  mime_type?: string | null;
  folder_id?: string | null;
  /** Direkt zu dieser Seite springen (Treffer der Volltextsuche). */
  page?: number | null;
};

/** In-app preview overlay for documents (no extra browser window). */
export function DocumentPreview({
  doc,
  onClose,
}: {
  doc: PreviewDoc | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [isTouch, setIsTouch] = useState(false);
  const [notepad, setNotepad] = useState(false);
  const [split, setSplit] = useState(60);
  // iPad/Tablets rendern PDFs im iframe oft nur als erste Seite -> Canvas-Viewer nutzen.
  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const useCanvas = isMobile || isTouch;




  useEffect(() => {
    setUrl(null);
    if (!doc) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 60 * 30);
      if (cancelled) return;
      if (error || !data) {
        toast.error("Datei konnte nicht geladen werden");
        onClose();
        return;
      }
      setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, onClose]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, onClose]);

  if (!doc) return null;

  const mime = doc.mime_type ?? "";
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf" || doc.name.toLowerCase().endsWith(".pdf");
  const lower = doc.name.toLowerCase();
  const isDocx =
    lower.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isLegacyDoc = lower.endsWith(".doc") || mime === "application/msword";
  const embeddable = isImage || isPdf || mime.startsWith("text/");

  const canAnnotate = isPdf && !!doc.id;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-foreground/20 p-2 backdrop-blur-[2px] lg:p-4">
      <div className="glass flex shrink-0 items-center gap-2 rounded-3xl px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{doc.name}</span>
        <HeaderTimers />
        {doc.id && (
          <Button
            variant={notepad ? "default" : "secondary"}
            size="icon"
            className="rounded-2xl"
            onClick={() => setNotepad((v) => !v)}
            title={notepad ? "Notizen ausblenden" : "Notizen einblenden"}
          >
            {notepad ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
        )}
        {url && (
          <Button asChild variant="secondary" size="icon" className="rounded-2xl">
            <a href={url} download={doc.name} title="Herunterladen">
              <Download className="size-4" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onClose} title="Schließen">
          <X className="size-4" />
        </Button>
      </div>

      {doc.id && notepad && (
        <div className="glass mt-2 flex shrink-0 items-center gap-3 rounded-3xl px-4 py-1.5">
          <span className="text-[11px] text-muted-foreground">Dokument</span>
          <input
            type="range"
            min={20}
            max={80}
            step={1}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            className="h-1 flex-1 accent-primary"
            title="Aufteilung Dokument / Notizen"
          />
          <span className="text-[11px] text-muted-foreground">Notizen</span>
        </div>
      )}

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        <div
          className="glass flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl p-0"
          style={doc.id && notepad ? { flex: `1 1 ${split}%` } : undefined}
        >
          {!url ? (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          ) : isImage ? (
            <img src={url} alt={doc.name} className="max-h-full max-w-full object-contain" />
          ) : canAnnotate ? (
            <PdfAnnotator url={url} documentId={doc.id!} initialPage={doc.page ?? null} />
          ) : isPdf && useCanvas ? (
            <PdfCanvasViewer url={url} initialPage={doc.page ?? null} />
          ) : isDocx ? (
            <DocxViewer url={url} name={doc.name} />
          ) : isLegacyDoc ? (
            <div className="space-y-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Ältere Word-Dateien (.doc) können nicht direkt angezeigt werden. Speichere sie als
                .docx oder PDF – oder lade sie hier herunter.
              </p>
              <Button asChild className="rounded-2xl">
                <a href={url} download={doc.name}>
                  <Download className="size-4" /> Herunterladen
                </a>
              </Button>
            </div>
          ) : embeddable ? (
            <iframe
              src={doc.page && isPdf ? `${url}#page=${doc.page}` : url}
              title={doc.name}
              className="size-full rounded-3xl bg-background"
            />
          ) : (
            <div className="space-y-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Für diesen Dateityp gibt es keine Vorschau.
              </p>
              <Button asChild className="rounded-2xl">
                <a href={url} download={doc.name}>
                  <Download className="size-4" /> Herunterladen
                </a>
              </Button>
            </div>
          )}
        </div>
        {doc.id && notepad && (
          <div
            className="glass min-h-0 flex-1 overflow-hidden rounded-3xl p-0"
            style={{ flex: `1 1 ${100 - split}%` }}
          >
            <DocumentNotes
              key={doc.id}
              documentId={doc.id}
              saveFolderId={doc.folder_id ?? null}
              suggestedName={`Notizen – ${doc.name.replace(/\.[^.]+$/, "")}`}
            />

          </div>
        )}
      </div>


    </div>
  );
}
