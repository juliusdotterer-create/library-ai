import { useState } from "react";
import { toast } from "sonner";
import { FileSearch, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { extractPdfText, runQueue } from "@/lib/pdf-text";
import { listUnindexedDocuments, saveDocumentText } from "@/lib/document-text.functions";

/**
 * Nachträgliche Volltext-Indexierung bereits vorhandener PDFs,
 * damit die Library-Suche auch Inhalte findet.
 */
export function TextIndexPanel() {
  const listPending = useServerFn(listUnindexedDocuments);
  const saveText = useServerFn(saveDocumentText);
  const [state, setState] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);

  const check = async () => {
    try {
      const res = await listPending({ data: { limit: 1 } });
      toast.success(
        res.total ? `${res.total} PDFs ohne Volltext gefunden.` : "Alle PDFs sind indexiert.",
      );
      setState(res.total ? { done: 0, total: res.total } : null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const run = async () => {
    setRunning(true);
    let done = 0;
    try {
      for (;;) {
        const { pending, total } = await listPending({ data: { limit: 25 } });
        if (!pending.length) break;
        setState({ done, total: done + total });

        await runQueue(
          pending,
          async (doc) => {
            let status: "done" | "unsupported" | "failed" = "failed";
            let payload = { content: "", pages: [] as string[], pageCount: 0 };
            try {
              const { data: blob } = await supabase.storage
                .from("documents")
                .download(doc.storage_path);
              if (blob) {
                const res = await extractPdfText(blob);
                status = res.status;
                payload = { content: res.content, pages: res.pages, pageCount: res.pageCount };
              }
            } catch {
              /* Einzelne Dateien dürfen den Lauf nicht stoppen. */
            }
            await saveText({ data: { documentId: doc.id, status, ...payload } }).catch(
              () => undefined,
            );
            done += 1;
            setState((p) => (p ? { ...p, done } : p));
          },
          2,
        );
      }
      setState(null);
      toast.success("Volltext-Index aktualisiert");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="glass space-y-3 rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <FileSearch className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Volltextsuche</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Neue PDFs werden beim Upload automatisch indexiert. Ältere Dokumente kannst du hier
        nachträglich durchsuchbar machen.
      </p>
      {state && (
        <div className="space-y-1">
          <Progress value={(state.done / Math.max(state.total, 1)) * 100} />
          <p className="text-xs text-muted-foreground">
            {state.done} von {state.total} Dokumenten verarbeitet
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void check()} disabled={running}>
          Status prüfen
        </Button>
        <Button size="sm" onClick={() => void run()} disabled={running}>
          {running && <Loader2 className="mr-2 size-4 animate-spin" />}
          Fehlende PDFs indexieren
        </Button>
      </div>
    </section>
  );
}
