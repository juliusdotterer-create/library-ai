import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/links")({
  head: () => ({
    meta: [
      { title: "Linktree – Alle Verweise an einem Ort" },
      {
        name: "description",
        content: "Sammle alle wichtigen URLs mit automatisch eingefärbten Logos in deinem Linktree.",
      },
      { property: "og:title", content: "Linktree – Alle Verweise an einem Ort" },
      { property: "og:description", content: "Deine Verweise, farblich passend zum Design." },
    ],
  }),
  component: LinksPage,
});

function domainOf(url: string) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function LinksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; title: string; url: string }>({
    title: "",
    url: "",
  });

  const links = useQuery({
    queryKey: ["links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = form.url.startsWith("http") ? form.url : `https://${form.url}`;
      if (form.id) {
        const { error } = await supabase
          .from("links")
          .update({ title: form.title, url })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("links")
          .insert({ user_id: auth.user!.id, title: form.title, url });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ title: "", url: "" });
      void qc.invalidateQueries({ queryKey: ["links"] });
      toast.success("Gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["links"] }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="glass flex items-center justify-between rounded-3xl p-4">
        <div>
          <h1 className="text-lg font-semibold">Linktree</h1>
          <p className="text-sm text-muted-foreground">Alle deine Verweise an einem Ort.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setForm({ title: "", url: "" });
          }}
        >
          <DialogTrigger asChild>
            <Button className="rounded-2xl">
              <Plus className="size-4" /> Link
            </Button>
          </DialogTrigger>
          <DialogContent className="glass rounded-3xl">
            <DialogHeader>
              <DialogTitle>{form.id ? "Link bearbeiten" : "Neuer Link"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
                <Input
                  className="rounded-2xl"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">URL</Label>
                <Input
                  className="rounded-2xl"
                  placeholder="https://…"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="rounded-2xl"
                disabled={!form.title.trim() || !form.url.trim()}
                onClick={() => save.mutate()}
              >
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2.5">
        {links.data?.map((l) => {
          const host = domainOf(l.url);
          return (
            <div
              key={l.id}
              className="glass group flex items-center gap-3 rounded-3xl p-4 transition-transform hover:-translate-y-0.5"
            >
              <span className="bg-primary-soft flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                {host ? (
                  <img
                    src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
                    alt={`${host} Logo`}
                    loading="lazy"
                    className="size-6 rounded-md"
                    style={{
                      filter: "grayscale(1)",
                      mixBlendMode: "luminosity",
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <Link2 className="size-5 text-primary" />
                )}
              </span>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1"
              >
                <span className="block truncate font-medium">{l.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{host}</span>
              </a>
              <Button variant="ghost" size="icon" className="rounded-2xl" asChild>
                <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label="Öffnen">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl"
                onClick={() => {
                  setForm({ id: l.id, title: l.title, url: l.url });
                  setOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl text-destructive"
                onClick={() => remove.mutate(l.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
        {!links.data?.length && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Noch keine Links gespeichert.
          </p>
        )}
      </div>
    </div>
  );
}
