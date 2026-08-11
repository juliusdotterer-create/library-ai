import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type FolderNode = { id: string; name: string; parent_id: string | null };

function folderPath(folderId: string | null, folders: FolderNode[]): string {
  const map = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let id: string | null = folderId;
  while (id) {
    const f = map.get(id);
    if (!f) break;
    parts.unshift(f.name);
    id = f.parent_id;
  }
  return parts.join(" -- ");
}

type FolderQueryClient = {
  from: (table: "folders") => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        is: (
          col: string,
          val: null,
        ) => {
          order: (col: string) => {
            range: (
              from: number,
              to: number,
            ) => PromiseLike<{ data: FolderNode[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
};

async function fetchAllFolders(supabase: FolderQueryClient, userId: string) {
  const page = 1000;
  const all: FolderNode[] = [];
  for (let from = 0; ; from += page) {
    const { data: rows, error } = await supabase
      .from("folders")
      .select("id,name,parent_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("id")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = rows ?? [];
    all.push(...batch);
    if (batch.length < page) break;
  }
  return all;
}


export const searchLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { term: string }) => {
    const term = String(input?.term ?? "").trim();
    if (!term || term.length > 200) throw new Error("Ungültiger Suchbegriff");
    return { term };
  })
  .handler(async ({ data, context }) => {
    const pattern = `%${data.term.replace(/[%_]/g, "\\$&")}%`;

    const { data: docs, error: docsErr } = await context.supabase
      .from("documents")
      .select("id,name,storage_path,mime_type,folder_id")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .not("name", "ilike", "desktop.ini")
      .ilike("name", pattern)
      .order("name")
      .limit(100);
    if (docsErr) throw new Error(docsErr.message);

    const { data: folders, error: foldersErr } = await context.supabase
      .from("folders")
      .select("id,name,parent_id")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .ilike("name", pattern)
      .order("name")
      .limit(50);
    if (foldersErr) throw new Error(foldersErr.message);

    const allFolders = await fetchAllFolders(context.supabase as unknown as { from: (t: never) => any });

    return {
      docs: (docs ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        storage_path: d.storage_path,
        mime_type: d.mime_type,
        folder_id: d.folder_id,
        path: folderPath(d.folder_id, allFolders),
      })),
      folders: (folders ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        path: folderPath(f.id, allFolders),
      })),
    };
  });
