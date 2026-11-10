/**
 * Volltext-Index der eigenständigen Demo: speichert extrahierten PDF-Text
 * lokal in der Tabelle `document_text` und liefert die Kennzahlen bzw.
 * Arbeitslisten für den Index-Runner. Gleiche Aufrufform wie früher
 * (`fn({ data })`), aber ohne Server.
 */
import { supabase } from "@/integrations/supabase/client";
import { LOCAL_USER_ID } from "@/integrations/local/db";

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

/** Ab wie vielen Fehlversuchen ein Dokument nicht mehr erneut verarbeitet wird. */
export const MAX_ATTEMPTS = 3;

type DocRow = { id: string; name: string; storage_path: string; mime_type: string | null; source: string };
type TextRow = { document_id: string; status: string; attempts: number | null; source: string | null };

const isPdf = (d: { name: string; mime_type: string | null }) =>
  d.mime_type === "application/pdf" || d.name.toLowerCase().endsWith(".pdf");

async function liveDocs(): Promise<DocRow[]> {
  const { data } = await supabase
    .from("documents")
    .select("id,name,storage_path,mime_type,source")
    .eq("user_id", LOCAL_USER_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as DocRow[];
}

async function textRows(): Promise<TextRow[]> {
  const { data } = await supabase.from("document_text").select("document_id,status,attempts,source");
  return (data ?? []) as TextRow[];
}

/** Speichert den extrahierten Text eines Dokuments für die Volltextsuche. */
export async function saveDocumentText({ data: input }: { data: SavePayload }) {
  const { data: existing } = await supabase
    .from("document_text")
    .select("attempts")
    .eq("document_id", input.documentId)
    .maybeSingle();
  const attempts = ((existing as { attempts?: number } | null)?.attempts ?? 0) + 1;
  const { error } = await supabase.from("document_text").upsert(
    {
      user_id: LOCAL_USER_ID,
      document_id: input.documentId,
      content: String(input.content ?? "").slice(0, MAX_CHARS),
      pages: (input.pages ?? []).map((p) => String(p ?? "")),
      page_count: Math.max(0, Math.trunc(input.pageCount || 0)),
      status: input.status,
      source: input.source === "ocr" ? "ocr" : "text",
      error: input.error ? String(input.error).slice(0, 500) : null,
      attempts,
    },
    { onConflict: "document_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Kennzahlen für die Statusanzeige des Volltext-Index. */
export async function getIndexStats() {
  const [docs, texts] = await Promise.all([liveDocs(), textRows()]);
  const pdfs = docs.filter(isPdf).length;
  const count = (status?: string) => texts.filter((t) => !status || t.status === status).length;
  const indexed = count();
  return {
    pdfs,
    indexed,
    done: count("done"),
    unsupported: count("unsupported"),
    failed: count("failed"),
    pending: Math.max(pdfs - indexed, 0),
  };
}

/** Listet PDFs, für die noch kein Volltext gespeichert ist. */
export async function listUnindexedDocuments({ data: input }: { data?: { limit?: number; onlyFailed?: boolean } } = {}) {
  const limit = Math.min(Math.max(Number(input?.limit ?? 50), 1), 200);
  const onlyFailed = Boolean(input?.onlyFailed);
  const [docs, texts] = await Promise.all([liveDocs(), textRows()]);
  const indexed = new Set<string>();
  const retry = new Set<string>();
  for (const t of texts) {
    if (t.status === "failed" && (t.attempts ?? 0) < MAX_ATTEMPTS) retry.add(t.document_id);
    else indexed.add(t.document_id);
  }
  const all = docs.filter(
    (d) =>
      isPdf(d) &&
      !!d.storage_path &&
      (onlyFailed ? retry.has(d.id) : !indexed.has(d.id)),
  );
  return {
    pending: all.slice(0, limit).map((d) => ({ id: d.id, name: d.name, storage_path: d.storage_path, source: d.source })),
    total: all.length,
  };
}

/** Listet gescannte PDFs ohne Textebene, die per Texterkennung gelesen werden können. */
export async function listOcrCandidates({ data: input }: { data?: { limit?: number } } = {}) {
  const limit = Math.min(Math.max(Number(input?.limit ?? 25), 1), 100);
  const [docs, texts] = await Promise.all([liveDocs(), textRows()]);
  const ids = texts
    .filter((t) => t.status === "unsupported" && t.source !== "ocr" && (t.attempts ?? 0) < MAX_ATTEMPTS)
    .map((t) => t.document_id);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const pending = ids
    .slice(0, limit)
    .map((id) => byId.get(id))
    .filter((d): d is DocRow => !!d && !!d.storage_path)
    .map((d) => ({ id: d.id, name: d.name, storage_path: d.storage_path, source: d.source }));
  return { pending, total: ids.length };
}
