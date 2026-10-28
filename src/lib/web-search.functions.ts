import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";

export type WebSource = {
  n: number;
  title: string;
  url: string;
  snippet: string;
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
  .inputValidator((input: { query: string }) => {
    const query = String(input?.query ?? "").trim();
    if (query.length < 3 || query.length > 400) throw new Error("Ungültige Suchanfrage");
    return { query };
  })
  .handler(async ({ data }) => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      return { answer: "", sources: [] as WebSource[], error: "Die Internetsuche ist nicht verbunden." };
    }

    let hits: FirecrawlSearchHit[] = [];
    try {
      const res = await fetch(`${GATEWAY}/v2/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": firecrawlKey,
        },
        body: JSON.stringify({ query: data.query, limit: 6, scrapeOptions: { formats: ["markdown"] } }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("searchWeb firecrawl", res.status, body.slice(0, 300));
        const error =
          res.status === 402
            ? "Das Suchbudget ist aufgebraucht. Bitte in den Lovable-Einstellungen (Pläne & Guthaben) auffüllen."
            : res.status === 429
              ? "Gerade zu viele Suchanfragen – bitte gleich nochmal versuchen."
              : "Die Internetsuche ist gerade nicht erreichbar.";
        return { answer: "", sources: [] as WebSource[], error };
      }
      const json = (await res.json()) as { success?: boolean; data?: { web?: FirecrawlSearchHit[] } };
      hits = json.data?.web ?? [];
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
      .slice(0, 6)
      .map((h, i) => {
        const body = clean(h.markdown || h.description || "").slice(0, 1200);
        return {
          n: i + 1,
          title: (h.title || h.url || "Ergebnis").trim().slice(0, 160),
          url: h.url!,
          body,
          snippet: (h.description?.trim() || body).slice(0, 220),
        };
      });

    if (!usable.length) {
      return { answer: "Dazu habe ich im Internet nichts gefunden.", sources: [] as WebSource[], error: null };
    }

    const excerpts = usable
      .map((s) => `[${s.n}] ${s.title} (${s.url}):\n${s.snippet}`)
      .join("\n\n");

    try {
      const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
      try {
        const res = await generateResponse({
          model: "openai/gpt-6-astra",
          instructions:
            "Du beantwortest Suchanfragen ausschließlich anhand der nummerierten Internetergebnisse. Antworte kurz (höchstens 6 Sätze) auf Deutsch und nenne die wichtigsten Punkte. Belege jede Aussage mit [n]. Wenn die Ergebnisse die Frage nicht beantworten, sage das ehrlich und erfinde nichts.",
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
