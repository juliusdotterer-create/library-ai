/**
 * Läuft der Volltext-Index, bleibt dieser Runner als Modul-Singleton am Leben —
 * ein Seitenwechsel innerhalb der App stoppt ihn also nicht. Nur das Schließen
 * oder Neuladen des Tabs beendet ihn; danach kann er dort fortsetzen,
 * wo er aufgehört hat.
 */
import { supabase } from "@/integrations/supabase/client";
import { extractPdfText, runQueue } from "@/lib/pdf-text";
import { ocrPdf, releaseOcrWorker } from "@/lib/ocr";
import {
  listOcrCandidates,
  listUnindexedDocuments,
  saveDocumentText,
} from "@/lib/document-text.functions";
import { getDriveFileContent } from "@/lib/drive.functions";
import { base64ToBlob } from "@/lib/drive-client";

export type RunMode = "text" | "failed" | "ocr";

export type RunnerState = {
  mode: RunMode | null;
  running: boolean;
  paused: boolean;
  done: number;
  total: number;
  current: string | null;
  startedAt: number | null;
  message: string | null;
};

const IDLE: RunnerState = {
  mode: null,
  running: false,
  paused: false,
  done: 0,
  total: 0,
  current: null,
  startedAt: null,
  message: null,
};

const OCR_MAX_PAGES = 50;

let state: RunnerState = IDLE;
const listeners = new Set<() => void>();
let stopFlag = false;
let pauseFlag = false;
let wakeLock: { release: () => Promise<void> } | null = null;

function set(patch: Partial<RunnerState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function subscribeIndexRunner(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getIndexRunnerState() {
  return state;
}

const beforeUnload = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = "";
};

async function acquireWakeLock() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch {
    /* ignorieren */
  }
  wakeLock = null;
}

async function waitWhilePaused() {
  while (pauseFlag && !stopFlag) await new Promise((r) => setTimeout(r, 300));
}

async function download(path: string) {
  const { data } = await supabase.storage.from("documents").download(path);
  return data ?? null;
}

/** Drive-Dateien (ohne lokalen Speicherpfad) über den Server laden. */
async function downloadDriveDoc(documentId: string) {
  const res = await getDriveFileContent({ data: { documentId } });
  return base64ToBlob(res.base64, res.mimeType);
}

/** Verarbeitet ein Dokument und schreibt das Ergebnis (auch Fehler) in den Index. */
async function processDoc(
  doc: { id: string; name: string; storage_path: string; source?: string },
  mode: RunMode,
) {
  set({ current: doc.name });
  let status: "done" | "unsupported" | "failed" = "failed";
  let error: string | null = null;
  let payload = { content: "", pages: [] as string[], pageCount: 0 };

  try {
    const blob =
      doc.source === "gdrive" ? await downloadDriveDoc(doc.id) : await download(doc.storage_path);
    if (!blob) throw new Error("Datei konnte nicht geladen werden");
    const res =
      mode === "ocr"
        ? await ocrPdf(blob, { maxPages: OCR_MAX_PAGES, signal: { get aborted() { return stopFlag; } } })
        : await extractPdfText(blob);
    status = res.status;
    payload = { content: res.content, pages: res.pages, pageCount: res.pageCount };
  } catch (e) {
    error = (e as Error).message?.slice(0, 300) ?? "Unbekannter Fehler";
  }

  await saveDocumentText({
    data: {
      documentId: doc.id,
      status,
      error,
      source: mode === "ocr" ? "ocr" : "text",
      ...payload,
    },
  }).catch(() => undefined);

  set({ done: state.done + 1 });
}

export function pauseIndexRun() {
  pauseFlag = true;
  set({ paused: true });
}

export function resumeIndexRun() {
  pauseFlag = false;
  set({ paused: false });
}

export function stopIndexRun() {
  stopFlag = true;
  pauseFlag = false;
  set({ paused: false, message: "Wird beendet …" });
}

export async function startIndexRun(mode: RunMode) {
  if (state.running) return;
  stopFlag = false;
  pauseFlag = false;
  set({ ...IDLE, mode, running: true, startedAt: Date.now() });
  window.addEventListener("beforeunload", beforeUnload);
  void acquireWakeLock();

  try {
    for (;;) {
      await waitWhilePaused();
      if (stopFlag) break;

      const batch =
        mode === "ocr"
          ? await listOcrCandidates({ data: { limit: 10 } })
          : await listUnindexedDocuments({ data: { limit: 25, onlyFailed: mode === "failed" } });

      if (!batch.pending.length) break;
      set({ total: state.done + batch.total });

      if (mode === "ocr") {
        for (const doc of batch.pending) {
          await waitWhilePaused();
          if (stopFlag) break;
          await processDoc(doc, mode);
        }
      } else {
        await runQueue(
          batch.pending,
          async (doc) => {
            await waitWhilePaused();
            if (stopFlag) return;
            await processDoc(doc, mode);
          },
          2,
        );
      }
      if (stopFlag) break;
    }
    set({ message: stopFlag ? "Lauf angehalten." : "Fertig." });
  } catch (e) {
    set({ message: (e as Error).message });
  } finally {
    if (mode === "ocr") void releaseOcrWorker();
    window.removeEventListener("beforeunload", beforeUnload);
    void releaseWakeLock();
    set({ running: false, paused: false, current: null });
  }
}
