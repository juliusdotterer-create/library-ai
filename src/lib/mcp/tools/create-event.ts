import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_event",
  title: "Termin anlegen",
  description: "Legt einen neuen Kalendertermin für den angemeldeten Nutzer an.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Titel des Termins."),
    start_at: z.string().describe("ISO-Startzeitpunkt, z. B. 2026-08-01T09:00:00Z."),
    end_at: z.string().describe("ISO-Endzeitpunkt.").optional(),
    notes: z.string().describe("Freitext-Notiz zum Termin.").optional(),
    all_day: z.boolean().describe("Ganztägiger Termin.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, start_at, end_at, notes, all_day }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("events")
      .insert({
        user_id: ctx.getUserId(),
        title,
        start_at,
        end_at: end_at ?? null,
        notes: notes ?? null,
        all_day: all_day ?? false,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { event: data },
    };
  },
});
