import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllDocuments, useAllFolders, useStudyPlans, useStudyTasks } from "@/hooks/useLibrary";
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
import { StudyTimers } from "@/components/StudyTimer";
import { DocumentPreview, type PreviewDoc } from "@/components/DocumentPreview";
import {
  buildFolderPath,
  DocumentPicker,
  FolderPicker,
  type PickerFolder,
} from "@/components/lehrplan/DocumentPicker";
import { TaskList } from "@/components/lehrplan/TaskList";
import { cn } from "@/lib/utils";

type PickedDocument = { id: string; name: string; path: string };

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
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ title: "", description: "" });
  const [planOpen, setPlanOpen] = useState(false);
  const [task, setTask] = useState({ title: "", due: "" });
  const [doc, setDoc] = useState<PickedDocument | null>(null);

  const plans = useStudyPlans();
  const tasks = useStudyTasks(activeId);
  const docs = useAllDocuments();
  const folders = useAllFolders();

  useEffect(() => {
    if (plans.data?.length && !activeId) setActiveId(plans.data[0].id);
  }, [plans.data, activeId]);

  const folderList = (folders.data ?? []) as PickerFolder[];
  const docList = docs.data ?? [];

  const docNames: Record<string, string> = Object.fromEntries(docList.map((d) => [d.id, d.name]));
  const docFolders: Record<string, string | null> = Object.fromEntries(
    docList.map((d) => [d.id, d.folder_id ?? null]),
  );

  const [preview, setPreview] = useState<PreviewDoc | null>(null);

  const openDoc = (id: string) => {
    const d = docList.find((x) => x.id === id);
    if (!d) return;
    setPreview({ id: d.id, name: d.name, storage_path: d.storage_path, mime_type: d.mime_type });
  };

  const createPlan = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("study_plans").insert({
        user_id: user.id,
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
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("study_plans").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveId(null);
      void qc.invalidateQueries({ queryKey: ["study_plans"] });
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("study_tasks").insert({
        user_id: user.id,
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
    mutationFn: async (folder: PickerFolder) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { data: folderDocs, error: docErr } = await supabase
        .from("documents")
        .select("id,name")
        .eq("user_id", uid)
        .eq("folder_id", folder.id)
        .is("deleted_at", null)
        .not("name", "ilike", "desktop.ini")
        .order("name");
      if (docErr) throw docErr;
      if (!folderDocs.length) throw new Error("Dieser Ordner enthält keine Dokumente.");
      const { error } = await supabase.from("study_tasks").insert(
        folderDocs.map((d) => ({
          user_id: uid,
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
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase
        .from("study_tasks")
        .update({ status: t.done ? "open" : "done" })
        .eq("id", t.id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["study_tasks"] }),
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("study_tasks").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["study_tasks"] }),
  });

  const activePlan = plans.data?.find((p) => p.id === activeId);

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
                <h2 className="text-lg font-semibold">{activePlan?.title}</h2>
                <p className="text-sm text-muted-foreground">{activePlan?.description}</p>
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
                <DocumentPicker
                  folders={folderList}
                  docs={docList}
                  selectedId={doc?.id ?? null}
                  label={doc ? doc.name : "Dokument wählen"}
                  onPick={(d) => {
                    setDoc({ id: d.id, name: d.name, path: buildFolderPath(folderList, d.folder_id) });
                    if (!task.title.trim()) setTask((t) => ({ ...t, title: `${d.name} lernen` }));
                  }}
                />
                <FolderPicker folders={folderList} onPick={(f) => addFolderTasks.mutate(f)} />

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

            <TaskList
              tasks={tasks.data ?? []}
              folders={folderList}
              docNames={docNames}
              docFolders={docFolders}
              onToggle={(t) => toggleTask.mutate(t)}
              onRemove={(id) => removeTask.mutate(id)}
              onOpenDoc={openDoc}
            />
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
