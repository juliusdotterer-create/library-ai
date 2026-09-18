import { createServerFn } from "@tanstack/react-start";
import { requireWhitelisted } from "@/lib/require-whitelist";

type SavePayload = {
  documentId: string;
  content: string;
  pages: string[];
  pageCount: number;
  status: "done" | "unsupported" | "failed";
  source?: "text" | "ocr";
  error?: string | null;
};

const MAX_CHARS = 400_000;
const PDF_FILTER = "mime_type.eq.application/pdf,name.ilike.%.pdf";

/** Ab wie vielen Fehlversuchen ein Dokument nicht mehr erneut verarbeitet wird. */
export const MAX_ATTEMPTS = 3;

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
      source: input?.source === "ocr" ? ("ocr" as const) : ("text" as const),
      error: input?.error ? String(input.error).slice(0, 500) : null,
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

    const { data: existing } = await context.supabase
      .from("document_text")
      .select("attempts")
      .eq("document_id", data.documentId)
      .maybeSingle();

    const attempts =
      (typeof (existing as { attempts?: number } | null)?.attempts === "number"
        ? (existing as { attempts: number }).attempts
        : 0) + 1;

    const { error } = await context.supabase.from("document_text").upsert(
      {
        user_id: context.userId,
        document_id: data.documentId,
        content: data.content,
        pages: data.pages,
        page_count: data.pageCount,
        status: data.status,
        source: data.source,
        error: data.error,
        attempts,
      },
      { onConflict: "document_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kennzahlen für die Statusanzeige des Volltext-Index. */
export const getIndexStats = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .handler(async ({ context }) => {
    const countDocs = async () => {
      const { count, error } = await context.supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .or(PDF_FILTER);
      if (error) throw new Error(error.message);
      return count ?? 0;
    };

    const countText = async (status?: string) => {
      let q = context.supabase
        .from("document_text")
        .select("document_id", { count: "exact", head: true })
        .eq("user_id", context.userId);
      if (status) q = q.eq("status", status);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    };

    const [pdfs, indexed, done, unsupported, failed] = await Promise.all([
      countDocs(),
      countText(),
      countText("done"),
      countText("unsupported"),
      countText("failed"),
    ]);

    return {
      pdfs,
      indexed,
      done,
      unsupported,
      failed,
      pending: Math.max(pdfs - indexed, 0),
    };
  });

/** Listet eigene PDFs, für die noch kein Volltext gespeichert ist. */
export const listUnindexedDocuments = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { limit?: number; onlyFailed?: boolean } | undefined) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 50), 1), 200),
    onlyFailed: Boolean(input?.onlyFailed),
  }))
  .handler(async ({ data, context }) => {
    const page = 1000;
    const indexed = new Set<string>();
    const retry = new Set<string>();
    for (let from = 0; ; from += page) {
      const { data: rows, error } = await context.supabase
        .from("document_text")
        .select("document_id,status,attempts")
        .eq("user_id", context.userId)
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        const row = r as { document_id: string; status: string; attempts: number | null };
        if (row.status === "failed" && (row.attempts ?? 0) < MAX_ATTEMPTS) {
          retry.add(row.document_id);
        } else {
          indexed.add(row.document_id);
        }
      }
      if ((rows ?? []).length < page) break;
    }

    const pending: { id: string; name: string; storage_path: string; source: string }[] = [];
    let total = 0;
    for (let from = 0; ; from += page) {
      const { data: rows, error } = await context.supabase
        .from("documents")
        .select("id,name,storage_path,mime_type,source")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        const isPdf = r.mime_type === "application/pdf" || r.name.toLowerCase().endsWith(".pdf");
        // Lokale Dateien brauchen einen Speicherpfad; Drive-Dateien laden wir per ID.
        if (!isPdf || (!r.storage_path && r.source !== "gdrive")) continue;
        const isRetry = retry.has(r.id);
        if (data.onlyFailed && !isRetry) continue;
        if (!data.onlyFailed && indexed.has(r.id)) continue;
        total += 1;
        if (pending.length < data.limit) {
          pending.push({ id: r.id, name: r.name, storage_path: r.storage_path, source: r.source });
        }
      }
      if ((rows ?? []).length < page) break;
    }

    return { pending, total };
  });

/** Listet gescannte PDFs ohne Textebene, die per Texterkennung gelesen werden können. */
export const listOcrCandidates = createServerFn({ method: "POST" })
  .middleware([requireWhitelisted])
  .inputValidator((input: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 25), 1), 100),
  }))
  .handler(async ({ data, context }) => {
    const page = 1000;
    const ids: string[] = [];
    for (let from = 0; ; from += page) {
      const { data: rows, error } = await context.supabase
        .from("document_text")
        .select("document_id,attempts,source")
        .eq("user_id", context.userId)
        .eq("status", "unsupported")
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        const row = r as { document_id: string; attempts: number | null; source: string | null };
        // Nach OCR-Versuch nicht erneut probieren.
        if (row.source === "ocr") continue;
        if ((row.attempts ?? 0) >= MAX_ATTEMPTS) continue;
        ids.push(row.document_id);
      }
      if ((rows ?? []).length < page) break;
    }

    const total = ids.length;
    const slice = ids.slice(0, data.limit);
    if (!slice.length) return { pending: [], total };

    const { data: docs, error } = await context.supabase
      .from("documents")
      .select("id,name,storage_path,source")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .in("id", slice);
    if (error) throw new Error(error.message);

    return {
      pending: (docs ?? [])
        .filter((d) => Boolean(d.storage_path) || d.source === "gdrive")
        .map((d) => ({ id: d.id, name: d.name, storage_path: d.storage_path, source: d.source })),
      total,
    };
  });
