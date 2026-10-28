import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";

export type AskSource = {
  n: number;
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  folder_id: string | null;
  source: string | null;
  page: number;
  snippet: string;
};

const STOP = new Set(
  "wo was wie wann warum wieso weshalb welche welcher welches wer ist sind steht stehen gibt es der die das den dem des ein eine einen einem und oder zu zum zur im in an auf mit von für über aus bei mir mich ich du kannst bitte erkläre erklär fasse zusammen nenne meine meinen dazu etwas".split(" "),
);

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const askLibrary = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { question: string }) => {
    const question = String(input?.question ?? "").trim();
    if (question.length < 3 || question.length > 500) throw new Error("Ungültige Frage");
    return { question };
  })
  .handler(async ({ data, context }) => {
    const keywords = [...new Set(norm(data.question).split(" ").filter((w) => w.length > 2 && !STOP.has(w)))].slice(0, 8);
    if (!keywords.length) return { answer: "Formuliere die Frage bitte mit einem Fachbegriff.", sources: [] as AskSource[], error: null };

    // Kandidaten: Volltext (ODER-verknüpft, Präfix) über den Dokumenttext
    const tsq = keywords.map((k) => `${k}:*`).join(" | ");
    const { data: rows } = await context.supabase
      .from("document_text")
      .select("document_id,pages")
      .eq("user_id", context.userId)
      .eq("status", "done")
      .textSearch("tsv", tsq, { config: "german" })
      .limit(25);

    // Seiten bewerten
    const scored: { document_id: string; page: number; text: string; score: number }[] = [];
    for (const r of rows ?? []) {
      const pages = Array.isArray(r.pages) ? (r.pages as unknown[]).map((p) => String(p ?? "")) : [];
      pages.forEach((text, i) => {
        const n = norm(text);
        let score = 0;
        for (const k of keywords) {
          const stem = k.slice(0, Math.max(4, k.length - 2));
          const hits = n.split(stem).length - 1;
          if (hits) score += 2 + Math.min(hits, 5);
        }
        if (score) scored.push({ document_id: r.document_id, page: i + 1, text, score });
      });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 8);
    if (!top.length) {
      return { answer: "Dazu habe ich in deinen Dokumenten nichts gefunden.", sources: [] as AskSource[], error: null };
    }

    const { data: docs } = await context.supabase
      .from("documents")
      .select("id,name,storage_path,mime_type,folder_id,source")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .in("id", [...new Set(top.map((t) => t.document_id))]);
    const byId = new Map((docs ?? []).map((d) => [d.id, d]));

    const sources: AskSource[] = [];
    const excerpts: string[] = [];
    for (const t of top) {
      const d = byId.get(t.document_id);
      if (!d) continue;
      const n = sources.length + 1;
      // Ausschnitt rund um den ersten Treffer
      const low = t.text.toLowerCase();
      const at = Math.max(0, ...keywords.map((k) => low.indexOf(k.slice(0, 4))).filter((x) => x >= 0).slice(0, 1));
      const start = Math.max(0, at - 600);
      const excerpt = t.text.slice(start, start + 1800).replace(/\s+/g, " ").trim();
      excerpts.push(`[${n}] ${d.name}, Seite ${t.page}:\n${excerpt}`);
      sources.push({
        n,
        id: d.id,
        name: d.name,
        storage_path: d.storage_path,
        mime_type: d.mime_type,
        folder_id: d.folder_id,
        source: d.source,
        page: t.page,
        snippet: `${t.text.slice(at, at + 160).replace(/\s+/g, " ").trim()} …`,
      });
    }

    try {
      const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
      try {
        const res = await generateResponse({
          model: "openai/gpt-6-astra",
          instructions:
            "Du beantwortest Fragen ausschließlich anhand der nummerierten Auszüge aus den Dokumenten des Nutzers. Antworte kurz (höchstens 6 Sätze) auf Deutsch. Belege jede Aussage mit [n]. Wenn die Auszüge die Frage nicht beantworten, sage das ehrlich und erfinde nichts.",
          input: `Frage: ${data.question}\n\nAuszüge:\n\n${excerpts.join("\n\n")}`,
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
          sources: used.size ? sources.filter((s) => used.has(s.n)) : sources,
          error: null as string | null,
        };
      } catch (e) {
        if (e instanceof GatewayError) {
          console.error("askLibrary gateway", e.code, e.httpStatus);
          const msg =
            e.httpStatus === 429
              ? "Gerade zu viele Anfragen – bitte gleich nochmal versuchen."
              : e.httpStatus === 402
                ? "KI-Guthaben aufgebraucht."
                : "Die KI ist gerade nicht erreichbar.";
          return { answer: "", sources, error: msg };
        }
        throw e;
      }
    } catch (e) {
      console.error("askLibrary", e);
      return { answer: "", sources, error: "Die KI ist gerade nicht erreichbar." };
    }
  });
