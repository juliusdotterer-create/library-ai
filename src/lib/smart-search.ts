/** Browser-sichere Helfer für die smarte Library-Suche (Fragen + Filter in Worten). */

export type SearchMime = "pdf" | "word" | "image";

export type SearchFilters = {
  folderName?: string;
  mime?: SearchMime;
  from?: string; // ISO
  to?: string; // ISO
};

export type ParsedQuery = { term: string; filters: SearchFilters; chips: { key: keyof SearchFilters | "date"; label: string }[] };

const QUESTION_START = /^(wo|was|wie|wann|warum|wieso|weshalb|welche[rsmn]?|wer|erkläre?|erklär|fasse|gibt es|kannst du|nenne?)\b/i;

export function isQuestion(input: string): boolean {
  const s = input.trim();
  if (s.split(/\s+/).length < 2) return false;
  return s.endsWith("?") || QUESTION_START.test(s);
}

const MIME_WORDS: [RegExp, SearchMime, string][] = [
  [/\bpdfs?\b/i, "pdf", "PDF"],
  [/\b(word|docx?)\b/i, "word", "Word"],
  [/\b(bilder?|fotos?|images?)\b/i, "image", "Bilder"],
];

const FILLER = /\b(aus|von|vom|im|in|mit|der|die|das|den|dem|alle|meine?)\b/gi;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseQuery(input: string, now = new Date()): ParsedQuery {
  let rest = ` ${input.trim()} `;
  const filters: SearchFilters = {};
  const chips: ParsedQuery["chips"] = [];

  const folder = rest.match(/\b(?:im\s+|in\s+(?:dem\s+)?)?ordner\s+["„]?([^"“\s]+(?:\s+[^"“\s]+)?)["“]?/i);
  if (folder) {
    // Nur das erste Wort, außer es ist in Anführungszeichen
    const quoted = /["„]/.test(folder[0]);
    const name = quoted ? folder[1]!.trim() : folder[1]!.split(/\s+/)[0]!;
    filters.folderName = name;
    chips.push({ key: "folderName", label: `Ordner: ${name}` });
    rest = rest.replace(quoted ? folder[0] : new RegExp(`\\b(?:im\\s+|in\\s+(?:dem\\s+)?)?ordner\\s+${escapeRe(name)}`, "i"), " ");
  }

  for (const [re, mime, label] of MIME_WORDS) {
    if (re.test(rest)) {
      filters.mime = mime;
      chips.push({ key: "mime", label });
      rest = rest.replace(re, " ");
      break;
    }
  }

  const today = startOfDay(now);
  const day = 86_400_000;
  const rel: [RegExp, () => [Date, Date], string][] = [
    [/\bheute\b/i, () => [today, new Date(today.getTime() + day)], "Heute"],
    [/\bgestern\b/i, () => [new Date(today.getTime() - day), today], "Gestern"],
    [/\b(letzte[nr]?|vergangene[nr]?)\s+woche\b/i, () => [new Date(today.getTime() - 7 * day), new Date(today.getTime() + day)], "Letzte 7 Tage"],
    [/\b(letzte[nr]?|vergangene[nr]?)\s+monat\b/i, () => [new Date(today.getTime() - 30 * day), new Date(today.getTime() + day)], "Letzte 30 Tage"],
  ];
  let dated = false;
  for (const [re, range, label] of rel) {
    if (re.test(rest)) {
      const [f, t] = range();
      filters.from = f.toISOString();
      filters.to = t.toISOString();
      chips.push({ key: "date", label });
      rest = rest.replace(re, " ");
      dated = true;
      break;
    }
  }
  if (!dated) {
    const year = rest.match(/\b(20\d{2}|19\d{2})\b/);
    if (year) {
      const y = Number(year[1]);
      filters.from = new Date(y, 0, 1).toISOString();
      filters.to = new Date(y + 1, 0, 1).toISOString();
      chips.push({ key: "date", label: String(y) });
      rest = rest.replace(year[0], " ");
    }
  }

  const term = chips.length ? rest.replace(FILLER, " ").replace(/\s+/g, " ").trim() : input.trim();
  return { term, filters, chips };
}

export function hasFilters(f: SearchFilters): boolean {
  return !!(f.folderName || f.mime || f.from || f.to);
}

export function matchesMime(mime: string | null | undefined, name: string, want?: SearchMime): boolean {
  if (!want) return true;
  const m = (mime ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (want === "pdf") return m.includes("pdf") || n.endsWith(".pdf");
  if (want === "word") return m.includes("word") || /\.docx?$/.test(n);
  return m.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/.test(n);
}

export function inRange(iso: string | null | undefined, f: SearchFilters): boolean {
  if (!f.from && !f.to) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (f.from && t < new Date(f.from).getTime()) return false;
  if (f.to && t >= new Date(f.to).getTime()) return false;
  return true;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
