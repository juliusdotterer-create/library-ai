import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { saveDocumentText } from "@/lib/document-text.functions";
import { extractPdfText, isPdfFile, runQueue } from "@/lib/pdf-text";

export type UploadEntry = { file: File; segments: string[] };

export type UploadProgressState = {
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  started: number;
  name: string;
};

/** Systemdateien, die Windows/macOS beim Ordner-Upload mitschickt – nie importieren. */
const JUNK = /^(desktop\.ini|thumbs\.db|\.ds_store|\.localized|icon\r?)$/i;
const isJunk = (name: string) => JUNK.test(name) || name.startsWith("._");

/** Wandelt eine FileList (inkl. Ordner-Auswahl) in Upload-Einträge mit Pfadsegmenten um. */
export function entriesFromFileList(files: FileList): UploadEntry[] {
  return Array.from(files).map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    return { file, segments: rel.split("/").slice(0, -1) };
  });
}

async function readEntry(
  entry: FileSystemEntry,
  segments: string[],
  out: UploadEntry[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) =>
      (entry as FileSystemFileEntry).file(res, rej),
    );
    out.push({ file, segments });
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    children.push(...batch);
  }
  for (const child of children) await readEntry(child, [...segments, entry.name], out);
}

/**
 * Kapselt Datei-/Ordner-Import inkl. Drag & Drop, Fortschritt, Retry und
 * Volltext-Indexierung. Die Library-Route bleibt dadurch reine Darstellung.
 */
export function useLibraryUpload({
  uid,
  folderId,
  onDone,
}: {
  uid: string | undefined;
  folderId: string | null;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState<UploadProgressState | null>(null);
  const [indexing, setIndexing] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const saveText = useServerFn(saveDocumentText);
  const folderRef = useRef(folderId);
  folderRef.current = folderId;

  const uploadFile = async (file: File, target: string | null) => {
    if (!uid) throw new Error("Nicht angemeldet");
    const storagePath = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, { contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { data, error } = await supabase
      .from("documents")
      .insert({
        user_id: uid,
        folder_id: target,
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  /** Extrahiert PDF-Text im Hintergrund, damit die Volltextsuche greift. */
  const indexPdfs = async (items: { id: string; file: File }[]) => {
    if (!items.length) return;
    setIndexing({ done: 0, total: items.length });
    await runQueue(
      items,
      async (item) => {
        try {
          const res = await extractPdfText(item.file);
          await saveText({
            data: {
              documentId: item.id,
              content: res.content,
              pages: res.pages,
              pageCount: res.pageCount,
              status: res.status,
            },
          });
        } catch {
          await saveText({
            data: { documentId: item.id, content: "", pages: [], pageCount: 0, status: "failed" },
          }).catch(() => undefined);
        }
        setIndexing((p) => (p ? { ...p, done: p.done + 1 } : p));
      },
      2,
    );
    setIndexing(null);
  };

  const runUpload = async (all: UploadEntry[]) => {
    const entries = all.filter((e) => !isJunk(e.file.name));
    if (!entries.length) {
      toast.info("Nur Systemdateien (z. B. desktop.ini) – nichts importiert");
      return;
    }
    if (!uid) {
      toast.error("Nicht angemeldet");
      return;
    }
    const cache = new Map<string, string | null>([["", folderRef.current]]);

    const ensureFolder = async (segments: string[]): Promise<string | null> => {
      const key = segments.join("/");
      if (cache.has(key)) return cache.get(key)!;
      const parent = await ensureFolder(segments.slice(0, -1));
      const name = segments[segments.length - 1];
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: uid, parent_id: parent, name })
        .select("id")
        .single();
      if (error) throw error;
      cache.set(key, data.id);
      return data.id;
    };

    const bytesTotal = entries.reduce((s, e) => s + e.file.size, 0);
    const started = Date.now();
    let bytesDone = 0;
    setProgress({
      done: 0,
      total: entries.length,
      bytesDone: 0,
      bytesTotal,
      started,
      name: entries[0]?.file.name ?? "",
    });

    const failed: { name: string; reason: string }[] = [];
    const toIndex: { id: string; file: File }[] = [];

    for (let i = 0; i < entries.length; i++) {
      const { file, segments } = entries[i];
      setProgress((p) => (p ? { ...p, name: file.name } : p));
      // Einzelne Fehler dürfen den restlichen Import nicht abbrechen.
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const target = await ensureFolder(segments);
          const docId = await uploadFile(file, target);
          if (isPdfFile(file.name, file.type)) toIndex.push({ id: docId, file });
          break;
        } catch (err) {
          if (attempt === 3) failed.push({ name: file.name, reason: (err as Error).message });
          else await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
      bytesDone += file.size;
      const doneCount = i + 1;
      setProgress((p) => (p ? { ...p, done: doneCount, bytesDone } : p));
    }
    setProgress(null);
    // Volltext-Indexierung läuft im Hintergrund weiter.
    void indexPdfs(toIndex);
    return { total: entries.length, failed };
  };

  const upload = useMutation({
    mutationFn: runUpload,
    onSuccess: (res) => {
      onDone();
      if (!res) return;
      if (res.failed.length) {
        toast.error(
          `${res.failed.length} von ${res.total} Dateien fehlgeschlagen: ${res.failed
            .slice(0, 3)
            .map((f) => `${f.name} (${f.reason})`)
            .join(", ")}`,
        );
        return;
      }
      toast.success("Import abgeschlossen");
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error(e.message);
    },
  });

  /** Handler-Bündel für die Drop-Zone der Library. */
  const dropZone = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      void (async () => {
        const items = Array.from(e.dataTransfer.items ?? []);
        const out: UploadEntry[] = [];
        const entries = items
          .map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null))
          .filter(Boolean) as FileSystemEntry[];
        if (entries.length) {
          for (const entry of entries) await readEntry(entry, [], out);
        } else if (e.dataTransfer.files?.length) {
          out.push(...entriesFromFileList(e.dataTransfer.files));
        }
        if (out.length) upload.mutate(out);
      })();
    },
  };

  const uploadFileList = (files: FileList) => upload.mutate(entriesFromFileList(files));

  return { progress, indexing, dragging, dropZone, upload, uploadFileList };
}
