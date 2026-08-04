import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  NotebookPen,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HandwritingCanvas, StrokePreview, type Stroke } from "@/components/HandwritingCanvas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notizen")({
  validateSearch: (search: Record<string, unknown>) => ({
    nb: typeof search.nb === "string" ? search.nb : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Notizen – handschriftliche Notizbücher" },
      {
        name: "description",
        content:
          "Handschriftliche Notizbücher mit Apple Pencil: Stift, Textmarker, Radierer und mehrere Seiten.",
      },
      { property: "og:title", content: "Notizen – handschriftliche Notizbücher" },
      {
        property: "og:description",
        content: "Schreibe handschriftlich auf digitalen Seiten und verknüpfe sie mit Dokumenten.",
      },
    ],
  }),
  component: NotesPage,
});

type Notebook = {
  id: string;
  title: string;
  document_id: string | null;
  updated_at: string;
};
type Page = { id: string; position: number; strokes: unknown };

const asStrokes = (raw: unknown): Stroke[] => (Array.isArray(raw) ? (raw as Stroke[]) : []);

function NotesPage() {
  const { nb } = Route.useSearch();
  const navigate = Route.useNavigate();
  const open = (id: string | undefined) =>
    void navigate({ search: id ? { nb: id } : {}, replace: !!id });
  return nb ? (
    <NotebookEditor id={nb} onBack={() => open(undefined)} />
  ) : (
    <NotebookList onOpen={(id) => open(id)} />
  );
}

/* ------------------------------- Übersicht ------------------------------- */

function NotebookList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [del, setDel] = useState<{ id: string; title: string } | null>(null);

  const books = useQuery({
    queryKey: ["notebooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notebooks")
        .select("id,title,document_id,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Notebook[];
    },
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user!.id;
      const { data, error } = await supabase
        .from("notebooks")
        .insert({ user_id: uid, title: name })
        .select("id")
        .single();
      if (error) throw error;
      const { error: pErr } = await supabase
        .from("notebook_pages")
        .insert({ user_id: uid, notebook_id: data.id, position: 0, strokes: [] });
      if (pErr) throw pErr;
      return data.id as string;
    },
    onSuccess: (id) => {
      setTitle("");
      void qc.invalidateQueries({ queryKey: ["notebooks"] });
      onOpen(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notebooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDel(null);
      void qc.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Notizbuch gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-2 rounded-3xl p-4">
        <span className="bg-primary-soft flex size-10 items-center justify-center rounded-2xl">
          <NotebookPen className="size-5 text-primary" />
        </span>
        <h1 className="flex-1 text-lg font-semibold">Notizen</h1>
        <Input
          value={title}
          placeholder="Neues Notizbuch"
          className="h-9 w-52 rounded-2xl"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) create.mutate(title.trim());
          }}
        />
        <Button
          className="rounded-2xl"
          disabled={!title.trim() || create.isPending}
          onClick={() => create.mutate(title.trim())}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Anlegen</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books.data?.map((b) => (
          <div key={b.id} className="glass flex items-center gap-3 rounded-3xl p-4">
            <button
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => onOpen(b.id)}
            >
              <span className="bg-primary-soft flex size-10 items-center justify-center rounded-2xl">
                <NotebookPen className="size-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{b.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(b.updated_at).toLocaleDateString("de-DE")}
                  {b.document_id ? " · verknüpft" : ""}
                </span>
              </span>
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-2xl text-destructive"
              title="Löschen"
              onClick={() => setDel({ id: b.id, title: b.title })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {!books.isLoading && !books.data?.length && (
          <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
            Noch keine Notizbücher. Lege oben eines an.
          </p>
        )}
      </div>

      <ConfirmDelete
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        name={del?.title ?? ""}
        title="Notizbuch löschen"
        description={`„${del?.title}“ wird mit allen Seiten endgültig gelöscht.`}
        confirmLabel="Löschen"
        onConfirm={async () => {
          if (del) await remove.mutateAsync(del.id);
        }}
      />
    </div>
  );
}

/* -------------------------------- Editor -------------------------------- */

function NotebookEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const skip = useRef(true);

  const book = useQuery({
    queryKey: ["notebook", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notebooks")
        .select("id,title,document_id,updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Notebook | null;
    },
  });

  const pages = useQuery({
    queryKey: ["notebook-pages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notebook_pages")
        .select("id,position,strokes")
        .eq("notebook_id", id)
        .order("position");
      if (error) throw error;
      return data as Page[];
    },
  });

  const linkedDoc = useQuery({
    queryKey: ["notebook-doc", book.data?.document_id],
    enabled: !!book.data?.document_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id,name")
        .eq("id", book.data!.document_id!)
        .maybeSingle();
      return data;
    },
  });

  const list = pages.data ?? [];
  const page = list[Math.min(index, Math.max(list.length - 1, 0))];

  useEffect(() => {
    if (!page) return;
    skip.current = true;
    setStrokes(asStrokes(page.strokes));
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave (debounced)
  useEffect(() => {
    if (!page) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("notebook_pages")
        .update({ strokes: strokes as unknown as never })
        .eq("id", page.id);
      setSaving(false);
      if (error) toast.error("Seite konnte nicht gespeichert werden");
      else
        qc.setQueryData<Page[]>(["notebook-pages", id], (prev) =>
          prev?.map((p) => (p.id === page.id ? { ...p, strokes } : p)),
        );
    }, 800);
    return () => clearTimeout(t);
  }, [strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPage = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const pos = (list[list.length - 1]?.position ?? -1) + 1;
      const { error } = await supabase
        .from("notebook_pages")
        .insert({ user_id: auth.user!.id, notebook_id: id, position: pos, strokes: [] });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notebook-pages", id] });
      setIndex(list.length);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePage = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await supabase.from("notebook_pages").delete().eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setIndex((i) => Math.max(0, i - 1));
      await qc.invalidateQueries({ queryKey: ["notebook-pages", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const movePage = useMutation({
    mutationFn: async (dir: -1 | 1) => {
      const a = list[index];
      const b = list[index + dir];
      if (!a || !b) return;
      await supabase.from("notebook_pages").update({ position: b.position }).eq("id", a.id);
      await supabase.from("notebook_pages").update({ position: a.position }).eq("id", b.id);
      setIndex(index + dir);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notebook-pages", id] }),
  });

  const renameBook = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from("notebooks").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notebook", id] });
      void qc.invalidateQueries({ queryKey: ["notebooks"] });
    },
  });

  const setLink = useMutation({
    mutationFn: async (documentId: string | null) => {
      const { error } = await supabase.from("notebooks").update({ document_id: documentId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setLinkOpen(false);
      void qc.invalidateQueries({ queryKey: ["notebook", id] });
      void qc.invalidateQueries({ queryKey: ["notebooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-0 flex-col gap-3">
      <div className="glass flex flex-wrap items-center gap-2 rounded-3xl px-3 py-2">
        <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onBack} title="Zurück">
          <ArrowLeft className="size-4" />
        </Button>
        <Input
          value={book.data?.title ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            qc.setQueryData<Notebook | null>(["notebook", id], (p) => (p ? { ...p, title: v } : p));
          }}
          onBlur={(e) => renameBook.mutate(e.target.value.trim() || "Notizbuch")}
          className="h-9 w-48 rounded-2xl border-transparent bg-transparent font-semibold"
        />
        <Button
          variant={book.data?.document_id ? "default" : "secondary"}
          size="sm"
          className="rounded-2xl"
          onClick={() => setLinkOpen(true)}
          title="Mit Dokument verknüpfen"
        >
          <Link2 className="size-4" />
          <span className="hidden max-w-40 truncate sm:inline">
            {linkedDoc.data?.name ?? "Verknüpfen"}
          </span>
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {saving ? "Speichert…" : "Automatisch gespeichert"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="hidden w-28 shrink-0 space-y-2 overflow-y-auto pr-1 md:block">
          {list.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              className={cn(
                "block w-full rounded-xl border p-1 transition",
                i === index ? "border-primary ring-2 ring-primary/40" : "border-border",
              )}
            >
              <StrokePreview strokes={i === index ? strokes : asStrokes(p.strokes)} />
              <span className="block pt-1 text-[11px] text-muted-foreground">Seite {i + 1}</span>
            </button>
          ))}
          <Button
            variant="secondary"
            className="w-full rounded-2xl"
            onClick={() => addPage.mutate()}
            title="Seite hinzufügen"
          >
            <Plus className="size-4" />
          </Button>
        </aside>

        <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl p-0">
          {page ? (
            <HandwritingCanvas strokes={strokes} onChange={setStrokes} className="flex-1" />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <Button className="rounded-2xl" onClick={() => addPage.mutate()}>
                <Plus className="size-4" /> Erste Seite anlegen
              </Button>
            </div>
          )}

          {page && (
            <div className="flex items-center gap-1 border-t border-border/50 px-2 py-1.5">
              <Button
                size="icon"
                variant="ghost"
                className="rounded-2xl"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
                title="Vorherige Seite"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Seite {index + 1} / {list.length}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-2xl"
                disabled={index >= list.length - 1}
                onClick={() => setIndex((i) => i + 1)}
                title="Nächste Seite"
              >
                <ChevronRight className="size-4" />
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-2xl"
                  disabled={index === 0}
                  onClick={() => movePage.mutate(-1)}
                  title="Seite nach vorne"
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-2xl"
                  disabled={index >= list.length - 1}
                  onClick={() => movePage.mutate(1)}
                  title="Seite nach hinten"
                >
                  ↓
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => addPage.mutate()}
                  title="Seite hinzufügen"
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-2xl text-destructive"
                  disabled={list.length <= 1}
                  onClick={() => deletePage.mutate(page.id)}
                  title="Seite löschen"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DocumentLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        current={book.data?.document_id ?? null}
        onPick={(docId) => setLink.mutate(docId)}
      />
    </div>
  );
}

/* --------------------------- Dokument verknüpfen -------------------------- */

function DocumentLinkDialog({
  open,
  onOpenChange,
  current,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: string | null;
  onPick: (id: string | null) => void;
}) {
  const [term, setTerm] = useState("");
  const docs = useQuery({
    queryKey: ["link-documents"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,name")
        .is("deleted_at", null)
        .order("name")
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const all = docs.data ?? [];
    return (q ? all.filter((d) => d.name.toLowerCase().includes(q)) : all).slice(0, 60);
  }, [docs.data, term]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[80vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Mit Dokument verknüpfen</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Dokument suchen…"
          className="rounded-2xl"
        />
        {current && (
          <Button variant="secondary" className="rounded-2xl" onClick={() => onPick(null)}>
            <X className="size-4" /> Verknüpfung entfernen
          </Button>
        )}
        <div className="space-y-1.5">
          {filtered.map((d) => (
            <button
              key={d.id}
              onClick={() => onPick(d.id)}
              className={cn(
                "glass-soft hover:bg-primary-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left",
                current === d.id && "ring-2 ring-primary",
              )}
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{d.name}</span>
            </button>
          ))}
          {!filtered.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nichts gefunden.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
