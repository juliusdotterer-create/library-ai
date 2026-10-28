/** Browser-sichere Relevanzregeln für die interne Library-Suche. */
export function relevanceNorm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/§\s*/g, "§")
    .replace(/[^\p{L}\p{N}§]+/gu, " ")
    .trim();
}

export function searchTokens(term: string): string[] {
  return Array.from(new Set(relevanceNorm(term).split(" ").filter((t) => t.length > 1 || /\d/.test(t))));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Zahlen und Paragraphen müssen vollständig passen: § 13 trifft nicht § 1. */
export function tokenMatches(text: string, token: string): boolean {
  const t = relevanceNorm(text);
  const exactNumber = /\d/.test(token);
  const re = exactNumber
    ? new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(token)}(?![\\p{L}\\p{N}])`, "u")
    : new RegExp(escapeRe(token), "u");
  return re.test(t);
}

export function relevanceScore(text: string, term: string): number {
  const tokens = searchTokens(term);
  if (!tokens.length) return 0;
  if (tokens.some((t) => /\d/.test(t) && !tokenMatches(text, t))) return 0;
  const matched = tokens.filter((t) => tokenMatches(text, t)).length;
  const exactPhrase = tokenMatches(text, relevanceNorm(term)) ? 1 : 0;
  return matched * 10 + exactPhrase * 5;
}

export function bestPage(pages: string[], term: string): { page: number; score: number } | null {
  let best: { page: number; score: number } | null = null;
  pages.forEach((p, i) => {
    const score = relevanceScore(p, term);
    if (score > 0 && (!best || score > best.score)) best = { page: i + 1, score };
  });
  return best;
}