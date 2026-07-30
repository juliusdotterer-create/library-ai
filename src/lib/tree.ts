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

/** Ordner samt Inhalt endgültig löschen (inkl. Dateien im Speicher). */
export async function purgeFolder(rootId: string) {
  const ids = await folderTreeIds(rootId);
  const { data: docs, error } = await supabase
    .from("documents")
    .select("id,storage_path")
    .in("folder_id", ids);
  if (error) throw error;
  const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("documents").remove(paths);
  if (docs?.length) {
    const del = await supabase
      .from("documents")
      .delete()
      .in(
        "id",
        docs.map((d) => d.id),
      );
    if (del.error) throw del.error;
  }
  // Kinder zuerst löschen, damit Fremdschlüssel nicht blockieren
  for (const id of [...ids].reverse()) {
    const del = await supabase.from("folders").delete().eq("id", id);
    if (del.error) throw del.error;
  }
}
