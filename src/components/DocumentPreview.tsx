import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDriveFileContent, markDriveDocSeen } from "@/lib/drive.functions";
import { base64ToBlob } from "@/lib/drive-client";
import { Button } from "@/components/ui/button";
import { HeaderTimers } from "@/components/GlobalTimer";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { PdfAnnotator } from "@/components/PdfAnnotator";
import { DocumentNotes } from "@/components/DocumentNotes";
import { DocxViewer } from "@/components/DocxViewer";
import { ImageViewer } from "@/components/ImageViewer";
import { SheetViewer } from "@/components/SheetViewer";
import { PptxViewer } from "@/components/PptxViewer";
import { MediaViewer } from "@/components/MediaViewer";
import { OdtViewer } from "@/components/OdtViewer";

import { useIsMobile } from "@/hooks/use-mobile";

export type PreviewDoc = {
  id?: string;
  name: string;
  storage_path: string;
  mime_type?: string | null;
  folder_id?: string | null;
  /** "gdrive": Datei liegt in Google Drive und wird über den Server geladen. */
  source?: string | null;
  /** Direkt zu dieser Seite springen (Treffer der Volltextsuche). */
  page?: number | null;
  /** Suchbegriff, der im PDF farblich markiert wird. */
  highlight?: string | null;
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
  const [matches, setMatches] = useState(0);
  const [active, setActive] = useState(0);
  const [showHits, setShowHits] = useState(true);
  const onMatchCount = useCallback((n: number) => {
    setMatches(n);
    setActive(0);
  }, []);
  useEffect(() => {
    setShowHits(true);
    setMatches(0);
    setActive(0);
  }, [doc?.id, doc?.highlight]);

  // iPad/Tablets rendern PDFs im iframe oft nur als erste Seite -> Canvas-Viewer nutzen.
  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const useCanvas = isMobile || isTouch;




  useEffect(() => {
    setUrl(null);
    if (!doc) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      if (doc.source === "gdrive" && doc.id) {
        try {
          const res = await getDriveFileContent({ data: { documentId: doc.id } });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(base64ToBlob(res.base64, res.mimeType));
          setUrl(objectUrl);
        } catch (e) {
          if (cancelled) return;
          toast.error(
            (e as Error).message === "DRIVE_FILE_MISSING"
              ? "Diese Datei wurde in Google Drive nicht gefunden."
              : "Datei konnte nicht aus Google Drive geladen werden",
          );
          onClose();
          return;
        }
        // Beim Öffnen gesehen-Status setzen („In Drive aktualisiert" verschwindet).
        void markDriveDocSeen({ data: { documentId: doc.id } }).catch(() => undefined);
        return;
      }
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
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
  const lower = doc.name.toLowerCase();
  const ext = lower.split(".").pop() ?? "";
  const isImage =
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg", "heic", "heif"].includes(ext);
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
  const isSheet =
    ["xlsx", "xlsm", "xlsb", "xls", "csv", "ods"].includes(ext) ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet" ||
    mime === "text/csv";
  const isDocx =
    lower.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isLegacyDoc = lower.endsWith(".doc") || mime === "application/msword";
  const isRtf = ext === "rtf" || mime === "application/rtf" || mime === "text/rtf";
  const isOdt = ext === "odt" || mime === "application/vnd.oasis.opendocument.text";
  const isPptx =
    ext === "pptx" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const isAudio = mime.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "flac"].includes(ext);
  const isVideo = mime.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);
  const embeddable = isPdf || (mime.startsWith("text/") && !isSheet && !isRtf);


  const canAnnotate = isPdf && !!doc.id;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-foreground/20 p-2 backdrop-blur-[2px] lg:p-4">
      <div className="glass flex shrink-0 items-center gap-2 rounded-3xl px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{doc.name}</span>
        {doc.highlight && showHits && canAnnotate && (
          <div className="glass-soft flex shrink-0 items-center gap-1 rounded-2xl px-1.5 py-0.5">
            <button
              type="button"
              title="Vorheriger Treffer"
              disabled={matches === 0}
              onClick={() => setActive((i) => (matches ? (i - 1 + matches) % matches : 0))}
              className="rounded-xl p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {matches ? `${active + 1}/${matches}` : "0"}
            </span>
            <button
              type="button"
              title="Nächster Treffer"
              disabled={matches === 0}
              onClick={() => setActive((i) => (matches ? (i + 1) % matches : 0))}
              className="rounded-xl p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              title="Markierung ausblenden"
              onClick={() => setShowHits(false)}
              className="rounded-xl p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
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
            <ImageViewer url={url} name={doc.name} />
          ) : canAnnotate ? (
            <PdfAnnotator
              url={url}
              documentId={doc.id!}
              initialPage={doc.page ?? null}
              highlight={showHits ? (doc.highlight ?? null) : null}
              activeMatch={active}
              onMatchCount={onMatchCount}
            />
          ) : isPdf && useCanvas ? (
            <PdfCanvasViewer
              url={url}
              initialPage={doc.page ?? null}
              highlight={showHits ? (doc.highlight ?? null) : null}
            />

          ) : isSheet ? (
            <SheetViewer url={url} name={doc.name} />
          ) : isPptx ? (
            <PptxViewer url={url} name={doc.name} />
          ) : isAudio ? (
            <MediaViewer url={url} name={doc.name} kind="audio" />
          ) : isVideo ? (
            <MediaViewer url={url} name={doc.name} kind="video" />
          ) : isOdt ? (
            <OdtViewer url={url} name={doc.name} />
          ) : isDocx ? (

            <DocxViewer url={url} name={doc.name} />
          ) : isLegacyDoc || isRtf ? (
            <DocxViewer url={url} name={doc.name} legacy />
          ) : embeddable ? (
            <iframe
              src={doc.page && isPdf ? `${url}#page=${doc.page}` : url}
              title={doc.name}
              className="size-full rounded-3xl bg-background"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
              <div className="rounded-3xl bg-muted/50 p-5">
                <File className="size-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="max-w-md truncate text-sm font-semibold">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ext ? `.${ext.toUpperCase()}` : "Unbekannter Typ"} – für diesen Dateityp gibt es
                  keine Vorschau.
                </p>
              </div>
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
