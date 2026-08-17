import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";

export type ParsedTimetableEntry = {
  title: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher: string | null;
};

const SYSTEM = `Du extrahierst Stundenplan-Einträge aus Freitext (kopierte Tabellen, Notizen, Mails).
Regeln:
- weekday: 1=Montag ... 7=Sonntag.
- start_time/end_time im Format "HH:MM" (24h). Fehlt das Ende, nimm 90 Minuten nach Start.
- room und teacher nur setzen, wenn eindeutig erkennbar, sonst null.
- Keine Duplikate, keine erfundenen Einträge.
Antworte ausschließlich über das Tool "emit_entries".`;

export const parseTimetableText = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((data: { text: string }) => {
    const text = String(data?.text ?? "").trim();
    if (text.length < 5) throw new Error("Bitte zuerst einen Stundenplan-Text einfügen.");
    return { text: text.slice(0, 12000) };
  })
  .handler(async ({ data }): Promise<{ entries: ParsedTimetableEntry[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("KI ist derzeit nicht verfügbar.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: data.text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_entries",
              description: "Gibt die erkannten Stundenplan-Einträge zurück.",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        weekday: { type: "integer", minimum: 1, maximum: 7 },
                        start_time: { type: "string" },
                        end_time: { type: "string" },
                        room: { type: ["string", "null"] },
                        teacher: { type: ["string", "null"] },
                      },
                      required: ["title", "weekday", "start_time", "end_time"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["entries"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_entries" } },
      }),
    });

    if (res.status === 429) throw new Error("KI-Limit erreicht, bitte kurz warten.");
    if (res.status === 402) throw new Error("KI-Guthaben aufgebraucht.");
    if (!res.ok) throw new Error("KI-Analyse fehlgeschlagen.");

    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { entries: [] };

    let raw: { entries?: unknown } = {};
    try {
      raw = JSON.parse(args) as { entries?: unknown };
    } catch {
      return { entries: [] };
    }

    const time = (v: unknown, fallback: string) => {
      const m = /^(\d{1,2})[:.](\d{2})/.exec(String(v ?? ""));
      if (!m) return fallback;
      const h = Math.min(23, Number(m[1]));
      const min = Math.min(59, Number(m[2]));
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    };

    const entries: ParsedTimetableEntry[] = (Array.isArray(raw.entries) ? raw.entries : [])
      .map((e) => {
        const o = e as Record<string, unknown>;
        const title = String(o.title ?? "").trim();
        const weekday = Math.min(7, Math.max(1, Number(o.weekday) || 1));
        const start = time(o.start_time, "08:00");
        let end = time(o.end_time, "");
        if (!end || end <= start) {
          const [h, m] = start.split(":").map(Number);
          const total = Math.min(23 * 60 + 59, (h ?? 0) * 60 + (m ?? 0) + 90);
          end = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        }
        const room = o.room ? String(o.room).trim() || null : null;
        const teacher = o.teacher ? String(o.teacher).trim() || null : null;
        return { title, weekday, start_time: start, end_time: end, room, teacher };
      })
      .filter((e) => e.title.length > 0)
      .slice(0, 80);

    return { entries };
  });
