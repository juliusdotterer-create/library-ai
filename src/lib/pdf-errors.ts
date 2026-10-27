/** Classifies PDF.js load errors so viewers can show a helpful message. */
export type PdfFailure = "password" | "wrong-password" | "drm" | "corrupt" | "error";

export function classifyPdfError(error: unknown): PdfFailure {
  const e = error as { name?: string; code?: number; message?: string } | null;
  const name = e?.name ?? "";
  const msg = (e?.message ?? "").toLowerCase();
  if (name === "PasswordException") return e?.code === 2 ? "wrong-password" : "password";
  if (/ebx_handler|adept|unsupported.*(encrypt|security)|unknown.*(filter|crypt)/.test(msg)) return "drm";
  if (name === "InvalidPDFException" || name === "MissingPDFException" || /invalid pdf/.test(msg)) return "corrupt";
  return "error";
}

export const PDF_FAILURE_TEXT: Record<Exclude<PdfFailure, "password" | "wrong-password">, string> = {
  drm: "Diese Datei ist kopiergeschützt (DRM). Bitte in Adobe Digital Editions oder der App deiner Bibliothek öffnen.",
  corrupt: "Die Datei ist beschädigt oder unvollständig.",
  error: "PDF konnte nicht angezeigt werden.",
};

const LOCK_KEY = "doc-locked:";
export function markLocked(id: string | undefined, kind: "password" | "drm") {
  if (!id || typeof window === "undefined") return;
  try { localStorage.setItem(LOCK_KEY + id, kind); window.dispatchEvent(new Event("doc-locked")); } catch { /* ignore */ }
}
export function readLocked(id: string): string | null {
  try { return localStorage.getItem(LOCK_KEY + id); } catch { return null; }
}

/** Detects DRM tickets/containers by file name. */
export function isDrmFileName(name: string) {
  return /\.acsm$/i.test(name);
}
