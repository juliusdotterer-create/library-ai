import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Zeigt Word-Dateien (.docx) direkt als formatierten Text an. */
export function DocxViewer({ url, name }: { url: string; name: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Download fehlgeschlagen");
        const buffer = await res.arrayBuffer();
        const mammoth = await import("mammoth/mammoth.browser");
        const result = await (mammoth as unknown as {
          convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        }).convertToHtml({ arrayBuffer: buffer });
        if (cancelled) return;
        setHtml(result.value || "<p><em>Dieses Dokument enthält keinen lesbaren Text.</em></p>");
      } catch {
        if (!cancelled) setError("Dokument konnte nicht gelesen werden.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="space-y-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild className="rounded-2xl">
          <a href={url} download={name}>
            <Download className="size-4" /> Herunterladen
          </a>
        </Button>
      </div>
    );
  }

  if (html === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Word-Dokument wird gelesen…
      </p>
    );
  }

  return (
    <div className="size-full overflow-auto bg-background p-6 lg:p-10">
      <article
        className="prose prose-sm mx-auto max-w-3xl text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
