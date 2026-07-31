import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_study_tasks",
  title: "Lernaufgaben auflisten",
  description:
    "Listet Lehrplan-Aufgaben des angemeldeten Nutzers, optional gefiltert nach Status oder Lehrplan.",
  inputSchema: {
    plan_id: z.string().uuid().describe("ID des Lehrplans.").optional(),
    status: z.string().describe("Status-Filter, z. B. open oder done.").optional(),
    limit: z.number().int().describe("Maximale Trefferzahl (Standard 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ plan_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("study_tasks")
      .select("id, plan_id, title, notes, due_date, status, document_id, position")
      .order("due_date", { ascending: true })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (plan_id) query = query.eq("plan_id", plan_id);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
