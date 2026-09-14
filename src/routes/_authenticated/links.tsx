import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LinkLogo } from "@/components/LinkLogo";
import { MotionItem } from "@/components/MotionItem";
import { useAuth } from "@/hooks/useAuth";
import { useLinks } from "@/hooks/useLibrary";
import { EmptyState } from "@/components/EmptyState";
import { LinkSkeleton } from "@/components/Skeletons";
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
  validateSearch: (search: Record<string, unknown>): { create?: boolean } => ({
    create: search.create === "1" || search.create === 1,
  }),
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

/** Versucht die App zu öffnen und weicht im selben Tab auf die Web-Adresse aus. */
function tryOpenApp(url: string, appUrl: string) {
  let done = false;
  const cancel = () => {
    if (done) return;
    done = true;
    window.clearTimeout(fallback);
    window.removeEventListener("pagehide", cancel);
    window.removeEventListener("blur", cancel);
    document.removeEventListener("visibilitychange", onVisibility);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") cancel();
  };
  const fallback = window.setTimeout(() => {
    if (done) return;
    done = true;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", cancel);
    window.removeEventListener("blur", cancel);
    // Gleicher Tab: wird nicht von Popup-Blockern verhindert.
    window.location.href = url;
  }, 1200);
  window.addEventListener("pagehide", cancel);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", onVisibility);
  window.location.href = appUrl;
}

function LinksPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const search = useSearch({ strict: false }) as { create?: boolean } | undefined;
  const navigate = useNavigate({ from: Route.fullPath });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; title: string; url: string; appUrl: string }>({
    title: "",
    url: "",
    appUrl: "",
  });

  const links = useLinks();

  useEffect(() => {
    if (!search?.create) return;
    setOpen(true);
    void navigate({ search: {}, replace: true });
  }, [navigate, search?.create]);

  const save = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Nicht angemeldet");
      const url = form.url.startsWith("http") ? form.url : `https://${form.url}`;
      const app_url = form.appUrl.trim() || null;
      if (form.id) {
        const { error } = await supabase
          .from("links")
          .update({ title: form.title, url, app_url })
          .eq("id", form.id)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("links")
          .insert({ user_id: uid, title: form.title, url, app_url });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ title: "", url: "", appUrl: "" });
      void qc.invalidateQueries({ queryKey: ["links"] });
      toast.success("Gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!uid) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("links").delete().eq("id", id).eq("user_id", uid);
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
            if (!o) setForm({ title: "", url: "", appUrl: "" });
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">App-Link (optional)</Label>
                <Input
                  className="rounded-2xl"
                  placeholder="youtube://… oder spotify:…"
                  value={form.appUrl}
                  onChange={(e) => setForm({ ...form, appUrl: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Öffnet die App direkt. Ist sie nicht installiert, wird die Web-Adresse geöffnet.
                </p>
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

      {links.isLoading ? (
        <LinkSkeleton />
      ) : (
        <div className="space-y-2.5">
          {links.data?.map((l, i) => {
            const host = domainOf(l.url);
            return (
              <MotionItem
                key={l.id}
                delay={Math.min(i * 0.015, 0.08)}
                className="glass group flex items-center gap-3 rounded-3xl p-4 transition-transform hover:-translate-y-0.5"
              >
                <span className="bg-primary-soft flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                  <LinkLogo host={host} title={l.title} />
                </span>

                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!l.app_url) return;
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    tryOpenApp(l.url, l.app_url);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-medium">{l.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {l.app_url ? `${host} · öffnet App` : host}
                  </span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-2xl"
                  onClick={() => {
                    setForm({ id: l.id, title: l.title, url: l.url, appUrl: l.app_url ?? "" });
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
              </MotionItem>
            );
          })}
          {!links.data?.length && (
            <EmptyState
              icon={<Link2 className="size-7" />}
              title="Noch keine Links"
              description="Sammle hier alle wichtigen URLs mit automatisch passenden Icons."
              action={{ label: "Ersten Link hinzufügen", onClick: () => setOpen(true) }}
            />
          )}
        </div>
      )}
    </div>
  );
}
