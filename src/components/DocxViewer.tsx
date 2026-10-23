import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";

/** Zeigt Word-Dateien (.docx und alte .doc) direkt als formatierten Text an. */
export function DocxViewer({
  url,
  name,
  legacy = false,
}: {
  url: string;
  name: string;
  legacy?: boolean;
}) {
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
        let isDocxInDisguise = false;
        if (legacy) {
          const { extractLegacyDocHtml } = await import("@/lib/doc-legacy");
          try {
            const result = extractLegacyDocHtml(buffer);
            if (cancelled) return;
            setHtml(DOMPurify.sanitize(result));
            return;
          } catch (err) {
            // Eine „.doc", die in Wahrheit eine .docx ist -> mammoth versuchen
            if ((err as Error)?.message === "DOCX") isDocxInDisguise = true;
            else throw err;
          }
        }
        if (legacy && !isDocxInDisguise) return;
        const mammoth = await import("mammoth");
        const convert = (mammoth as unknown as {
          default?: { convertToHtml: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
          convertToHtml?: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        });
        const fn = convert.convertToHtml ?? convert.default?.convertToHtml;
        if (!fn) throw new Error("mammoth");
        const result = await fn({ arrayBuffer: buffer });
        if (cancelled) return;
        setHtml(DOMPurify.sanitize(result.value) || "<p><em>Dieses Dokument enthält keinen lesbaren Text.</em></p>");
      } catch (err) {
        const message = (err as Error)?.message ?? "";
        if (!cancelled)
          setError(
            message.includes("verschlüsselt")
              ? "Das Dokument ist verschlüsselt und kann nicht angezeigt werden."
              : "Dokument konnte nicht gelesen werden.",
          );
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
