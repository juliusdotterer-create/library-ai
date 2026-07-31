import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_library",
  title: "Library durchsuchen",
  description:
    "Sucht Dokumente und Ordner in der Library des angemeldeten Nutzers anhand eines Namensfragments.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Suchbegriff für Dokument- oder Ordnernamen."),
    limit: z.number().int().describe("Maximale Trefferzahl (Standard 25).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const max = Math.min(Math.max(limit ?? 25, 1), 100);

    const [docs, folders] = await Promise.all([
      supabase
        .from("documents")
        .select("id, name, folder_id, mime_type, size_bytes, created_at")
        .is("deleted_at", null)
        .not("name", "ilike", "desktop.ini")
        .ilike("name", `%${query}%`)
        .limit(max),
      supabase
        .from("folders")
        .select("id, name, parent_id, created_at")
        .is("deleted_at", null)
        .ilike("name", `%${query}%`)
        .limit(max),
    ]);

    const error = docs.error ?? folders.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const result = { documents: docs.data ?? [], folders: folders.data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
