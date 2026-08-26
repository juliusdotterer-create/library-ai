import { useEffect, useState } from "react";
import { Download, Loader2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Slide = { index: number; texts: string[] };

/** Text-Vorschau für .pptx: Folieninhalte als Karten (kein Original-Layout). */
export function PptxViewer({ url, name }: { url: string; name: string }) {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSlides(null);
    setError(null);
    setActive(0);
    void (async () => {
      try {
        const JSZip = (await import("jszip")).default;
        const buf = await (await fetch(url)).arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        const slideFiles = Object.keys(zip.files)
          .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
          .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
        if (slideFiles.length === 0) throw new Error("keine Folien");
        const parser = new DOMParser();
        const parsed: Slide[] = [];
        for (let i = 0; i < slideFiles.length; i++) {
          const xml = await zip.files[slideFiles[i]!]!.async("text");
          const doc = parser.parseFromString(xml, "application/xml");
          const texts = Array.from(doc.getElementsByTagName("a:t"))
            .map((n) => n.textContent?.trim() ?? "")
            .filter(Boolean);
          parsed.push({ index: i + 1, texts });
        }
        if (!cancelled) setSlides(parsed);
      } catch {
        if (!cancelled)
          setError("Die Präsentation konnte nicht gelesen werden (evtl. beschädigt oder altes .ppt-Format).");
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

  if (!slides)
    return (
      <p className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Präsentation wird gelesen…
      </p>
    );

  const slide = slides[active];

  return (
    <div className="flex size-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-2 py-1.5">
        {slides.map((s, i) => (
          <button
            key={s.index}
            onClick={() => setActive(i)}
            className={cn(
              "shrink-0 rounded-xl px-2.5 py-1 text-xs transition",
              i === active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            {s.index}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6 lg:p-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Presentation className="size-3.5" />
            Folie {slide?.index} von {slides.length} – Textvorschau, Layout siehe Download
          </div>
          {slide && slide.texts.length > 0 ? (
            slide.texts.map((t, i) => (
              <p
                key={i}
                className={cn(
                  "rounded-2xl border border-border bg-muted/30 px-4 py-3",
                  i === 0 ? "text-lg font-semibold" : "text-sm",
                )}
              >
                {t}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Diese Folie enthält keinen Text.</p>
          )}
        </div>
      </div>
    </div>
  );
}
