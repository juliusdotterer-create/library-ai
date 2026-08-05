import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HandwritingCanvas, type Stroke } from "@/components/HandwritingCanvas";

type Page = { id: string; position: number; strokes: Stroke[] };

const asStrokes = (raw: unknown): Stroke[] => (Array.isArray(raw) ? (raw as Stroke[]) : []);

/**
 * Handschriftliche Notizen zu einem Library-Dokument.
 * Ein Notizbuch pro Dokument, mehrere Seiten, Vektor-Striche, Auto-Speichern.
 */
export function DocumentNotes({ documentId }: { documentId?: string | null }) {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dirty = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIndex(0);
    dirty.current.clear();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const base = supabase
        .from("notebooks")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);

      let { data: nb } = await (documentId
        ? base.eq("document_id", documentId)
        : base.is("document_id", null)
      ).maybeSingle();

      if (!nb) {
        const created = await supabase
          .from("notebooks")
          .insert({
            user_id: userId,
            document_id: documentId ?? null,
            title: documentId ? "Notizen" : "Freie Notizen",
          })
          .select("id")
          .single();
        if (created.error) {
          toast.error("Notizen konnten nicht geladen werden");
          if (!cancelled) setLoading(false);
          return;
        }
        nb = created.data;
      }
      if (cancelled || !nb) return;

      const { data: rows } = await supabase
        .from("notebook_pages")
        .select("id, position, strokes")
        .eq("notebook_id", nb.id)
        .order("position", { ascending: true });

      let list: Page[] = (rows ?? []).map((r) => ({
        id: r.id,
        position: r.position,
        strokes: asStrokes(r.strokes),
      }));

      if (!list.length) {
        const first = await supabase
          .from("notebook_pages")
          .insert({ user_id: userId, notebook_id: nb.id, position: 0, strokes: [] })
          .select("id, position, strokes")
          .single();
        if (first.data)
          list = [{ id: first.data.id, position: first.data.position, strokes: [] }];
      }
      if (cancelled) return;
      setNotebookId(nb.id);
      setPages(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const current = pages[index];

  // debounced autosave der veränderten Seiten
  useEffect(() => {
    if (!dirty.current.size) return;
    const t = setTimeout(() => {
      const ids = [...dirty.current];
      dirty.current.clear();
      void (async () => {
        setSaving(true);
        for (const id of ids) {
          const page = pages.find((p) => p.id === id);
          if (!page) continue;
          const { error } = await supabase
            .from("notebook_pages")
            .update({ strokes: page.strokes as unknown as never })
            .eq("id", id);
          if (error) toast.error("Notiz konnte nicht gespeichert werden");
        }
        setSaving(false);
      })();
    }, 800);
    return () => clearTimeout(t);
  }, [pages]);

  const updateStrokes = useCallback(
    (next: Stroke[]) => {
      if (!current) return;
      dirty.current.add(current.id);
      setPages((prev) => prev.map((p) => (p.id === current.id ? { ...p, strokes: next } : p)));
    },
    [current],
  );

  const addPage = async () => {
    if (!notebookId) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const position = pages.length;
    const { data, error } = await supabase
      .from("notebook_pages")
      .insert({ user_id: userId, notebook_id: notebookId, position, strokes: [] })
      .select("id, position")
      .single();
    if (error || !data) {
      toast.error("Seite konnte nicht angelegt werden");
      return;
    }
    setPages((prev) => [...prev, { id: data.id, position: data.position, strokes: [] }]);
    setIndex(position);
  };

  const deletePage = async () => {
    if (!current || pages.length < 2) return;
    const id = current.id;
    dirty.current.delete(id);
    setPages((prev) => prev.filter((p) => p.id !== id));
    setIndex((i) => Math.max(0, i - 1));
    const { error } = await supabase.from("notebook_pages").delete().eq("id", id);
    if (error) toast.error("Seite konnte nicht gelöscht werden");
  };

  if (loading)
    return (
      <div className="flex size-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Notizen werden geladen…</p>
      </div>
    );

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Notizen</span>
        <Button
          size="icon"
          variant="ghost"
          className="ml-1 rounded-2xl"
          title="Vorherige Seite"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {index + 1}/{pages.length}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Nächste Seite"
          disabled={index >= pages.length - 1}
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Seite hinzufügen"
          onClick={() => void addPage()}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Seite löschen"
          disabled={pages.length < 2}
          onClick={() => void deletePage()}
        >
          <Trash2 className="size-4" />
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {saving ? "Speichert…" : "Automatisch gespeichert"}
        </span>
      </div>

      {current && (
        <HandwritingCanvas
          key={current.id}
          strokes={current.strokes}
          onChange={updateStrokes}
          className="min-h-0 flex-1"
        />
      )}
    </div>
  );
}
