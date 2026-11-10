import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eye, FileSearch, FileText, Folder, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { searchLibrary } from "@/lib/library-search";
import { parseQuery, type SearchFilters } from "@/lib/smart-search";
import { FreeNotesOverlay } from "@/components/FreeNotesOverlay";

const TEXT_HITS_INITIAL = 20;

export function LibrarySearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(t);
  }, [term]);

  const [removed, setRemoved] = useState<string[]>([]);
  const [showAllText, setShowAllText] = useState(false);
  useEffect(() => {
    setRemoved([]);
    setShowAllText(false);
  }, [debounced]);
  const parsed = parseQuery(debounced);
  const chips = parsed.chips.filter((c) => !removed.includes(c.key));
  const filters: SearchFilters = {};
  for (const c of chips) {
    if (c.key === "date") {
      filters.from = parsed.filters.from;
      filters.to = parsed.filters.to;
    } else if (c.key === "folderName") filters.folderName = parsed.filters.folderName;
    else if (c.key === "mime") filters.mime = parsed.filters.mime;
  }
  const effectiveTerm = chips.length ? parsed.term : debounced;
  const library = useQuery({
    queryKey: ["library-search", effectiveTerm, filters],
    enabled: open && (effectiveTerm.length > 0 || chips.length > 0),
    queryFn: () => searchLibrary({ data: { term: effectiveTerm, filters } }),
  });

  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [noteDoc, setNoteDoc] = useState<{ notebookId: string; name: string } | null>(null);

  const goToFolder = (folderId: string | null) => {
    onOpenChange(false);
    void navigate({ to: "/library", search: { folder: folderId ?? "root", create: undefined } });
  };

  const openDoc = (
    d: {
      id: string;
      name: string;
      storage_path: string;
      mime_type: string | null;
      folder_id?: string | null;
      page?: number | null;
      source?: string | null;
      kind?: string | null;
      notebook_id?: string | null;
    },
    withHighlight = false,
  ) => {
    onOpenChange(false);
    if (d.kind === "note" && d.notebook_id) {
      setNoteDoc({ notebookId: d.notebook_id, name: d.name });
      return;
    }
    setPreview({
      id: d.id,
      name: d.name,
      storage_path: d.storage_path,
      mime_type: d.mime_type,
      folder_id: d.folder_id ?? null,
      source: d.source ?? null,
      page: d.page ?? null,
      highlight: withHighlight ? effectiveTerm || null : null,
    });
  };

  const results = library.data;
  const isLoading = library.isLoading;
  const isError = library.isError;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass max-h-[80vh] min-w-0 overflow-y-auto overflow-x-hidden rounded-3xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Library durchsuchen</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Suchen oder filtern („PDFs 2025 im Ordner BWL“)…"
              className="rounded-2xl pl-9"
            />
          </div>

          {!!chips.length && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setRemoved((r) => [...r, c.key])}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary"
                  aria-label={`Filter ${c.label} entfernen`}
                >
                  {c.label}
                  <X className="size-3" />
                </button>
              ))}
              {results?.folderMissing && (
                <span className="px-1 py-1 text-xs text-muted-foreground">Kein passender Ordner gefunden</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Suche …
              </div>
            ) : isError ? (
              <p className="py-8 text-center text-sm text-destructive">
                Suche fehlgeschlagen. Bitte versuche es erneut.
              </p>
            ) : results ? (
              <>
                {results.folders.length + results.docs.length + results.contents.length + results.similar.length > 0 && (
                  <p className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <FileSearch className="size-3.5 text-primary" /> In deiner Library
                  </p>
                )}
                {results.folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => goToFolder(f.id)}
                    className="glass-soft hover:bg-primary-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left"
                  >
                    <Folder className="size-4 text-primary" />
                    <div className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      {f.path && (
                        <span className="block truncate text-xs text-muted-foreground">{f.path}</span>
                      )}
                    </div>
                  </button>
                ))}
                {results.docs.map((d) => (
                  <div
                    key={d.id}
                    className="glass-soft hover:bg-primary-soft flex items-center gap-2 rounded-2xl p-1.5"
                  >
                    <button
                      onClick={() => goToFolder(d.folder_id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <span className="block truncate text-sm">{d.name}</span>
                        {d.path && (
                          <span className="block truncate text-xs text-muted-foreground">{d.path}</span>
                        )}
                      </div>
                    </button>
                    <button
                      aria-label="Vorschau"
                      onClick={() => openDoc(d)}
                      className="rounded-xl p-2 text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="size-4" />
                    </button>
                  </div>
                ))}
                {!!results.contents.length && (
                  <>
                    <p className="px-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Im Inhalt gefunden
                    </p>
                    {results.contents
                      .slice(0, showAllText ? results.contents.length : TEXT_HITS_INITIAL)
                      .map((c) => (
                        <button
                          key={`c-${c.id}`}
                          onClick={() => openDoc(c, true)}
                          className="glass-soft hover:bg-primary-soft flex w-full items-start gap-3 rounded-2xl p-3 text-left"
                        >
                          <FileSearch className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                              {c.page && (
                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                  Seite {c.page}
                                </span>
                              )}
                              {c.ocr && (
                                <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] text-primary">
                                  Texterkennung
                                </span>
                              )}
                            </span>
                            {c.path && (
                              <span className="block truncate text-xs text-muted-foreground">{c.path}</span>
                            )}
                            {c.snippet && (
                              <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                                {c.snippet}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    {results.contents.length > TEXT_HITS_INITIAL && !showAllText && (
                      <button
                        onClick={() => setShowAllText(true)}
                        className="w-full rounded-2xl px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary-soft"
                      >
                        Weitere {results.contents.length - TEXT_HITS_INITIAL} Texttreffer anzeigen
                      </button>
                    )}
                  </>
                )}
                {!!results.similar.length && (
                  <>
                    <p className="px-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Ähnliche Treffer
                    </p>
                    {results.similar.map((r) => (
                      <button
                        key={`s-${r.id}`}
                        onClick={() =>
                          r.kind === "folder"
                            ? goToFolder(r.id)
                            : openDoc({
                                id: r.id,
                                name: r.name,
                                storage_path: r.storage_path ?? "",
                                mime_type: r.mime_type ?? null,
                                folder_id: r.folder_id,
                                source: r.source,
                                kind: r.doc_kind,
                                notebook_id: r.notebook_id,
                              })
                        }
                        className="glass-soft hover:bg-primary-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left"
                      >
                        {r.kind === "folder" ? (
                          <Folder className="size-4 shrink-0 text-primary" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{r.name}</span>
                          {r.path && <span className="block truncate text-xs text-muted-foreground">{r.path}</span>}
                        </span>
                      </button>
                    ))}
                  </>
                )}
                {!results.folders.length && !results.docs.length && !results.contents.length && !results.similar.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nichts gefunden.</p>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tippe, um Dokumente und Ordner zu finden.
              </p>
            )}
          </div>

        </DialogContent>
      </Dialog>
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      <FreeNotesOverlay
        key={noteDoc?.notebookId ?? "note"}
        open={!!noteDoc}
        onClose={() => setNoteDoc(null)}
        folderId={null}
        notebookId={noteDoc?.notebookId ?? null}
        title={noteDoc?.name}
      />
    </>
  );
}
