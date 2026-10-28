import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";
import { inRange, matchesMime, type SearchFilters } from "@/lib/smart-search";
import { bestPage, relevanceScore, searchTokens } from "@/lib/search-relevance";

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
  .inputValidator((input: { term: string; filters?: SearchFilters }) => {
    const term = String(input?.term ?? "").trim();
    const f = input?.filters ?? {};
    const filters: SearchFilters = {
      folderName: f.folderName ? String(f.folderName).slice(0, 100) : undefined,
      mime: f.mime === "pdf" || f.mime === "word" || f.mime === "image" ? f.mime : undefined,
      from: f.from && !isNaN(Date.parse(f.from)) ? f.from : undefined,
      to: f.to && !isNaN(Date.parse(f.to)) ? f.to : undefined,
    };
    const any = !!(filters.folderName || filters.mime || filters.from || filters.to);
    if ((!term && !any) || term.length > 200) throw new Error("Ungültiger Suchbegriff");
    return { term, filters };
  })
  .handler(async ({ data, context }) => {
    const pattern = `%${data.term.replace(/[%_]/g, "\\$&")}%`;

    const F = data.filters;
    const anyFilter = !!(F.folderName || F.mime || F.from || F.to);
    let docsQ = context.supabase
      .from("documents")
      .select("id,name,storage_path,mime_type,folder_id,kind,notebook_id,source,created_at")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .not("name", "ilike", "desktop.ini");
    const nameTokens = searchTokens(data.term);
    if (nameTokens.length) docsQ = docsQ.or(nameTokens.map((t) => `name.ilike.%${t.replace(/§/g, "").replace(/[%_,()]/g, "")}%`).join(","));
    if (F.from) docsQ = docsQ.gte("created_at", F.from);
    if (F.to) docsQ = docsQ.lt("created_at", F.to);
    const { data: docsRaw, error: docsErr } = await docsQ.order("name").limit(anyFilter ? 500 : 100);
    if (docsErr) throw new Error(docsErr.message);

    const { data: folders, error: foldersErr } = await context.supabase
      .from("folders")
      .select("id,name,parent_id")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .ilike("name", data.term ? pattern : "%")
      .order("name")
      .limit(anyFilter ? 0 : 50);
    if (foldersErr) throw new Error(foldersErr.message);

    const allFolders = await fetchAllFolders(
      context.supabase as unknown as FolderQueryClient,
      context.userId,
    );

    /* ---------- Filter in Worten: Ordner (inkl. Unterordner), Typ, Zeitraum ---------- */
    let folderScope: Set<string> | null = null;
    let folderMatched: string | null = null;
    if (F.folderName) {
      const wanted = norm(F.folderName);
      const roots = allFolders
        .filter((f) => norm(f.name).includes(wanted))
        .sort((a, b) => norm(a.name).length - norm(b.name).length);
      folderScope = new Set();
      if (roots.length) {
        folderMatched = roots[0]!.name;
        const children = new Map<string, string[]>();
        for (const f of allFolders) {
          if (!f.parent_id) continue;
          children.set(f.parent_id, [...(children.get(f.parent_id) ?? []), f.id]);
        }
        const stack = roots.map((r) => r.id);
        while (stack.length) {
          const id = stack.pop()!;
          if (folderScope.has(id)) continue;
          folderScope.add(id);
          stack.push(...(children.get(id) ?? []));
        }
      }
    }
    const passes = (d: { name: string; mime_type: string | null; folder_id: string | null; created_at?: string | null }) =>
      (!folderScope || (!!d.folder_id && folderScope.has(d.folder_id))) &&
      matchesMime(d.mime_type, d.name, F.mime) &&
      inRange(d.created_at, F);
    const docs = (docsRaw ?? [])
      .filter(passes)
      .filter((d) => !data.term || relevanceScore(d.name, data.term) > 0)
      .slice(0, 100);

    /* ---------- Volltextsuche im Dokumentinhalt (Wortanfänge + Teilwörter) ---------- */
    const tokens = data.term ? norm(data.term).split(" ").filter(Boolean) : [];
    const tsquery = tokens.length
      ? tokens.map((t) => (/\d/.test(t) ? t : `${t}:*`)).join(" | ")
      : null;

    let hitRows: { document_id: string; pages: unknown; source?: string | null }[] = [];

    if (tsquery) {
      const { data: hits } = await context.supabase
        .from("document_text")
        .select("document_id,pages,source")
        .eq("user_id", context.userId)
        .eq("status", "done")
        .textSearch("tsv", tsquery, { config: "german" })
        .limit(150);
      hitRows = (hits ?? []) as typeof hitRows;
    }

    // Exakte Phrase / Paragraphen zusätzlich laden; Teilwörter bleiben als Fallback.
    if (data.term) {
      const { data: likeHits } = await context.supabase
        .from("document_text")
        .select("document_id,pages,source")
        .eq("user_id", context.userId)
        .eq("status", "done")
        .ilike("content", pattern)
        .limit(50);
      const known = new Set(hitRows.map((h) => h.document_id));
      hitRows.push(...((likeHits ?? []) as typeof hitRows).filter((h) => !known.has(h.document_id)));
    }
    const scoreOf = (h: (typeof hitRows)[number]) => {
      const pages = Array.isArray(h.pages) ? (h.pages as unknown[]).map((p) => String(p ?? "")) : [];
      return bestPage(pages, data.term)?.score ?? 0;
    };
    hitRows = hitRows
      .map((h) => ({ h, score: scoreOf(h) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((x) => x.h);
    const hitDocIds = hitRows.map((h) => h.document_id);
    const nameHitIds = new Set((docs ?? []).map((d) => d.id));
    const contentIds = hitDocIds.filter((id) => !nameHitIds.has(id));


    let contents: {
      id: string;
      name: string;
      storage_path: string;
      mime_type: string | null;
      folder_id: string | null;
      source: string | null;
      path: string;
      page: number | null;
      snippet: string;
      ocr: boolean;
    }[] = [];

    if (contentIds.length) {
      const { data: hitDocs } = await context.supabase
        .from("documents")
        .select("id,name,storage_path,mime_type,folder_id,source,created_at")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .in("id", contentIds.slice(0, 50));

      const rowById = new Map(hitRows.map((h) => [h.document_id, h]));
      contents = (hitDocs ?? [])
        .filter(passes)
        .map((d) => {
          const row = rowById.get(d.id);
          const raw = row?.pages;
          const pages: string[] = Array.isArray(raw)
            ? (raw as unknown[]).map((p) => String(p ?? ""))
            : [];
          const best = bestPage(pages, data.term);
          const found = (best ? snippetAt(pages, best.page, data.term) : null) ?? {
            page: pages.length ? 1 : null,
            snippet: pages[0] ? `${pages[0].slice(0, 160).trim()} …` : "",
          };
          return {
            id: d.id,
            name: d.name,
            storage_path: d.storage_path,
            mime_type: d.mime_type,
            folder_id: d.folder_id,
            source: d.source,
            path: folderPath(d.folder_id, allFolders),
            page: found.page,
            snippet: found.snippet,
            ocr: row?.source === "ocr",
            score: best?.score ?? 0,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => b.score - a.score)
        .map(({ score: _score, ...c }) => c);
    }

    /* ---------- Tippfehler verzeihen: ähnliche Namen ---------- */
    type Similar = { kind: "doc" | "folder"; id: string; name: string; path: string; storage_path?: string; mime_type?: string | null; folder_id?: string | null; source?: string | null; doc_kind?: string | null; notebook_id?: string | null };
    let similar: Similar[] = [];
    if (data.term.length >= 4 && !/\d/.test(data.term) && docs.length + (folders?.length ?? 0) + contents.length < 5) {
      const { data: fuzzy, error: fuzzyErr } = await context.supabase.rpc("search_library_fuzzy", { term: data.term, max_results: 15 });
      if (fuzzyErr) console.error("search_library_fuzzy", fuzzyErr.message);
      const seen = new Set([...docs.map((d) => d.id), ...(folders ?? []).map((f) => f.id), ...contents.map((c) => c.id)]);
      const rows = (fuzzy ?? []).filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
      const docIds = rows.filter((r) => r.kind !== "folder").map((r) => r.id);
      const docInfo = new Map<string, { id: string; name: string; storage_path: string; mime_type: string | null; folder_id: string | null; source: string | null; kind: string | null; notebook_id: string | null; created_at: string }>();
      if (docIds.length) {
        const { data: info } = await context.supabase
          .from("documents")
          .select("id,name,storage_path,mime_type,folder_id,source,kind,notebook_id,created_at")
          .is("deleted_at", null)
          .in("id", docIds);
        for (const d of info ?? []) docInfo.set(d.id, d);
      }
      similar = rows
        .map((r): Similar | null => {
          if (r.kind === "folder") {
            if (anyFilter) return null;
            return { kind: "folder", id: r.id, name: r.name, path: folderPath(r.id, allFolders) };
          }
          const d = docInfo.get(r.id);
          if (!d || !passes(d)) return null;
          return { kind: "doc", id: d.id, name: d.name, path: folderPath(d.folder_id, allFolders), storage_path: d.storage_path, mime_type: d.mime_type, folder_id: d.folder_id, source: d.source, doc_kind: d.kind, notebook_id: d.notebook_id };
        })
        .filter((x): x is Similar => !!x)
        .slice(0, 10);
    }

    return {
      folderMatched,
      folderMissing: !!F.folderName && !folderMatched,
      similar,
      docs: docs
        .map((d) => ({
          id: d.id,
          name: d.name,
          storage_path: d.storage_path,
          mime_type: d.mime_type,
          folder_id: d.folder_id,
          source: d.source,
          kind: d.kind,
          notebook_id: d.notebook_id,
          path: folderPath(d.folder_id, allFolders),
        }))
        .sort((a, b) => relevanceScore(b.name, data.term) - relevanceScore(a.name, data.term) || rank(a.name, data.term) - rank(b.name, data.term) || a.name.localeCompare(b.name)),
      folders: (folders ?? [])
        .map((f) => ({
          id: f.id,
          name: f.name,
          parent_id: f.parent_id,
          path: folderPath(f.id, allFolders),
        }))
        .sort((a, b) => relevanceScore(b.name, data.term) - relevanceScore(a.name, data.term) || rank(a.name, data.term) - rank(b.name, data.term) || a.name.localeCompare(b.name)),
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

function snippetAt(pages: string[], page: number, term: string) {
  const text = pages[page - 1] ?? "";
  const token = searchTokens(term).find((t) => /\d/.test(t)) ?? searchTokens(term)[0] ?? "";
  const pattern = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/§/g, "§\\s*");
  const at = Math.max(0, text.search(new RegExp(pattern, "iu")));
  const start = Math.max(0, at - 70);
  return { page, snippet: `${start ? "… " : ""}${text.slice(start, at + 160).trim()} …` };
}


