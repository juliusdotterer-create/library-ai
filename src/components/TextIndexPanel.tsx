import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Pause, Play, ScanText, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getIndexStats } from "@/lib/document-text";
import {
  getIndexRunnerState,
  pauseIndexRun,
  resumeIndexRun,
  startIndexRun,
  stopIndexRun,
  subscribeIndexRunner,
  type RunMode,
} from "@/lib/index-runner";

const IDLE_SNAPSHOT = getIndexRunnerState();

const LABEL: Record<RunMode, string> = {
  text: "Volltext-Indexierung",
  failed: "Fehlgeschlagene erneut versuchen",
  ocr: "Texterkennung (OCR)",
};

/** Volltext-Index und Texterkennung für gescannte PDFs. */
export function TextIndexPanel() {
  const run = useSyncExternalStore(subscribeIndexRunner, getIndexRunnerState, () => IDLE_SNAPSHOT);

  const info = useQuery({
    queryKey: ["index-stats", run.running],
    queryFn: () => getIndexStats(),
    refetchInterval: run.running ? 15_000 : false,
  });

  const start = (mode: RunMode) => {
    void startIndexRun(mode).finally(() => void info.refetch());
  };

  const pct = run.total ? Math.min((run.done / run.total) * 100, 100) : 0;
  const eta = (() => {
    if (!run.running || !run.startedAt || run.done < 2 || !run.total) return null;
    const perItem = (Date.now() - run.startedAt) / run.done;
    const left = Math.max(run.total - run.done, 0) * perItem;
    const min = Math.round(left / 60_000);
    return min < 1 ? "unter 1 Min." : min < 60 ? `${min} Min.` : `${Math.round(min / 60)} Std.`;
  })();

  const d = info.data;

  return (
    <div className="space-y-4">

      {d && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Indexiert", d.done],
            ["Nur Scan (OCR nötig)", d.unsupported],
            ["Fehlgeschlagen", d.failed],
            ["Offen", d.pending],
          ].map(([label, value]) => (
            <div key={label as string} className="glass-soft rounded-2xl p-3">
              <p className="text-lg font-semibold">{value as number}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">{label as string}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-2xl bg-primary-soft p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Der Lauf arbeitet in diesem Tab. Du kannst innerhalb der App weiter navigieren, aber der
          Tab muss geöffnet bleiben. Nach einem Neuladen setzt der Lauf dort fort, wo er aufgehört
          hat.
        </span>
      </div>

      {run.running || run.total ? (
        <div className="space-y-1">
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground">
            {run.mode ? `${LABEL[run.mode]}: ` : ""}
            {run.done} von {run.total} verarbeitet
            {eta ? ` · noch ca. ${eta}` : ""}
            {run.paused ? " · pausiert" : ""}
          </p>
          {run.current && (
            <p className="truncate text-[11px] text-muted-foreground">{run.current}</p>
          )}
          {run.message && <p className="text-[11px] text-muted-foreground">{run.message}</p>}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {run.running ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (run.paused ? resumeIndexRun() : pauseIndexRun())}
            >
              {run.paused ? <Play className="mr-2 size-4" /> : <Pause className="mr-2 size-4" />}
              {run.paused ? "Fortsetzen" : "Pause"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => stopIndexRun()}>
              <Square className="mr-2 size-4" /> Stoppen
            </Button>
            <span className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> läuft …
            </span>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => start("text")}>
              Fehlende PDFs indexieren
            </Button>
            <Button size="sm" variant="outline" onClick={() => start("ocr")}>
              <ScanText className="mr-2 size-4" /> Scans per Texterkennung lesen
            </Button>
            <Button size="sm" variant="outline" onClick={() => start("failed")}>
              Nur Fehlgeschlagene erneut versuchen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void info.refetch()}>
              Status aktualisieren
            </Button>
          </>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Texterkennung ist deutlich langsamer (ca. 2–5 Sekunden pro Seite) und liest maximal 50 Seiten
        je Dokument.
      </p>
    </div>
  );
}
