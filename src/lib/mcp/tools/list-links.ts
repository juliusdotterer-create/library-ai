import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_links",
  title: "Linktree auflisten",
  description: "Listet die gespeicherten Links (Linktree) des angemeldeten Nutzers.",
  inputSchema: {
    limit: z.number().int().describe("Maximale Trefferzahl (Standard 100).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("links")
      .select("id, title, url, description, position")
      .order("position")
      .limit(Math.min(Math.max(limit ?? 100, 1), 200));
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { links: data ?? [] },
    };
  },
});
