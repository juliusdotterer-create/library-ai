import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HeaderTimers } from "@/components/GlobalTimer";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { useIsMobile } from "@/hooks/use-mobile";

export type PreviewDoc = {
  name: string;
  storage_path: string;
  mime_type?: string | null;
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
  const embeddable = isImage || isPdf || mime.startsWith("text/");

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-foreground/20 p-2 backdrop-blur-[2px] lg:p-4">
      <div className="glass flex shrink-0 items-center gap-2 rounded-3xl px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{doc.name}</span>
        <HeaderTimers />
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

      <div className="glass mt-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl p-0">
        {!url ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : isImage ? (
          <img src={url} alt={doc.name} className="max-h-full max-w-full object-contain" />
        ) : isPdf && useCanvas ? (
          <PdfCanvasViewer url={url} />
        ) : embeddable ? (
          <iframe src={url} title={doc.name} className="size-full rounded-3xl bg-background" />



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
    </div>
  );
}
