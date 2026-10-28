import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DrivePicker } from "@/components/DrivePicker";
import { FolderPicker, buildFolderPath } from "@/components/lehrplan/DocumentPicker";
import { useAllFolders } from "@/hooks/useLibrary";
import { mirrorDriveFolder, type MirrorPair } from "@/lib/drive.functions";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type Report = {
  linkedFolders: number;
  addedFolders: number;
  addedDocs: number;
  linkedDocs: number;
  skippedDocs: number;
  failed: number;
  processed: number;
};

/** Spiegelt einen Google-Drive-Ordner in einen bestehenden Library-Ordner. */
export function DriveMirrorPanel() {
  const qc = useQueryClient();
  const { data: folders } = useAllFolders();
  const mirror = useServerFn(mirrorDriveFolder);

  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const cancelled = useRef(false);

  const run = async (driveFolderId: string) => {
    if (!target) return;
    setPickerOpen(false);
    setRunning(true);
    cancelled.current = false;
    const total: Report = {
      linkedFolders: 0,
      addedFolders: 0,
      addedDocs: 0,
      linkedDocs: 0,
      skippedDocs: 0,
      failed: 0,
      processed: 0,
    };
    setReport(total);
    let queue: MirrorPair[] = [{ driveFolderId, localFolderId: target.id }];
    try {
      while (queue.length && !cancelled.current) {
        const res = await mirror({ data: { queue } });
        total.linkedFolders += res.linkedFolders;
        total.addedFolders += res.addedFolders;
        total.addedDocs += res.addedDocs;
        total.linkedDocs += res.linkedDocs;
        total.skippedDocs += res.skippedDocs;
        total.failed += res.failed;
        total.processed += res.processed;
        setReport({ ...total });
        queue = res.queue;
      }
      await qc.invalidateQueries();
      toast.success(
        cancelled.current
          ? "Abgleich abgebrochen – bisherige Ergebnisse sind gespeichert."
          : `Fertig: ${total.addedDocs} neue Dokumente, ${total.linkedDocs} verknüpft, ${total.addedFolders} neue Ordner.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const label = target
    ? buildFolderPath(folders ?? [], target.id) || target.name
    : "Library-Ordner wählen";

  return (
    <div className="space-y-3">

      <div className="flex flex-wrap items-center gap-2">
        <FolderPicker
          folders={folders ?? []}
          onPick={(f) => setTarget({ id: f.id, name: f.name })}
        />
        <span className="max-w-full truncate text-sm text-muted-foreground">{label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="rounded-xl"
          disabled={!target || running}
          onClick={() => setPickerOpen(true)}
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : null}
          Drive-Ordner wählen und spiegeln
        </Button>
        {running ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Abbrechen
          </Button>
        ) : null}
      </div>

      {report ? (
        <p className="text-sm text-muted-foreground">
          {running ? `Ordner ${report.processed} verarbeitet … ` : "Ergebnis: "}
          {report.linkedFolders} Ordner verknüpft · {report.addedFolders} neue Ordner ·{" "}
          {report.addedDocs} neue Dokumente · {report.linkedDocs} Dokumente verknüpft ·{" "}
          {report.skippedDocs} vorhanden
          {report.failed ? ` · ${report.failed} übersprungen` : ""}
        </p>
      ) : null}

      <DrivePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        importing={running}
        folderPickMode
        title="Drive-Ordner zum Spiegeln wählen"
        actionLabel="Spiegeln"
        busyLabel="Gleiche ab …"
        onImport={(items) => {
          const folder = items.find((i) => i.mimeType === FOLDER_MIME) ?? items[0];
          if (!folder) return;
          if (folder.mimeType !== FOLDER_MIME) {
            toast.error(
              'Bitte einen Ordner auswählen: Tippe bei dem Ordner auf „Wählen“ oder öffne ihn und nutze „Diesen Ordner verwenden“.',
            );
            return;
          }
          void run(folder.id);
        }}
      />
    </div>
  );
}
