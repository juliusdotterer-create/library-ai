import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { isDrmFileName, readLocked } from "@/lib/pdf-errors";

/** Schloss-Symbol für Dokumente, die als passwort- oder kopiergeschützt erkannt wurden (gerätelokal). */
export function LockedBadge({ id, name }: { id: string; name: string }) {
  const [kind, setKind] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setKind(isDrmFileName(name) ? "drm" : readLocked(id));
    read();
    window.addEventListener("doc-locked", read);
    return () => window.removeEventListener("doc-locked", read);
  }, [id, name]);
  if (!kind) return null;
  return (
    <Lock
      className="ml-1 inline size-3 align-[-1px] text-muted-foreground"
      aria-label={kind === "drm" ? "Kopiergeschützt" : "Passwortgeschützt"}
    />
  );
}
