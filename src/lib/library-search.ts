/**
 * Lokale Library-Suche (eigenständige Demo): durchsucht Namen, Ordner und den
 * gespeicherten Volltext direkt im Browser. Ranking und Seitenauswahl kommen
 * aus den reinen Helfern `smart-search` und `search-relevance`.
 */
import { supabase } from "@/integrations/supabase/client";
import { LOCAL_USER_ID } from "@/integrations/local/db";
import { inRange, matchesMime, type SearchFilters } from "@/lib/smart-search";
import { bestPage, relevanceScore, searchTokens } from "@/lib/search-relevance";

type FolderNode = { id: string; name: string; parent_id: string | null };
type DocRow = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  folder_id: string | null;
  kind: string | null;
  notebook_id: string | null;
  source: string | null;
  created_at: string;
};
type TextRow = { document_id: string; pages: unknown; source: string | null; status: string };

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

export type Similar = {
  kind: "doc" | "folder";
  id: string;
  name: string;
  path: string;
  storage_path?: string;
  mime_type?: string | null;
  folder_id?: string | null;
  source?: string | null;
  doc_kind?: string | null;
  notebook_id?: string | null;
};

/** Einfache Tippfehler-Distanz für „Ähnliche Treffer“. */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

function isSimilar(name: string, term: string): boolean {
  const t = norm(term);
  const tol = t.length >= 8 ? 2 : 1;
  return norm(name)
    .split(" ")
    .some((w) => w.length >= 3 && editDistance(w, t) <= tol);
}

export async function searchLibrary({ data: input }: { data: { term: string; filters?: SearchFilters } }) {
  const term = String(input?.term ?? "").trim();
  const F: SearchFilters = input?.filters ?? {};
  const anyFilter = !!(F.folderName || F.mime || F.from || F.to);
  if ((!term && !anyFilter) || term.length > 200) throw new Error("Ungültiger Suchbegriff");

  const [{ data: docRows }, { data: folderRows }, { data: textRows }] = await Promise.all([
    supabase
      .from("documents")
      .select("id,name,storage_path,mime_type,folder_id,kind,notebook_id,source,created_at")
      .eq("user_id", LOCAL_USER_ID)
      .is("deleted_at", null)
      .not("name", "ilike", "desktop.ini"),
    supabase.from("folders").select("id,name,parent_id").eq("user_id", LOCAL_USER_ID).is("deleted_at", null),
    supabase.from("document_text").select("document_id,pages,source,status").eq("status", "done"),
  ]);
  const allDocs = (docRows ?? []) as DocRow[];
  const allFolders = (folderRows ?? []) as FolderNode[];
  const texts = (textRows ?? []) as TextRow[];

  const folders = anyFilter
    ? []
    : allFolders
        .filter((f) => !term || relevanceScore(f.name, term) > 0)
        .sort((a, b) => relevanceScore(b.name, term) - relevanceScore(a.name, term))
        .slice(0, 50);

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
  const passes = (d: DocRow) =>
    (!folderScope || (!!d.folder_id && folderScope.has(d.folder_id))) &&
    matchesMime(d.mime_type, d.name, F.mime) &&
    inRange(d.created_at, F);

  const docs = allDocs
    .filter(passes)
    .filter((d) => !term || relevanceScore(d.name, term) > 0)
    .slice(0, anyFilter ? 500 : 100);

  /* ---------- Volltextsuche im Dokumentinhalt ---------- */
  const pagesOf = (h: TextRow) => (Array.isArray(h.pages) ? (h.pages as unknown[]).map((p) => String(p ?? "")) : []);
  const hitRows = term
    ? texts
        .map((h) => ({ h, best: bestPage(pagesOf(h), term) }))
        .filter((x) => (x.best?.score ?? 0) > 0)
        .sort((a, b) => b.best!.score - a.best!.score)
        .slice(0, 50)
    : [];
  const nameHitIds = new Set(docs.map((d) => d.id));
  const docById = new Map(allDocs.map((d) => [d.id, d]));
  const contents = hitRows
    .filter((x) => !nameHitIds.has(x.h.document_id))
    .map((x) => ({ ...x, d: docById.get(x.h.document_id) }))
    .filter((x): x is typeof x & { d: DocRow } => !!x.d && passes(x.d))
    .map(({ h, best, d }) => {
      const pages = pagesOf(h);
      const found = (best ? snippetAt(pages, best.page, term) : null) ?? {
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
        ocr: h.source === "ocr",
      };
    });

  /* ---------- Tippfehler verzeihen: ähnliche Namen ---------- */
  let similar: Similar[] = [];
  if (term.length >= 4 && !/\d/.test(term) && docs.length + folders.length + contents.length < 5) {
    const seen = new Set([...docs.map((d) => d.id), ...folders.map((f) => f.id), ...contents.map((c) => c.id)]);
    similar = [
      ...(anyFilter ? [] : allFolders)
        .filter((f) => !seen.has(f.id) && isSimilar(f.name, term))
        .map((f): Similar => ({ kind: "folder", id: f.id, name: f.name, path: folderPath(f.id, allFolders) })),
      ...allDocs
        .filter((d) => !seen.has(d.id) && passes(d) && isSimilar(d.name, term))
        .map(
          (d): Similar => ({
            kind: "doc",
            id: d.id,
            name: d.name,
            path: folderPath(d.folder_id, allFolders),
            storage_path: d.storage_path,
            mime_type: d.mime_type,
            folder_id: d.folder_id,
            source: d.source,
            doc_kind: d.kind,
            notebook_id: d.notebook_id,
          }),
        ),
    ].slice(0, 10);
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
      .sort(
        (a, b) =>
          relevanceScore(b.name, term) - relevanceScore(a.name, term) ||
          rank(a.name, term) - rank(b.name, term) ||
          a.name.localeCompare(b.name),
      ),
    folders: folders
      .map((f) => ({ id: f.id, name: f.name, parent_id: f.parent_id, path: folderPath(f.id, allFolders) }))
      .sort(
        (a, b) =>
          relevanceScore(b.name, term) - relevanceScore(a.name, term) ||
          rank(a.name, term) - rank(b.name, term) ||
          a.name.localeCompare(b.name),
      ),
    contents,
  };
}

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
  const pattern = Array.from(token.replace(/\s/g, "")).map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
  const boundary = /\d/.test(token) ? "(?![\\p{L}\\p{N}])" : "";
  const at = Math.max(0, text.search(new RegExp(pattern + boundary, "iu")));
  const start = Math.max(0, at - 70);
  return { page, snippet: `${start ? "… " : ""}${text.slice(start, at + 160).trim()} …` };
}


