import { FileSearch, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { UploadProgressState } from "@/hooks/useLibraryUpload";

function mb(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function remainingLabel(p: UploadProgressState) {
  const elapsed = (Date.now() - p.started) / 1000;
  const ratio = p.bytesTotal ? p.bytesDone / p.bytesTotal : p.done / Math.max(p.total, 1);
  if (!ratio || elapsed < 0.5) return "Restzeit wird berechnet…";
  const rest = Math.max(0, Math.round(elapsed / ratio - elapsed));
  if (rest < 60) return `noch ca. ${rest}s`;
  return `noch ca. ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")} min`;
}

/** Fortschrittsanzeige für laufende Importe und die Volltext-Indexierung. */
export function UploadProgressPanel({
  progress,
  indexing,
}: {
  progress: UploadProgressState | null;
  indexing: { done: number; total: number } | null;
}) {
  return (
    <>
      {progress && (
        <div className="glass space-y-2 rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Upload className="size-4 shrink-0 animate-pulse text-primary" />
              <span className="truncate font-medium">{progress.name}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {progress.done}/{progress.total} · {remainingLabel(progress)}
            </span>
          </div>
          <Progress
            value={
              progress.bytesTotal
                ? (progress.bytesDone / progress.bytesTotal) * 100
                : (progress.done / Math.max(progress.total, 1)) * 100
            }
          />
          <p className="text-xs text-muted-foreground">
            {mb(progress.bytesDone)} von {mb(progress.bytesTotal)} hochgeladen
          </p>
        </div>
      )}

      {indexing && (
        <div className="glass space-y-2 rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <FileSearch className="size-4 shrink-0 animate-pulse text-primary" />
              <span className="font-medium">Volltext wird erstellt</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {indexing.done}/{indexing.total}
            </span>
          </div>
          <Progress value={(indexing.done / Math.max(indexing.total, 1)) * 100} />
        </div>
      )}
    </>
  );
}
