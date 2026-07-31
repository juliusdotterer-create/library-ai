import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_events",
  title: "Termine auflisten",
  description: "Listet Kalendertermine des angemeldeten Nutzers, optional in einem Zeitraum.",
  inputSchema: {
    from: z.string().describe("ISO-Startzeitpunkt des Zeitraums.").optional(),
    to: z.string().describe("ISO-Endzeitpunkt des Zeitraums.").optional(),
    limit: z.number().int().describe("Maximale Trefferzahl (Standard 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("events")
      .select("id, title, notes, start_at, end_at, all_day, color, document_id")
      .order("start_at")
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (from) query = query.gte("start_at", from);
    if (to) query = query.lte("start_at", to);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
