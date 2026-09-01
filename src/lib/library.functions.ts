import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";

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
  .middleware([requireWhitelisted])
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

    const allFolders = await fetchAllFolders(
      context.supabase as unknown as FolderQueryClient,
      context.userId,
    );

    /* ---------- Volltextsuche im Dokumentinhalt (exakte Wortfolge) ---------- */
    const { data: hits } = await context.supabase
      .from("document_text")
      .select("document_id,pages,source")
      .eq("user_id", context.userId)
      .eq("status", "done")
      .textSearch("tsv", data.term, { type: "phrase", config: "german" })
      .limit(50);

    const hitRows = (hits ?? []) as { document_id: string; pages: unknown; source?: string | null }[];
    const hitDocIds = hitRows.map((h) => h.document_id);
    const nameHitIds = new Set((docs ?? []).map((d) => d.id));
    const contentIds = hitDocIds.filter((id) => !nameHitIds.has(id));


    let contents: {
      id: string;
      name: string;
      storage_path: string;
      mime_type: string | null;
      folder_id: string | null;
      path: string;
      page: number | null;
      snippet: string;
      ocr: boolean;
    }[] = [];

    if (contentIds.length) {
      const { data: hitDocs } = await context.supabase
        .from("documents")
        .select("id,name,storage_path,mime_type,folder_id")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .in("id", contentIds.slice(0, 50));

      const rowById = new Map(hitRows.map((h) => [h.document_id, h]));
      contents = (hitDocs ?? []).map((d) => {
        const row = rowById.get(d.id);
        const raw = row?.pages;
        const pages: string[] = Array.isArray(raw) ? (raw as unknown[]).map((p) => String(p ?? "")) : [];
        const { page, snippet } = locate(pages, data.term);
        return {
          id: d.id,
          name: d.name,
          storage_path: d.storage_path,
          mime_type: d.mime_type,
          folder_id: d.folder_id,
          path: folderPath(d.folder_id, allFolders),
          page,
          snippet,
          ocr: row?.source === "ocr",
        };
      });
    }

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
      contents,
    };
  });

/** Findet die erste Trefferseite und baut einen kurzen Textausschnitt. */
function locate(pages: string[], term: string): { page: number | null; snippet: string } {
  const tokens = term
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2);
  if (!tokens.length) return { page: pages.length ? 1 : null, snippet: (pages[0] ?? "").slice(0, 160) };

  for (let i = 0; i < pages.length; i++) {
    const text = pages[i] ?? "";
    const lower = text.toLowerCase();
    for (const token of tokens) {
      const at = lower.indexOf(token);
      if (at === -1) continue;
      const start = Math.max(0, at - 70);
      const end = Math.min(text.length, at + token.length + 90);
      const snippet = `${start > 0 ? "… " : ""}${text.slice(start, end).trim()}${
        end < text.length ? " …" : ""
      }`;
      return { page: i + 1, snippet };
    }
  }
  return { page: null, snippet: (pages[0] ?? "").slice(0, 160) };
}
