// Browser-sichere Quellen-Logik für die Internetsuche (keine Server-Imports).

export type WebScope = "legal_only" | "prefer_legal" | "all";
export type SourceKind = "gesetz" | "urteil" | "allgemein";

export type PresetSource = { domain: string; label: string; group: "legal" | "general"; kind: SourceKind };

export const PRESET_SOURCES: PresetSource[] = [
  { domain: "gesetze-im-internet.de", label: "Gesetze im Internet (Bundesgesetze)", group: "legal", kind: "gesetz" },
  { domain: "dejure.org", label: "dejure.org (Gesetze und Urteile)", group: "legal", kind: "gesetz" },
  { domain: "eur-lex.europa.eu", label: "EUR-Lex (EU-Recht, soweit in DE gültig)", group: "legal", kind: "gesetz" },
  { domain: "bundesverfassungsgericht.de", label: "Bundesverfassungsgericht", group: "legal", kind: "urteil" },
  { domain: "bundesgerichtshof.de", label: "Bundesgerichtshof", group: "legal", kind: "urteil" },
  { domain: "bundesfinanzhof.de", label: "Bundesfinanzhof", group: "legal", kind: "urteil" },
  { domain: "bundesfinanzministerium.de", label: "Bundesfinanzministerium (BMF-Schreiben)", group: "legal", kind: "gesetz" },
  { domain: "rechtsprechung-im-internet.de", label: "Rechtsprechung im Internet", group: "legal", kind: "urteil" },
  { domain: "de.wikipedia.org", label: "Wikipedia (deutsch)", group: "general", kind: "allgemein" },
  { domain: "bpb.de", label: "Bundeszentrale für politische Bildung", group: "general", kind: "allgemein" },
  { domain: "destatis.de", label: "Statistisches Bundesamt", group: "general", kind: "allgemein" },
];

export type WebPrefs = {
  scope: WebScope;
  disabled_domains: string[];
  custom_domains: string[];
  blocked_domains: string[];
};

export const DEFAULT_PREFS: WebPrefs = { scope: "prefer_legal", disabled_domains: [], custom_domains: [], blocked_domains: [] };

export const SCOPE_LABELS: Record<WebScope, string> = {
  legal_only: "Nur Rechtsquellen",
  prefer_legal: "Rechtsquellen bevorzugt",
  all: "Ganzes Internet",
};

/** "https://www.Haufe.de/x" -> "haufe.de"; ungültig -> null */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

export function legalDomains(p: WebPrefs): string[] {
  return PRESET_SOURCES.filter((s) => s.group === "legal" && !p.disabled_domains.includes(s.domain)).map((s) => s.domain);
}

export function generalDomains(p: WebPrefs): string[] {
  const presets = PRESET_SOURCES.filter((s) => s.group === "general" && !p.disabled_domains.includes(s.domain)).map((s) => s.domain);
  return [...presets, ...p.custom_domains];
}

/** Baut die Suchanfrage mit site:-Filtern. Leere Domainliste = keine Einschränkung. */
export function buildSiteQuery(query: string, domains: string[], blocked: string[]): string {
  const parts = [query.trim()];
  if (domains.length) parts.push(`(${domains.map((d) => `site:${d}`).join(" OR ")})`);
  for (const b of blocked) parts.push(`-site:${b}`);
  return parts.join(" ");
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function matchesDomain(url: string, domain: string): boolean {
  const h = hostOf(url);
  return h === domain || h.endsWith(`.${domain}`);
}

export function isBlocked(url: string, blocked: string[]): boolean {
  return blocked.some((d) => matchesDomain(url, d));
}

export function kindOf(url: string): SourceKind {
  const preset = PRESET_SOURCES.find((s) => matchesDomain(url, s.domain));
  if (preset?.kind === "gesetz" && /urteil|beschluss|entscheidung|rechtsprechung|az\b/i.test(url)) return "urteil";
  return preset?.kind ?? "allgemein";
}

/** Welche Suchläufe für einen Umfang nötig sind (leere Liste = ganzes Web). */
export function planSearches(p: WebPrefs, scope: WebScope = p.scope): { domains: string[]; legal: boolean }[] {
  const legal = legalDomains(p);
  if (scope === "legal_only") return [{ domains: legal, legal: true }];
  if (scope === "prefer_legal") return [{ domains: legal, legal: true }, { domains: generalDomains(p), legal: false }];
  return [{ domains: [], legal: false }];
}

export function sourceCount(p: WebPrefs, scope: WebScope = p.scope): number {
  if (scope === "legal_only") return legalDomains(p).length;
  if (scope === "prefer_legal") return legalDomains(p).length + generalDomains(p).length;
  return 0;
}
