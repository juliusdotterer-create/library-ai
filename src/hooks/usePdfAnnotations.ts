import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Stroke = {
  id: string;
  kind: "stroke";
  page: number;
  tool: "marker" | "pen";
  color: string;
  width: number;
  pts: [number, number][];
};

export type Note = {
  id: string;
  kind: "note";
  page: number;
  x: number;
  y: number;
  text: string;
};

export type Anno = Stroke | Note;

export const annoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Lädt, speichert und versioniert die Annotationen eines Dokuments.
 * Das Zeichnen selbst bleibt im Canvas-Layer der Komponente.
 */
export function usePdfAnnotations(documentId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [annos, setAnnos] = useState<Anno[]>([]);
  const [past, setPast] = useState<Anno[][]>([]);
  const [future, setFuture] = useState<Anno[][]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setAnnos([]);
    setPast([]);
    setFuture([]);
    void (async () => {
      const { data } = await supabase
        .from("document_annotations")
        .select("data")
        .eq("document_id", documentId)
        .maybeSingle();
      if (cancelled) return;
      const list = Array.isArray(data?.data) ? (data.data as unknown as Anno[]) : [];
      setAnnos(list);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      void (async () => {
        if (!userId) return;
        await supabase
          .from("document_annotations")
          .upsert(
            { user_id: userId, document_id: documentId, data: annos as never },
            { onConflict: "user_id,document_id" },
          );
      })();
    }, 900);
    return () => clearTimeout(t);
  }, [annos, loaded, documentId, userId]);

  const commit = (next: Anno[]) => {
    setPast((p) => [...p.slice(-49), annos]);
    setFuture([]);
    setAnnos(next);
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1]!;
      setFuture((f) => [annos, ...f].slice(0, 50));
      setAnnos(prev);
      return p.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0]!;
      setPast((p) => [...p, annos]);
      setAnnos(next);
      return f.slice(1);
    });
  };

  return {
    annos,
    setAnnos,
    commit,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
