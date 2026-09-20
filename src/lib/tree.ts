import { supabase } from "@/integrations/supabase/client";

type FolderRow = { id: string; parent_id: string | null };

/** PostgREST-Filter werden in die URL geschrieben – zu viele IDs ergeben "Bad Request". */
const ID_CHUNK = 60;

function chunk<T>(list: T[], size = ID_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function allFolders(userId: string, includeDeleted = false): Promise<FolderRow[]> {
  let q = supabase.from("folders").select("id,parent_id").eq("user_id", userId);
  if (!includeDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q;
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

export async function folderTreeIds(rootId: string, userId: string): Promise<string[]> {
  return descendantIds(rootId, await allFolders(userId));
}

async function stampTree(userId: string, ids: string[], stamp: string | null) {
  for (const part of chunk(ids)) {
    const d1 = await supabase
      .from("documents")
      .update({ deleted_at: stamp })
      .eq("user_id", userId)
      .in("folder_id", part);
    if (d1.error) throw d1.error;
    const f1 = await supabase
      .from("folders")
      .update({ deleted_at: stamp })
      .eq("user_id", userId)
      .in("id", part);
    if (f1.error) throw f1.error;
  }
}

/** Ordner samt Unterordnern und allen enthaltenen Dateien in den Papierkorb. */
export async function softDeleteFolder(rootId: string, userId: string) {
  await stampTree(userId, await folderTreeIds(rootId, userId), new Date().toISOString());
}

/** Ordner samt Inhalt wiederherstellen. */
export async function restoreFolder(rootId: string, userId: string) {
  await stampTree(userId, await folderTreeIds(rootId, userId), null);
}

export type PurgeProgress = { done: number; total: number; label: string };
type OnProgress = (p: PurgeProgress) => void;

/** Dateien endgültig löschen: Speicher leeren, Verweise lösen, Zeilen entfernen. */
export async function purgeDocuments(
  userId: string,
  docs: { id: string; storage_path?: string | null; name?: string }[],
  onProgress?: OnProgress,
  offset = 0,
  grandTotal?: number,
) {
  if (!docs.length) return;
  const total = grandTotal ?? docs.length;
  const paths = docs.map((d) => d.storage_path).filter((p): p is string => !!p);
  let done = 0;
  for (const part of chunk(paths, 50)) {
    try {
      await supabase.storage.from("documents").remove(part);
    } catch {
      // Speicherfehler dürfen das Löschen nicht blockieren
    }
    done += part.length;
    onProgress?.({
      done: offset + done,
      total,
      label: `Dateien werden gelöscht (${offset + done}/${total})`,
    });
  }

  const ids = docs.map((d) => d.id);
  for (const part of chunk(ids)) {
    for (const table of ["study_tasks", "events"] as const) {
      const ref = await supabase
        .from(table)
        .update({ document_id: null })
        .eq("user_id", userId)
        .in("document_id", part);
      if (ref.error) throw ref.error;
    }
    const del = await supabase.from("documents").delete().eq("user_id", userId).in("id", part);
    if (del.error) throw del.error;
  }
  onProgress?.({ done: offset + docs.length, total, label: "Dateien gelöscht" });
}

/** Ordner samt Inhalt endgültig löschen (inkl. Dateien im Speicher). */
export async function purgeFolder(rootId: string, userId: string, onProgress?: OnProgress) {
  const ids = await folderTreeIds(rootId, userId);

  const list: { id: string; storage_path: string | null }[] = [];
  for (const part of chunk(ids)) {
    const { data, error } = await supabase
      .from("documents")
      .select("id,storage_path")
      .eq("user_id", userId)
      .in("folder_id", part);
    if (error) throw error;
    list.push(...(data ?? []));
  }

  const total = list.length + ids.length;
  await purgeDocuments(userId, list, onProgress, 0, total);
  // Kinder zuerst löschen, damit Fremdschlüssel nicht blockieren
  let done = list.length;
  for (const id of [...ids].reverse()) {
    const del = await supabase.from("folders").delete().eq("user_id", userId).eq("id", id);
    if (del.error) throw del.error;
    done++;
    onProgress?.({ done, total, label: `Ordner werden gelöscht (${done}/${total})` });
  }
}
