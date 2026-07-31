import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_folder",
  title: "Ordnerinhalt auflisten",
  description:
    "Listet Unterordner und Dokumente eines Ordners. Ohne folder_id wird die oberste Ebene der Library gezeigt.",
  inputSchema: {
    folder_id: z.string().uuid().describe("ID des Ordners; leer lassen für die oberste Ebene.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ folder_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const folderQuery = supabase
      .from("folders")
      .select("id, name, parent_id")
      .is("deleted_at", null)
      .order("name");
    const docQuery = supabase
      .from("documents")
      .select("id, name, folder_id, mime_type, size_bytes, created_at")
      .is("deleted_at", null)
      .not("name", "ilike", "desktop.ini")
      .order("name");

    const [folders, documents] = await Promise.all([
      folder_id ? folderQuery.eq("parent_id", folder_id) : folderQuery.is("parent_id", null),
      folder_id ? docQuery.eq("folder_id", folder_id) : docQuery.is("folder_id", null),
    ]);

    const error = folders.error ?? documents.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const result = { folders: folders.data ?? [], documents: documents.data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
