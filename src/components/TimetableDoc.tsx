import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Maximize2, Scan, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTimetableDoc, queryKeys } from "@/hooks/useLibrary";
import { Button } from "@/components/ui/button";
import {
  PDF_MAX_ZOOM,
  PDF_MIN_ZOOM,
  PdfCanvasViewer,
} from "@/components/PdfCanvasViewer";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { cn } from "@/lib/utils";
import { localDateKey } from "@/lib/timetable-today";

/**
 * Dauerhaft eingeblendetes Stundenplan-Dokument (PDF/Bild) inkl. Upload,
 * Austausch und Löschen. Liegt außerhalb der Library-Ordnerstruktur.
 */
export function TimetableDoc() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const { data: doc, isLoading } = useTimetableDoc();
  const [url, setUrl] = useState<string | null>(null);
  const [full, setFull] = useState<PreviewDoc | null>(null);
  const [height, setHeight] = useState(420);
  const [zoom, setZoom] = useState(1);
  const [todayDate, setTodayDate] = useState<string>();
  const [todayDetection, setTodayDetection] = useState<"found" | "absent" | "unreadable" | "error" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const zoomStorageKey = doc?.id ? `timetable-pdf-zoom:${doc.id}` : null;

  useEffect(() => {
    const refresh = () => setTodayDate(localDateKey(new Date()));
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => setTodayDetection(null), [url, todayDate]);

  useEffect(() => {
    if (!zoomStorageKey) {
      setZoom(1);
      return;
    }
    const stored = Number(window.localStorage.getItem(zoomStorageKey));
    setZoom(
      Number.isFinite(stored) && stored >= PDF_MIN_ZOOM && stored <= PDF_MAX_ZOOM ? stored : 1,
    );
  }, [zoomStorageKey]);

  const updateZoom = (next: number) => {
    const clamped = Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, next));
    setZoom(clamped);
    if (zoomStorageKey) window.localStorage.setItem(zoomStorageKey, String(clamped));
  };

  useEffect(() => {
    setUrl(null);
    if (!doc) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 60 * 60);
      if (!cancelled && !error && data) setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const path = `${uid}/stundenplan/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      if (doc) {
        await supabase.storage.from("documents").remove([doc.storage_path]);
        const { error } = await supabase
          .from("documents")
          .update({
            name: file.name,
            storage_path: path,
            mime_type: file.type,
            size_bytes: file.size,
          })
          .eq("id", doc.id)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documents").insert({
          user_id: uid,
          folder_id: null,
          kind: "timetable",
          name: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.timetableDoc });
      toast.success("Stundenplan hochgeladen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!uid || !doc) throw new Error("Nicht angemeldet");
      await supabase.storage.from("documents").remove([doc.storage_path]);
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.timetableDoc });
      toast.success("Stundenplan entfernt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pick = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload.mutate(f);
        }}
      />
      <Button
        size="sm"
        variant={doc ? "secondary" : "default"}
        className="rounded-2xl"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp className="mr-2 size-4" />
        {upload.isPending ? "Lädt …" : doc ? "Ersetzen" : "Stundenplan hochladen"}
      </Button>
    </>
  );

  if (isLoading) return null;

  if (!doc) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Lade deinen Stundenplan als PDF oder Bild hoch – er bleibt hier dauerhaft eingeblendet.
        </p>
        {pick}
      </div>
    );
  }

  const isImage = (doc.mime_type ?? "").startsWith("image/");
  const isPdf =
    doc.mime_type === "application/pdf" || doc.name.toLowerCase().endsWith(".pdf");

  return (
    <div className="glass rounded-3xl p-3 sm:p-4">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{doc.name}</span>
        <div className="col-start-1 row-start-2 sm:contents">{pick}</div>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 rounded-2xl"
          title="Groß anzeigen"
          onClick={() =>
            setFull({
              name: doc.name,
              storage_path: doc.storage_path,
              mime_type: doc.mime_type,
            })
          }
        >
          <Maximize2 className="size-4" />
        </Button>
        {url && (
          <Button asChild size="icon" variant="ghost" className="size-8 rounded-2xl">
            <a href={url} download={doc.name} title="Herunterladen">
              <Download className="size-4" />
            </a>
          </Button>
        )}
        <ConfirmDelete name={doc.name} onConfirm={() => remove.mutate()}>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-2xl text-destructive"
            title="Entfernen"
          >
            <Trash2 className="size-4" />
          </Button>
        </ConfirmDelete>
      </div>

      {isPdf && todayDate && (
        <p role="status" className="mb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Heute: {new Date(`${todayDate}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
          {todayDetection === "found" ? " · Im Stundenplan markiert" : todayDetection === "absent" ? " · Kein Eintrag für heute" : todayDetection === "unreadable" ? " · Keine lesbaren Datumszeilen gefunden" : todayDetection === "error" ? " · PDF konnte nicht gelesen werden" : " · Datum wird gesucht …"}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div
        className={cn("order-2 overflow-hidden rounded-2xl bg-card/40 sm:order-1 sm:col-span-2")}
        style={{ height }}
      >
        {!url ? (
          <p className="p-6 text-sm text-muted-foreground">Wird geladen…</p>
        ) : isImage ? (
          <img src={url} alt={doc.name} className="size-full object-contain" />
        ) : isPdf ? (
          <PdfCanvasViewer url={url} zoom={zoom} onZoomChange={updateZoom} alignLeft todayDate={todayDate} onTodayDetection={setTodayDetection} />
        ) : (
          <iframe src={url} title={doc.name} className="size-full bg-background" />
        )}
      </div>

        {isPdf && (
          <div className="glass-soft order-1 flex w-fit shrink-0 items-center gap-1 rounded-2xl p-1 sm:order-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-xl"
              title="Verkleinern"
              disabled={zoom <= PDF_MIN_ZOOM + 0.001}
              onClick={() => updateZoom(zoom / 1.25)}
            >
              <ZoomOut className="size-4" />
            </Button>
            <span className="w-11 text-center text-[11px] tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-xl"
              title="Vergrößern"
              disabled={zoom >= PDF_MAX_ZOOM - 0.001}
              onClick={() => updateZoom(zoom * 1.25)}
            >
              <ZoomIn className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-xl"
              title="Breite anpassen"
              disabled={Math.abs(zoom - 1) < 0.001}
              onClick={() => updateZoom(1)}
            >
              <Scan className="size-4" />
            </Button>
          </div>
        )}
        <label className={cn("order-3 flex min-w-0 items-center gap-3", !isPdf && "sm:col-span-2")}>
          <span className="text-[11px] text-muted-foreground">Höhe</span>
          <input
            type="range"
            min={240}
            max={900}
            step={20}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="h-1 flex-1 accent-primary"
          />
        </label>
      </div>

      <DocumentPreview doc={full} onClose={() => setFull(null)} />
    </div>
  );
}
