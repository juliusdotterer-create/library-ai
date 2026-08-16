import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Maximize2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTimetableDoc, queryKeys } from "@/hooks/useLibrary";
import { Button } from "@/components/ui/button";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { cn } from "@/lib/utils";

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
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{doc.name}</span>
        {pick}
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

      <div
        className={cn("overflow-hidden rounded-2xl bg-card/40")}
        style={{ height }}
      >
        {!url ? (
          <p className="p-6 text-sm text-muted-foreground">Wird geladen…</p>
        ) : isImage ? (
          <img src={url} alt={doc.name} className="size-full object-contain" />
        ) : isPdf ? (
          <PdfCanvasViewer url={url} />
        ) : (
          <iframe src={url} title={doc.name} className="size-full bg-background" />
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
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
      </div>

      <DocumentPreview doc={full} onClose={() => setFull(null)} />
    </div>
  );
}
