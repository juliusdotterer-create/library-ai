import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";

type SavePayload = {
  documentId: string;
  content: string;
  pages: string[];
  pageCount: number;
  status: "done" | "unsupported" | "failed";
};

const MAX_CHARS = 400_000;

/** Speichert den extrahierten Text eines eigenen Dokuments für die Volltextsuche. */
export const saveDocumentText = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: SavePayload) => {
    const documentId = String(input?.documentId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error("Ungültige Dokument-ID");
    const status = input?.status;
    if (status !== "done" && status !== "unsupported" && status !== "failed") {
      throw new Error("Ungültiger Status");
    }
    const pages = Array.isArray(input?.pages) ? input.pages.map((p) => String(p ?? "")) : [];
    return {
      documentId,
      status,
      pages,
      pageCount: Number.isFinite(input?.pageCount) ? Math.max(0, Math.trunc(input.pageCount)) : 0,
      content: String(input?.content ?? "").slice(0, MAX_CHARS),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: doc, error: docErr } = await context.supabase
      .from("documents")
      .select("id")
      .eq("id", data.documentId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("Dokument nicht gefunden");

    const { error } = await context.supabase.from("document_text").upsert(
      {
        user_id: context.userId,
        document_id: data.documentId,
        content: data.content,
        pages: data.pages,
        page_count: data.pageCount,
        status: data.status,
      },
      { onConflict: "document_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Listet eigene PDFs, für die noch kein Volltext gespeichert ist. */
export const listUnindexedDocuments = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 50), 1), 200),
  }))
  .handler(async ({ data, context }) => {
    const page = 1000;
    const indexed = new Set<string>();
    for (let from = 0; ; from += page) {
      const { data: rows, error } = await context.supabase
        .from("document_text")
        .select("document_id")
        .eq("user_id", context.userId)
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) indexed.add(r.document_id);
      if ((rows ?? []).length < page) break;
    }

    const pending: { id: string; name: string; storage_path: string }[] = [];
    let total = 0;
    for (let from = 0; ; from += page) {
      const { data: rows, error } = await context.supabase
        .from("documents")
        .select("id,name,storage_path,mime_type")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        const isPdf =
          r.mime_type === "application/pdf" || r.name.toLowerCase().endsWith(".pdf");
        if (!isPdf || indexed.has(r.id) || !r.storage_path) continue;
        total += 1;
        if (pending.length < data.limit) {
          pending.push({ id: r.id, name: r.name, storage_path: r.storage_path });
        }
      }
      if ((rows ?? []).length < page) break;
    }

    return { pending, total };
  });
