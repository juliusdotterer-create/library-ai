import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Zeigt OpenDocument-Text (.odt) als einfache formatierte HTML-Ansicht. */
export function OdtViewer({ url, name }: { url: string; name: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    void (async () => {
      try {
        const JSZip = (await import("jszip")).default;
        const buf = await (await fetch(url)).arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        const content = zip.files["content.xml"];
        if (!content) throw new Error("kein content.xml");
        const xml = await content.async("text");
        const doc = new DOMParser().parseFromString(xml, "application/xml");

        const renderNode = (node: Element): string => {
          const tag = node.localName;
          const inner = Array.from(node.childNodes)
            .map((c) =>
              c.nodeType === Node.TEXT_NODE
                ? escapeHtml(c.textContent ?? "")
                : renderNode(c as Element),
            )
            .join("");
          switch (tag) {
            case "h":
              return `<h2>${inner}</h2>`;
            case "p":
              return `<p>${inner || "&nbsp;"}</p>`;
            case "span":
              return `<span>${inner}</span>`;
            case "list":
              return `<ul>${inner}</ul>`;
            case "list-item":
              return `<li>${inner}</li>`;
            case "table":
              return `<table>${inner}</table>`;
            case "table-row":
              return `<tr>${inner}</tr>`;
            case "table-cell":
              return `<td>${inner}</td>`;
            case "line-break":
              return "<br/>";
            case "tab":
              return "&emsp;";
            case "s":
              return " ";
            default:
              return inner;
          }
        };

        const officeText = doc.getElementsByTagName("office:text")[0];
        if (!officeText) throw new Error("kein Text");
        const out = Array.from(officeText.childNodes)
          .map((c) => (c.nodeType === Node.ELEMENT_NODE ? renderNode(c as Element) : ""))
          .join("")
          .trim();
        if (!cancelled)
          setHtml(out || "<p><em>Dieses Dokument enthält keinen lesbaren Text.</em></p>");
      } catch {
        if (!cancelled) setError("Die ODT-Datei konnte nicht gelesen werden.");
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
        <Loader2 className="size-4 animate-spin" /> ODT-Dokument wird gelesen…
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
