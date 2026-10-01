import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileText, Folder, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DriveSyncSummary = {
  since: string;
  added: number;
  addedFolders: number;
  changed: number;
  missing: number;
};

const KEY = "drive-last-sync";
const OPENED_KEY = "drive-new-opened";

export function saveSyncSummary(s: DriveSyncSummary) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export function loadSyncSummary(): DriveSyncSummary | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DriveSyncSummary) : null;
  } catch {
    return null;
  }
}
export function openedNewIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPENED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function markNewOpened(id: string) {
  const s = openedNewIds();
  s.add(id);
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify([...s].slice(-2000)));
  } catch {
    /* ignore */
  }
}

type F = { id: string; name: string; parent_id: string | null };
export type NewDoc = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  folder_id: string | null;
  source: string | null;
};

const PREVIEW_DATA: { docs: NewDoc[]; newFolders: F[]; allFolders: F[] } = {
  allFolders: [
    { id: "preview-klausuren", name: "Klausuren", parent_id: null },
    { id: "preview-strafrecht", name: "Strafrecht", parent_id: "preview-klausuren" },
    { id: "preview-2026", name: "2026", parent_id: "preview-strafrecht" },
    { id: "preview-zivilrecht", name: "Zivilrecht", parent_id: "preview-klausuren" },
    { id: "preview-skripte", name: "Skripte", parent_id: null },
    { id: "preview-verwaltungsrecht", name: "Verwaltungsrecht", parent_id: "preview-skripte" },
  ],
  newFolders: [
    { id: "preview-2026", name: "2026", parent_id: "preview-strafrecht" },
    { id: "preview-verwaltungsrecht", name: "Verwaltungsrecht", parent_id: "preview-skripte" },
  ],
  docs: [
    { id: "preview-1", name: "Klausur Strafrecht – Frühjahr 2026.pdf", storage_path: "", mime_type: "application/pdf", folder_id: "preview-2026", source: "gdrive" },
    { id: "preview-2", name: "Lösungsskizze – Fall 3.pdf", storage_path: "", mime_type: "application/pdf", folder_id: "preview-2026", source: "gdrive" },
    { id: "preview-3", name: "Übersicht Verwaltungsakt.pdf", storage_path: "", mime_type: "application/pdf", folder_id: "preview-verwaltungsrecht", source: "gdrive" },
    { id: "preview-4", name: "Schema Anfechtungsklage.docx", storage_path: "", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", folder_id: "preview-verwaltungsrecht", source: "gdrive" },
  ],
};

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export function DriveNewItemsDialog({
  summary,
  uid,
  open,
  onOpenChange,
  onOpenDoc,
  onOpenFolder,
  preview = false,
}: {
  summary: DriveSyncSummary | null;
  uid?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpenDoc: (d: NewDoc) => void;
  onOpenFolder: (id: string) => void;
  preview?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["drive-new", uid, summary?.since],
    enabled: open && !!uid && !!summary && !preview,
    queryFn: async () => {
      const since = summary!.since;
      const [docs, newFolders, allFolders] = await Promise.all([
        pageAll<NewDoc>((a, b) =>
          supabase
            .from("documents")
            .select("id,name,storage_path,mime_type,folder_id,source")
            .eq("user_id", uid!)
            .eq("source", "gdrive")
            .is("deleted_at", null)
            .gte("created_at", since)
            .order("id")
            .range(a, b),
        ),
        pageAll<F>((a, b) =>
          supabase
            .from("folders")
            .select("id,name,parent_id")
            .eq("user_id", uid!)
            .eq("source", "gdrive")
            .is("deleted_at", null)
            .gte("created_at", since)
            .order("id")
            .range(a, b),
        ),
        pageAll<F>((a, b) =>
          supabase
            .from("folders")
            .select("id,name,parent_id")
            .eq("user_id", uid!)
            .is("deleted_at", null)
            .order("id")
            .range(a, b),
        ),
      ]);
      return { docs, newFolders, allFolders };
    },
  });
  const data = preview ? PREVIEW_DATA : q.data;

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.allFolders.map((f) => [f.id, f]));
    const chain = (id: string | null) => {
      const parts: string[] = [];
      let cur = id;
      let guard = 0;
      while (cur && guard++ < 50) {
        const f = map.get(cur);
        if (!f) break;
        parts.unshift(f.name);
        cur = f.parent_id;
      }
      return parts;
    };
    const t = filter.trim().toLowerCase();
    type Sub = { path: string; folderId: string | null; docs: NewDoc[]; isNewFolder: boolean };
    const topics = new Map<string, Map<string, Sub>>();
    const add = (folderId: string | null, doc?: NewDoc, isNewFolder = false) => {
      const parts = chain(folderId);
      const topic = parts[0] ?? "Library (oberste Ebene)";
      const path = parts.slice(1).join(" – ") || "—";
      if (!topics.has(topic)) topics.set(topic, new Map());
      const subs = topics.get(topic)!;
      const key = folderId ?? "root";
      if (!subs.has(key)) subs.set(key, { path, folderId, docs: [], isNewFolder: false });
      const s = subs.get(key)!;
      if (doc) s.docs.push(doc);
      if (isNewFolder) s.isNewFolder = true;
    };
    for (const f of data.newFolders) add(f.id, undefined, true);
    for (const d of data.docs) {
      if (t && !d.name.toLowerCase().includes(t)) continue;
      add(d.folder_id, d);
    }
    return [...topics.entries()]
      .map(([topic, subs]) => ({
        topic,
        subs: [...subs.values()]
          .filter((s) => !t || s.docs.length || s.path.toLowerCase().includes(t))
          .sort((a, b) => a.path.localeCompare(b.path)),
      }))
      .filter((g) => g.subs.length)
      .sort((a, b) => a.topic.localeCompare(b.topic));
  }, [data, filter]);

  const stat = (n: number, label: string) => (
    <div className="glass rounded-2xl px-3 py-2 text-center">
      <div className="text-lg font-semibold">{n}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass flex max-h-[85dvh] flex-col rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Jetzt auch verfügbar
            {preview && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Beispiel
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stat(data?.docs.length ?? summary.added, "neue Dokumente")}
            {stat(data?.newFolders.length ?? summary.addedFolders, "neue Unterordner")}
            {stat(summary.changed, "aktualisiert")}
            {stat(summary.missing, "nicht gefunden")}
          </div>
        )}
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Neue Dokumente filtern …"
          className="rounded-2xl"
        />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {!preview && q.isLoading && <p className="text-sm text-muted-foreground">Lade neue Einträge …</p>}
          {!preview && q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
          {data && !groups.length && (
            <p className="text-sm text-muted-foreground">Keine neuen Dokumente oder Ordner.</p>
          )}
          {groups.map((g) => {
            const isClosed = closed.has(g.topic);
            const count = g.subs.reduce((n, s) => n + s.docs.length, 0);
            return (
              <section key={g.topic} className="rounded-2xl border border-border/60">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold"
                  onClick={() =>
                    setClosed((s) => {
                      const n = new Set(s);
                      if (n.has(g.topic)) n.delete(g.topic);
                      else n.add(g.topic);
                      return n;
                    })
                  }
                >
                  <ChevronDown className={cn("size-4 transition-transform", isClosed && "-rotate-90")} />
                  <span className="flex-1 truncate">{g.topic}</span>
                  <span className="text-xs font-normal text-muted-foreground">{count} neu</span>
                </button>
                {!isClosed && (
                  <div className="space-y-2 px-3 pb-3">
                    {g.subs.map((s) => (
                      <div key={s.folderId ?? "root"}>
                        <button
                          className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
                          onClick={() => !preview && s.folderId && onOpenFolder(s.folderId)}
                        >
                          <Folder className="size-4 text-primary" />
                          <span className="flex-1 truncate">{s.path}</span>
                          {s.isNewFolder && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              Neuer Ordner
                            </span>
                          )}
                          <span className="text-xs">{s.docs.length}</span>
                        </button>
                        <ul className="ml-6 space-y-0.5">
                          {s.docs.map((d) => (
                            <li key={d.id}>
                              <button
                                className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-sm hover:bg-muted"
                                onClick={() => !preview && onOpenDoc(d)}
                              >
                                <FileText className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">{d.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
