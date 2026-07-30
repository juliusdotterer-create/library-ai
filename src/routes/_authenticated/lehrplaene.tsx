import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, GraduationCap, Plus, Trash2 } from "lucide-react";
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
import { DocumentPicker, type PickedDocument } from "@/components/DocumentPicker";
import { StudyTimers } from "@/components/StudyTimer";
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTask({ title: "", due: "" });
      void qc.invalidateQueries({ queryKey: ["study_tasks"] });
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
              <GraduationCap className="size-4 shrink-0" />
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

            <div className="mb-4 flex flex-wrap gap-2">
              <Input
                placeholder="Aufgabe, z. B. Klausur 2021 lösen"
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
              <Button
                className="rounded-2xl"
                disabled={!task.title.trim()}
                onClick={() => addTask.mutate()}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {tasks.data?.map((t) => {
                const done = t.status === "done";
                return (
                  <div key={t.id} className="glass-soft flex items-center gap-3 rounded-2xl p-3">
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

                    {t.due_date && (
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
              })}
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
    </div>
  );
}
