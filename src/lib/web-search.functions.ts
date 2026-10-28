import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";
import {
  DEFAULT_PREFS,
  buildSiteQuery,
  isBlocked,
  kindOf,
  planSearches,
  type SourceKind,
  type WebPrefs,
  type WebScope,
} from "@/lib/web-sources";

export type WebSource = {
  n: number;
  title: string;
  url: string;
  body?: string;
  snippet: string;
  kind?: SourceKind;
};

type FirecrawlSearchHit = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl";

export const searchWeb = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { query: string; scope?: WebScope }) => {
    const query = String(input?.query ?? "").trim();
    if (query.length < 3 || query.length > 400) throw new Error("Ungültige Suchanfrage");
    const scope = ["legal_only", "prefer_legal", "all"].includes(String(input?.scope))
      ? (input.scope as WebScope)
      : undefined;
    return { query, scope };
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("web_search_prefs")
      .select("scope, disabled_domains, custom_domains, blocked_domains")
      .eq("user_id", context.userId)
      .maybeSingle();
    const prefs: WebPrefs = row ? { ...DEFAULT_PREFS, ...(row as Partial<WebPrefs>) } : DEFAULT_PREFS;
    const scope = data.scope ?? prefs.scope;
    const runs = planSearches(prefs, scope);
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      return { answer: "", sources: [] as WebSource[], error: "Die Internetsuche ist nicht verbunden." };
    }

    let hits: FirecrawlSearchHit[] = [];
    const runSearch = async (domains: string[], limit: number) => {
      const res = await fetch(`${GATEWAY}/v2/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": firecrawlKey,
        },
        body: JSON.stringify({
          query: buildSiteQuery(data.query, domains, prefs.blocked_domains),
          limit,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("searchWeb firecrawl", res.status, body.slice(0, 300));
        throw Object.assign(new Error("firecrawl"), { status: res.status });
      }
      const json = (await res.json()) as { data?: { web?: FirecrawlSearchHit[] } };
      return json.data?.web ?? [];
    };
    try {
      const results = await Promise.allSettled(runs.map((r) => runSearch(r.domains, runs.length > 1 ? 4 : 6)));
      const ok = results.filter((r): r is PromiseFulfilledResult<FirecrawlSearchHit[]> => r.status === "fulfilled");
      if (!ok.length) {
        const status = (results[0] as PromiseRejectedResult).reason?.status;
        const error =
          status === 402
            ? "Das Suchbudget ist aufgebraucht. Bitte in den Lovable-Einstellungen (Pläne & Guthaben) auffüllen."
            : status === 429
              ? "Gerade zu viele Suchanfragen – bitte gleich nochmal versuchen."
              : "Die Internetsuche ist gerade nicht erreichbar.";
        return { answer: "", sources: [] as WebSource[], error };
      }
      const seen = new Set<string>();
      for (const r of ok) for (const h of r.value) {
        if (!h.url || seen.has(h.url) || isBlocked(h.url, prefs.blocked_domains)) continue;
        seen.add(h.url);
        hits.push(h);
      }
    } catch (e) {
      console.error("searchWeb firecrawl fetch", e);
      return { answer: "", sources: [] as WebSource[], error: "Die Internetsuche ist gerade nicht erreichbar." };
    }

    // Markdown-Verschmutzung (Links, Klammern, Symbole) aus den Texten entfernen
    const clean = (md: string) =>
      md
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[#*_>`~|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const usable = hits
      .filter((h) => h.url)
      .slice(0, 8)
      .map((h, i) => {
        const body = clean(h.markdown || h.description || "").slice(0, 1200);
        return {
          n: i + 1,
          title: (h.title || h.url || "Ergebnis").trim().slice(0, 160),
          url: h.url!,
          body,
          snippet: (body || clean(h.description || "")).slice(0, 220),
          kind: kindOf(h.url!),
        };
      });

    if (!usable.length) {
      return { answer: "Dazu habe ich im Internet nichts gefunden.", sources: [] as WebSource[], error: null };
    }

    const excerpts = usable
      .map((s) => `[${s.n}] ${s.title} (${s.url}):\n${s.body || s.snippet}`)
      .join("\n\n");

    try {
      const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
      try {
        const res = await generateResponse({
          model: "openai/gpt-6-astra",
          instructions:
            "Du beantwortest Suchanfragen ausschließlich anhand der nummerierten Internetergebnisse. Antworte kurz (höchstens 6 Sätze) auf Deutsch und nenne die wichtigsten Punkte. Belege jede Aussage mit [n]. Zitiere Normen genau (z. B. § 7 Abs. 1 EStG) und Urteile mit Gericht, Datum und Aktenzeichen, soweit angegeben. Wenn die Ergebnisse die Frage nicht beantworten, sage das ehrlich und erfinde nichts.",
          input: `Suchanfrage: ${data.query}\n\nInternetergebnisse:\n\n${excerpts}`,
        });
        let answer = "";
        for (const item of res.output ?? []) {
          if (item.type === "message") {
            for (const c of item.content) if (c.type === "output_text") answer += c.text;
          }
        }
        const used = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
        return {
          answer: answer.trim() || "Keine Antwort erhalten.",
          sources: used.size ? usable.filter((s) => used.has(s.n)) : usable,
          error: null as string | null,
        };
      } catch (e) {
        if (e instanceof GatewayError) {
          console.error("searchWeb gateway", e.code, e.httpStatus);
          const msg =
            e.httpStatus === 429
              ? "Gerade zu viele Anfragen – bitte gleich nochmal versuchen."
              : e.httpStatus === 402
                ? "KI-Guthaben aufgebraucht."
                : "Die KI ist gerade nicht erreichbar.";
          return { answer: "", sources: usable, error: msg };
        }
        throw e;
      }
    } catch (e) {
      console.error("searchWeb", e);
      // KI nicht erreichbar: trotzdem die Treffer zeigen
      return { answer: "", sources: usable, error: null as string | null };
    }
  });
