import { supabase } from "@/integrations/supabase/client";

type FolderRow = { id: string; parent_id: string | null };

async function allFolders(): Promise<FolderRow[]> {
  const { data, error } = await supabase.from("folders").select("id,parent_id");
  if (error) throw error;
  return data ?? [];
}

/** Ordner-ID plus alle (Unter-)Ordner darunter. */
export function descendantIds(rootId: string, folders: FolderRow[]): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const f of folders) if (f.parent_id === ids[i]) ids.push(f.id);
  }
  return ids;
}

export async function folderTreeIds(rootId: string): Promise<string[]> {
  return descendantIds(rootId, await allFolders());
}

/** Ordner samt Unterordnern und allen enthaltenen Dateien in den Papierkorb. */
export async function softDeleteFolder(rootId: string) {
  const ids = await folderTreeIds(rootId);
  const stamp = new Date().toISOString();
  const d1 = await supabase.from("documents").update({ deleted_at: stamp }).in("folder_id", ids);
  if (d1.error) throw d1.error;
  const f1 = await supabase.from("folders").update({ deleted_at: stamp }).in("id", ids);
  if (f1.error) throw f1.error;
}

/** Ordner samt Inhalt wiederherstellen. */
export async function restoreFolder(rootId: string) {
  const ids = await folderTreeIds(rootId);
  const d1 = await supabase.from("documents").update({ deleted_at: null }).in("folder_id", ids);
  if (d1.error) throw d1.error;
  const f1 = await supabase.from("folders").update({ deleted_at: null }).in("id", ids);
  if (f1.error) throw f1.error;
}

export type PurgeProgress = { done: number; total: number; label: string };
type OnProgress = (p: PurgeProgress) => void;

/** Dateien endgültig löschen: Speicher leeren, Verweise lösen, Zeilen entfernen. */
export async function purgeDocuments(
  docs: { id: string; storage_path?: string | null; name?: string }[],
  onProgress?: OnProgress,
  offset = 0,
  grandTotal?: number,
) {
  if (!docs.length) return;
  const total = grandTotal ?? docs.length;
  const paths = docs.map((d) => d.storage_path).filter((p): p is string => !!p);
  let done = 0;
  for (let i = 0; i < paths.length; i += 50) {
    const chunk = paths.slice(i, i + 50);
    try {
      await supabase.storage.from("documents").remove(chunk);
    } catch {
      // Speicherfehler dürfen das Löschen nicht blockieren
    }
    done += chunk.length;
    onProgress?.({
      done: offset + done,
      total,
      label: `Dateien werden gelöscht (${offset + done}/${total})`,
    });
  }
  const ids = docs.map((d) => d.id);
  for (const table of ["study_tasks", "events"] as const) {
    await supabase.from(table).update({ document_id: null }).in("document_id", ids);
  }
  const del = await supabase.from("documents").delete().in("id", ids);
  if (del.error) throw del.error;
  onProgress?.({ done: offset + docs.length, total, label: "Dateien gelöscht" });
}

/** Ordner samt Inhalt endgültig löschen (inkl. Dateien im Speicher). */
export async function purgeFolder(rootId: string, onProgress?: OnProgress) {
  const ids = await folderTreeIds(rootId);
  const { data: docs, error } = await supabase
    .from("documents")
    .select("id,storage_path")
    .in("folder_id", ids);
  if (error) throw error;
  const list = docs ?? [];
  const total = list.length + ids.length;
  await purgeDocuments(list, onProgress, 0, total);
  // Kinder zuerst löschen, damit Fremdschlüssel nicht blockieren
  let done = list.length;
  for (const id of [...ids].reverse()) {
    const del = await supabase.from("folders").delete().eq("id", id);
    if (del.error) throw del.error;
    done++;
    onProgress?.({ done, total, label: `Ordner werden gelöscht (${done}/${total})` });
  }
}
