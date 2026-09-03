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
      .select("id,name,storage_path,mime_type,folder_id,kind,notebook_id")
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
      contents = (hitDocs ?? [])
        .map((d) => {
          const row = rowById.get(d.id);
          const raw = row?.pages;
          const pages: string[] = Array.isArray(raw)
            ? (raw as unknown[]).map((p) => String(p ?? ""))
            : [];
          const found = locate(pages, data.term);
          if (!found) return null;
          return {
            id: d.id,
            name: d.name,
            storage_path: d.storage_path,
            mime_type: d.mime_type,
            folder_id: d.folder_id,
            path: folderPath(d.folder_id, allFolders),
            page: found.page,
            snippet: found.snippet,
            ocr: row?.source === "ocr",
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
    }

    return {
      docs: (docs ?? [])
        .map((d) => ({
          id: d.id,
          name: d.name,
          storage_path: d.storage_path,
          mime_type: d.mime_type,
          folder_id: d.folder_id,
          kind: d.kind,
          notebook_id: d.notebook_id,
          path: folderPath(d.folder_id, allFolders),
        }))
        .sort((a, b) => rank(a.name, data.term) - rank(b.name, data.term) || a.name.localeCompare(b.name)),
      folders: (folders ?? [])
        .map((f) => ({
          id: f.id,
          name: f.name,
          parent_id: f.parent_id,
          path: folderPath(f.id, allFolders),
        }))
        .sort((a, b) => rank(a.name, data.term) - rank(b.name, data.term) || a.name.localeCompare(b.name)),
      contents,
    };
  });

/** Vereinheitlicht Text: Kleinschreibung, Umlaute, Mehrfach-Leerzeichen. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** 0 = exakt, 1 = Anfang, 2 = enthalten, 3 = sonstiges. */
function rank(name: string, term: string): number {
  const n = norm(name);
  const t = norm(term);
  if (n === t) return 0;
  if (n.startsWith(t)) return 1;
  if (n.includes(t)) return 2;
  return 3;
}

/**
 * Sucht die exakte Wortfolge (unabhängig von Groß-/Kleinschreibung, Umlauten
 * und Zeilenumbrüchen). Ohne exakten Treffer: null.
 */
function locate(pages: string[], term: string): { page: number; snippet: string } | null {
  const needle = norm(term);
  if (!needle) return null;

  for (let i = 0; i < pages.length; i++) {
    const text = pages[i] ?? "";
    // Zeichen-Index-Zuordnung zwischen normalisiertem und Originaltext
    const map: number[] = [];
    let flat = "";
    for (let k = 0; k < text.length; k++) {
      const piece = norm(text[k]!);
      if (!piece) {
        if (flat.length && !flat.endsWith(" ")) {
          flat += " ";
          map.push(k);
        }
        continue;
      }
      for (const ch of piece) {
        flat += ch;
        map.push(k);
      }
    }
    const at = flat.indexOf(needle);
    if (at === -1) continue;
    const origStart = map[at] ?? 0;
    const origEnd = map[Math.min(at + needle.length, map.length - 1)] ?? text.length;
    const start = Math.max(0, origStart - 70);
    const end = Math.min(text.length, origEnd + 90);
    const snippet = `${start > 0 ? "… " : ""}${text.slice(start, end).trim()}${
      end < text.length ? " …" : ""
    }`;
    return { page: i + 1, snippet };
  }
  return null;
}

