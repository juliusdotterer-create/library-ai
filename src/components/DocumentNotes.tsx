import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Pen,
  Plus,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HandwritingCanvas, type Stroke } from "@/components/HandwritingCanvas";
import { downloadBlob, notesToPdfBlob } from "@/lib/notes-pdf";

type Page = { id: string; position: number; strokes: Stroke[]; text: string };

const asStrokes = (raw: unknown): Stroke[] => (Array.isArray(raw) ? (raw as Stroke[]) : []);

const stamp = () =>
  new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });


/**
 * Handschriftliche Notizen zu einem Library-Dokument.
 * Ein Notizbuch pro Dokument, mehrere Seiten, Vektor-Striche, Auto-Speichern.
 */
export function DocumentNotes({
  documentId,
  folderId,
  notebookId: fixedNotebookId,
  saveFolderId,
  suggestedName,
}: {
  documentId?: string | null;
  folderId?: string | null;
  /** Direkt zu ladendes Notizbuch (gespeicherte Notiz aus der Library). */
  notebookId?: string | null;
  /** Zielordner, in dem die Notiz als Library-Eintrag gespeichert wird. */
  saveFolderId?: string | null;
  suggestedName?: string;
}) {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [mode, setMode] = useState<"draw" | "text">("draw");
  const dirty = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIndex(0);
    // Wichtig: Zustand des vorherigen Dokuments verwerfen, damit keine
    // fremden Seiten/Striche sichtbar bleiben oder überschrieben werden.
    setPages([]);
    setNotebookId(null);
    setSavedDocId(null);
    dirty.current.clear();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      let nb: { id: string } | null = fixedNotebookId ? { id: fixedNotebookId } : null;

      if (!nb) {
        let base = supabase
          .from("notebooks")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(10);

        if (documentId) {
          base = base.eq("document_id", documentId);
        } else {
          base = base.is("document_id", null);
          base = folderId ? base.eq("folder_id", folderId) : base.is("folder_id", null);
        }

        const { data: found } = await base;

        // Ältere Lade-Rennen konnten mehrere Notizbücher für dasselbe Dokument
        // erzeugen. Bevorzuge das tatsächlich befüllte Buch statt eines leeren
        // Duplikats, damit niemals Seiten einer falschen Instanz erscheinen.
        nb = found?.[0] ?? null;
        if ((found?.length ?? 0) > 1) {
          const ids = found?.map((item) => item.id) ?? [];
          const { data: candidatePages } = await supabase
            .from("notebook_pages")
            .select("notebook_id, strokes, updated_at")
            .in("notebook_id", ids);
          const score = new Map<string, number>();
          for (const page of candidatePages ?? []) {
            const strokeCount = Array.isArray(page.strokes) ? page.strokes.length : 0;
            score.set(page.notebook_id, (score.get(page.notebook_id) ?? 0) + 1 + strokeCount * 1000);
          }
          nb =
            [...(found ?? [])].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))[0] ??
            null;
        }
      }

      if (!nb) {
        const created = await supabase
          .from("notebooks")
          .insert({
            user_id: userId,
            document_id: documentId ?? null,
            folder_id: documentId ? null : folderId ?? null,
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
        .select("id, position, strokes, text")
        .eq("notebook_id", nb.id)
        .order("position", { ascending: true });

      let list: Page[] = (rows ?? []).map((r) => ({
        id: r.id,
        position: r.position,
        strokes: asStrokes(r.strokes),
        text: r.text ?? "",
      }));

      if (!list.length) {
        const first = await supabase
          .from("notebook_pages")
          .insert({ user_id: userId, notebook_id: nb.id, position: 0, strokes: [] })
          .select("id, position, strokes, text")
          .single();
        if (first.data)
          list = [{ id: first.data.id, position: first.data.position, strokes: [], text: "" }];
      }


      // Ist diese Notiz bereits als Library-Eintrag gespeichert?
      const { data: linked } = await supabase
        .from("documents")
        .select("id")
        .eq("notebook_id", nb.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (cancelled) return;
      setNotebookId(nb.id);
      setSavedDocId(linked?.id ?? null);
      setPages(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, folderId, fixedNotebookId]);

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
            .update({ strokes: page.strokes as unknown as never, text: page.text })
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

  const updateText = useCallback(
    (next: string) => {
      if (!current) return;
      dirty.current.add(current.id);
      setPages((prev) => prev.map((p) => (p.id === current.id ? { ...p, text: next } : p)));
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
    setPages((prev) => [...prev, { id: data.id, position: data.position, strokes: [], text: "" }]);
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

  const defaultName = suggestedName ?? `Notiz ${stamp()}`;

  /** Notiz als eigenen Library-Eintrag anlegen bzw. umbenennen. */
  const saveAsNote = async (name: string) => {
    if (!notebookId) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      if (savedDocId) {
        const { error } = await supabase.from("documents").update({ name }).eq("id", savedDocId);
        if (error) throw error;
        toast.success("Notiz aktualisiert");
      } else {
        const { data, error } = await supabase
          .from("documents")
          .insert({
            user_id: userId,
            folder_id: saveFolderId ?? null,
            notebook_id: notebookId,
            name,
            kind: "note",
            storage_path: "",
            mime_type: null,
          })
          .select("id")
          .single();
        if (error) throw error;
        setSavedDocId(data.id);
        toast.success("Notiz in der Library gespeichert");
      }
      await supabase.from("notebooks").update({ title: name }).eq("id", notebookId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
      setNameDialog(null);
    }
  };

  const exportPdf = async (toLibrary: boolean) => {
    setBusy(true);
    try {
      const blob = await notesToPdfBlob(pages.map((p) => ({ strokes: p.strokes, text: p.text })));
      const filename = `${defaultName}.pdf`;
      if (!toLibrary) {
        downloadBlob(blob, filename);
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const storagePath = `${userId}/${crypto.randomUUID()}-notiz.pdf`;
      const up = await supabase.storage
        .from("documents")
        .upload(storagePath, blob, { contentType: "application/pdf" });
      if (up.error) throw up.error;
      const { error } = await supabase.from("documents").insert({
        user_id: userId,
        folder_id: saveFolderId ?? null,
        name: filename,
        storage_path: storagePath,
        mime_type: "application/pdf",
        size_bytes: blob.size,
      });
      if (error) throw error;
      toast.success("PDF in der Library gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen");
    } finally {
      setBusy(false);
    }
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

        <Button
          size="icon"
          variant={savedDocId ? "secondary" : "default"}
          className="rounded-2xl"
          disabled={busy || !notebookId}
          title={savedDocId ? "Notiz umbenennen" : "Als Notiz in der Library speichern"}
          onClick={() => setNameDialog(defaultName)}
        >
          <Save className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Als PDF exportieren"
          disabled={busy}
          onClick={() => setExportOpen(true)}
        >
          <FileDown className="size-4" />
        </Button>

        <div className="ml-2 flex items-center gap-0.5 rounded-2xl bg-muted/60 p-0.5">
          <Button
            size="icon"
            variant={mode === "draw" ? "default" : "ghost"}
            className="size-7 rounded-2xl"
            title="Handschrift"
            onClick={() => setMode("draw")}
          >
            <Pen className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant={mode === "text" ? "default" : "ghost"}
            className="size-7 rounded-2xl"
            title="Fließtext"
            onClick={() => setMode("text")}
          >
            <Type className="size-3.5" />
          </Button>
        </div>

        <span className="ml-auto text-[11px] text-muted-foreground">
          {busy ? "Arbeitet…" : saving ? "Speichert…" : "Automatisch gespeichert"}
        </span>
      </div>

      {current &&
        (mode === "text" ? (
          <Textarea
            key={`${current.id}-text`}
            value={current.text}
            onChange={(e) => updateText(e.target.value)}
            placeholder="Fließtext schreiben…"
            className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent p-4 text-sm leading-relaxed focus-visible:ring-0"
          />
        ) : (
          <HandwritingCanvas
            key={current.id}
            strokes={current.strokes}
            onChange={updateStrokes}
            className="min-h-0 flex-1"
          />
        ))}

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="glass rounded-3xl">
          <DialogHeader>
            <DialogTitle>Als PDF exportieren</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              className="justify-start rounded-2xl"
              disabled={busy}
              onClick={() => {
                setExportOpen(false);
                void exportPdf(false);
              }}
            >
              <Download className="size-4" /> PDF herunterladen
            </Button>
            <Button
              variant="secondary"
              className="justify-start rounded-2xl"
              disabled={busy}
              onClick={() => {
                setExportOpen(false);
                void exportPdf(true);
              }}
            >
              <FileDown className="size-4" /> PDF in Library speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={nameDialog !== null} onOpenChange={(o) => !o && setNameDialog(null)}>
        <DialogContent className="glass rounded-3xl">
          <DialogHeader>
            <DialogTitle>{savedDocId ? "Notiz umbenennen" : "Notiz speichern"}</DialogTitle>
          </DialogHeader>
          <Input
            className="rounded-2xl"
            value={nameDialog ?? ""}
            onChange={(e) => setNameDialog(e.target.value)}
            placeholder="Name der Notiz"
          />
          <DialogFooter>
            <Button
              className="rounded-2xl"
              disabled={busy || !nameDialog?.trim()}
              onClick={() => nameDialog && void saveAsNote(nameDialog.trim())}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
