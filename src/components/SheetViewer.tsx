import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_ROWS = 2000;

type SheetData = { name: string; rows: string[][]; truncated: boolean };

/** Vorschau für Tabellen (.xlsx/.xlsm/.xls/.csv) direkt im Browser. */
export function SheetViewer({ url, name }: { url: string; name: string }) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSheets(null);
    setError(null);
    setActive(0);
    void (async () => {
      try {
        const XLSX = await import("xlsx");
        const buf = await (await fetch(url)).arrayBuffer();
        const wb = XLSX.read(buf, { cellDates: true });
        const parsed: SheetData[] = wb.SheetNames.map((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const raw = XLSX.utils.sheet_to_json<string[]>(ws, {
            header: 1,
            raw: false,
            defval: "",
            blankrows: false,
          });
          const rows = raw.map((r) => r.map((c) => (c == null ? "" : String(c))));
          // leere Randspalten abschneiden
          let last = 0;
          for (const r of rows) {
            for (let i = r.length - 1; i >= 0; i--) {
              if (r[i]?.trim()) {
                last = Math.max(last, i);
                break;
              }
            }
          }
          const trimmed = rows.map((r) => r.slice(0, last + 1));
          return {
            name: sheetName,
            rows: trimmed.slice(0, MAX_ROWS),
            truncated: trimmed.length > MAX_ROWS,
          };
        });
        if (!cancelled) setSheets(parsed);
      } catch {
        if (!cancelled)
          setError("Die Tabelle konnte nicht gelesen werden (evtl. beschädigt oder passwortgeschützt).");
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

  if (!sheets) return <p className="p-8 text-sm text-muted-foreground">Tabelle wird geladen…</p>;

  const sheet = sheets[active];
  if (!sheet || sheet.rows.length === 0)
    return <p className="p-8 text-sm text-muted-foreground">Die Tabelle ist leer.</p>;

  const [head, ...body] = sheet.rows;

  return (
    <div className="flex size-full min-h-0 flex-col">
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/40 px-2 py-1.5">
          {sheets.map((s, i) => (
            <button
              key={s.name + i}
              onClick={() => setActive(i)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-1 text-xs transition",
                i === active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
            <tr>
              {head.map((c, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap border border-border/40 px-2 py-1.5 text-left font-semibold"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="odd:bg-muted/20">
                {head.map((_, c) => (
                  <td key={c} className="whitespace-pre-wrap border border-border/30 px-2 py-1 align-top">
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.truncated && (
          <p className="p-3 text-center text-xs text-muted-foreground">
            Nur die ersten {MAX_ROWS} Zeilen werden angezeigt – für alle Daten die Datei herunterladen.
          </p>
        )}
      </div>
    </div>
  );
}
