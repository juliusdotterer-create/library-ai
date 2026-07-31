import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  Folder,
  Plus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StudyTimers } from "@/components/StudyTimer";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";

type PickedDocument = { id: string; name: string; path: string };
type PickedFolder = { id: string; name: string; path: string };

import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/lehrplaene")({
  head: () => ({
    meta: [
      { title: "Lehrpläne – Eigene Lernzeitpläne" },
      {
        name: "description",
        content:
          "Erstelle eigene Lehrpläne und plane, wann du welche PDFs, Klausuren und Lösungen bearbeitest.",
      },
      { property: "og:title", content: "Lehrpläne – Eigene Lernzeitpläne" },
      { property: "og:description", content: "Strukturierte Lernpläne mit Aufgaben und Terminen." },
    ],
  }),
  component: LehrplanPage,
});

function LehrplanPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ title: "", description: "" });
  const [planOpen, setPlanOpen] = useState(false);
  const [task, setTask] = useState({ title: "", due: "" });
  const [doc, setDoc] = useState<PickedDocument | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFolder, setPickerFolder] = useState<string | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderNav, setFolderNav] = useState<string | null>(null);



  const plans = useQuery({
    queryKey: ["study_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data.length && !activeId) setActiveId(data[0].id);
      return data;
    },
  });

  const tasks = useQuery({
    queryKey: ["study_tasks", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_tasks")
        .select("*")
        .eq("plan_id", activeId!)
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
  const docs = useQuery({
    queryKey: ["all-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,name,storage_path,folder_id,mime_type")
        .is("deleted_at", null)
        .not("name", "ilike", "desktop.ini")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const folders = useQuery({
    queryKey: ["all-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id,name,parent_id")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const folderPath = (id: string | null): string => {
    const list = folders.data ?? [];
    const parts: string[] = [];
    let cur = list.find((f) => f.id === id);
    let guard = 0;
    while (cur && guard++ < 20) {
      parts.unshift(cur.name);
      cur = list.find((f) => f.id === cur!.parent_id);
    }
    return parts.join(" / ");
  };

  const natural = new Intl.Collator("de", { numeric: true, sensitivity: "base" });




  const subFolders = (parentId: string | null) =>
    (folders.data ?? [])
      .filter((f) => (f.parent_id ?? null) === parentId)
      .sort((a, b) => natural.compare(a.name, b.name));

  const docsIn = (folderId: string | null) =>
    (docs.data ?? [])
      .filter((d) => (d.folder_id ?? null) === folderId)
      .sort((a, b) => natural.compare(a.name, b.name));

  const docMap: Record<string, string> = Object.fromEntries(
    (docs.data ?? []).map((d) => [d.id, d.name]),
  );

  const docFolderMap: Record<string, string | null> = Object.fromEntries(
    (docs.data ?? []).map((d) => [d.id, d.folder_id ?? null]),
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) =>
    setOpenGroups((s) => ({ ...s, [key]: !s[key] }));




  const [preview, setPreview] = useState<PreviewDoc | null>(null);

  const openDoc = (id: string) => {
    const d = docs.data?.find((x) => x.id === id);
    if (!d) return;
    setPreview({ name: d.name, storage_path: d.storage_path, mime_type: d.mime_type });
  };



  const createPlan = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("study_plans").insert({
        user_id: auth.user!.id,
        title: planForm.title,
        description: planForm.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPlanOpen(false);
      setPlanForm({ title: "", description: "" });
      void qc.invalidateQueries({ queryKey: ["study_plans"] });
      toast.success("Lehrplan erstellt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveId(null);
      void qc.invalidateQueries({ queryKey: ["study_plans"] });
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("study_tasks").insert({
        user_id: auth.user!.id,
        plan_id: activeId!,
        title: task.title,
        due_date: task.due || null,
        document_id: doc?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTask({ title: "", due: "" });
      setDoc(null);
      void qc.invalidateQueries({ queryKey: ["study_tasks"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const addFolderTasks = useMutation({
    mutationFn: async (folder: PickedFolder) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: folderDocs, error: docErr } = await supabase
        .from("documents")
        .select("id,name")
        .eq("folder_id", folder.id)
        .is("deleted_at", null)
        .not("name", "ilike", "desktop.ini")
        .order("name");
      if (docErr) throw docErr;
      if (!folderDocs.length) throw new Error("Dieser Ordner enthält keine Dokumente.");
      const { error } = await supabase.from("study_tasks").insert(
        folderDocs.map((d) => ({
          user_id: auth.user!.id,
          plan_id: activeId!,
          title: `${d.name} lernen`,
          due_date: task.due || null,
          document_id: d.id,
        })),
      );
      if (error) throw error;
      return folderDocs.length;
    },
    onSuccess: (count) => {
      setTask({ title: "", due: task.due });
      setDoc(null);
      void qc.invalidateQueries({ queryKey: ["study_tasks"] });
      void qc.invalidateQueries({ queryKey: ["all-docs"] });
      toast.success(`${count} Dokumente eingeplant`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async (t: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("study_tasks")
        .update({ status: t.done ? "open" : "done" })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["study_tasks"] }),
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["study_tasks"] }),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <aside className="glass h-fit rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-semibold">Lehrpläne</h1>
          <Dialog open={planOpen} onOpenChange={setPlanOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-2xl">
                <Plus className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="glass rounded-3xl">
              <DialogHeader>
                <DialogTitle>Neuer Lehrplan</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Titel</Label>
                  <Input
                    className="rounded-2xl"
                    value={planForm.title}
                    onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                  <Textarea
                    className="rounded-2xl"
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="rounded-2xl"
                  disabled={!planForm.title.trim()}
                  onClick={() => createPlan.mutate()}
                >
                  Erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-1.5">
          {plans.data?.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
                activeId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <span className="truncate">{p.title}</span>
            </button>
          ))}
          {!plans.data?.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Noch kein Lehrplan.</p>
          )}
        </div>
      </aside>

      <section className="glass rounded-3xl p-5">
        {activeId ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {plans.data?.find((p) => p.id === activeId)?.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {plans.data?.find((p) => p.id === activeId)?.description}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl text-destructive"
                onClick={() => deletePlan.mutate(activeId)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Was lernen? z. B. Klausur 2021 lösen"
                  className="h-9 flex-1 rounded-2xl"
                  value={task.title}
                  onChange={(e) => setTask({ ...task, title: e.target.value })}
                />
                <Input
                  type="date"
                  className="h-9 w-40 rounded-2xl"
                  value={task.due}
                  onChange={(e) => setTask({ ...task, due: e.target.value })}
                />
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 w-56 justify-between rounded-2xl font-normal"
                    >
                      <span className="truncate">{doc ? doc.name : "Dokument wählen"}</span>
                      <ChevronRight className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="glass w-72 rounded-2xl p-2">
                    <div className="mb-2 flex items-center gap-1 px-1 text-xs text-muted-foreground">
                      {pickerFolder && (
                        <button
                          className="rounded-lg p-1 hover:bg-muted"
                          onClick={() =>
                            setPickerFolder(
                              folders.data?.find((f) => f.id === pickerFolder)?.parent_id ?? null,
                            )
                          }
                        >
                          <ArrowLeft className="size-3.5" />
                        </button>
                      )}
                      <span className="truncate">
                        {pickerFolder ? folderPath(pickerFolder) : "Library"}
                      </span>
                    </div>
                    <div className="max-h-72 space-y-0.5 overflow-y-auto">
                      {subFolders(pickerFolder).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setPickerFolder(f.id)}
                          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <Folder className="size-4 shrink-0 opacity-60" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <ChevronRight className="size-3.5 shrink-0 opacity-50" />
                        </button>
                      ))}
                      {docsIn(pickerFolder).map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDoc({ id: d.id, name: d.name, path: folderPath(d.folder_id) });
                            if (!task.title.trim())
                              setTask((t) => ({ ...t, title: `${d.name} lernen` }));
                            setPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted",
                            doc?.id === d.id && "bg-muted",
                          )}
                        >
                          <FileText className="size-4 shrink-0 opacity-60" />
                          <span className="flex-1 truncate">{d.name}</span>
                        </button>
                      ))}
                      {!subFolders(pickerFolder).length && !docsIn(pickerFolder).length && (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          Dieser Ordner ist leer.
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover open={folderPickerOpen} onOpenChange={setFolderPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 w-52 justify-between rounded-2xl font-normal"
                    >
                      <span className="truncate">Ganzer Ordner</span>
                      <ChevronRight className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="glass w-72 rounded-2xl p-2">
                    <div className="mb-2 flex items-center gap-1 px-1 text-xs text-muted-foreground">
                      {folderNav && (
                        <button
                          className="rounded-lg p-1 hover:bg-muted"
                          onClick={() =>
                            setFolderNav(
                              folders.data?.find((f) => f.id === folderNav)?.parent_id ?? null,
                            )
                          }
                        >
                          <ArrowLeft className="size-3.5" />
                        </button>
                      )}
                      <span className="truncate">
                        {folderNav ? folderPath(folderNav) : "Library"}
                      </span>
                    </div>
                    {folderNav && (
                      <Button
                        size="sm"
                        className="mb-2 w-full rounded-xl"
                        onClick={() => {
                          const f = folders.data?.find((x) => x.id === folderNav);
                          if (f) {
                            addFolderTasks.mutate({
                              id: f.id,
                              name: f.name,
                              path: folderPath(f.id),
                            });
                            setFolderPickerOpen(false);
                          }
                        }}
                      >
                        Diesen Ordner einplanen
                      </Button>
                    )}
                    <div className="max-h-72 space-y-0.5 overflow-y-auto">
                      {subFolders(folderNav).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFolderNav(f.id)}
                          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <Folder className="size-4 shrink-0 opacity-60" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <ChevronRight className="size-3.5 shrink-0 opacity-50" />
                        </button>
                      ))}
                      {!subFolders(folderNav).length && (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          Keine Unterordner.
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  className="h-9 rounded-2xl"
                  disabled={!task.title.trim()}
                  onClick={() => addTask.mutate()}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {doc && (
                <p className="text-xs text-muted-foreground">
                  Verknüpft: <span className="font-medium text-foreground">{doc.name}</span>
                  {doc.path ? ` · ${doc.path}` : ""}
                  <button className="text-destructive ml-2" onClick={() => setDoc(null)}>
                    entfernen
                  </button>
                </p>
              )}
            </div>

            <div className="glass-soft mb-4 rounded-2xl p-3">
              <StudyTimers />
            </div>


            <div className="space-y-2">
              {(() => {
                type Task = NonNullable<typeof tasks.data>[number];
                const renderTask = (t: Task, nested = false) => {
                  const done = t.status === "done";
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl p-3",
                        nested ? "bg-muted/40" : "glass-soft",
                      )}
                    >
                      <button onClick={() => toggleTask.mutate({ id: t.id, done })}>
                        {done ? (
                          <CheckCircle2 className="size-5 text-primary" />
                        ) : (
                          <Circle className="size-5 text-muted-foreground" />
                        )}
                      </button>
                      <span className={cn("flex-1 text-sm", done && "line-through opacity-60")}>
                        {t.title}
                        {t.document_id && docMap[t.document_id] && (
                          <button
                            onClick={() => openDoc(t.document_id!)}
                            className="bg-primary-soft text-accent-foreground ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 align-middle text-[11px]"
                          >
                            <FileText className="size-3" />
                            {docMap[t.document_id]}
                          </button>
                        )}
                      </span>

                      {!nested && t.due_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(t.due_date), "d. MMM", { locale: de })}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-2xl text-destructive"
                        onClick={() => removeTask.mutate(t.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  );
                };

                const groups: { key: string; folderId: string | null; items: Task[] }[] = [];
                const index = new Map<string, number>();
                for (const t of tasks.data ?? []) {
                  const folderId = t.document_id ? (docFolderMap[t.document_id] ?? null) : null;
                  const key = folderId ? `${folderId}|${t.due_date ?? ""}` : `single-${t.id}`;
                  const at = index.get(key);
                  if (at === undefined) {
                    index.set(key, groups.length);
                    groups.push({ key, folderId, items: [t] });
                  } else {
                    groups[at].items.push(t);
                  }
                }

                return groups.map((g) => {
                  if (g.items.length < 2 || !g.folderId) return renderTask(g.items[0]);
                  const open = !!openGroups[g.key];
                  const doneCount = g.items.filter((t) => t.status === "done").length;
                  const due = g.items[0].due_date;
                  const name = folders.data?.find((f) => f.id === g.folderId)?.name ?? "Ordner";
                  return (
                    <div key={g.key} className="glass-soft rounded-2xl p-2">
                      <button
                        onClick={() => toggleGroup(g.key)}
                        className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-muted/50"
                      >
                        {open ? (
                          <ChevronDown className="size-4 shrink-0 opacity-60" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 opacity-60" />
                        )}
                        <Folder className="size-5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {folderPath(g.folderId)} · {doneCount}/{g.items.length} erledigt
                          </span>
                        </span>
                        {due && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(due), "d. MMM", { locale: de })}
                          </span>
                        )}
                      </button>
                      {open && (
                        <div className="mt-1 space-y-1 pl-6">
                          {g.items.map((t) => renderTask(t, true))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              {!tasks.data?.length && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Noch keine Aufgaben in diesem Plan.
                </p>
              )}
            </div>

          </>
        ) : (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Erstelle links deinen ersten Lehrplan.
          </p>
        )}
      </section>
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>

  );
}
