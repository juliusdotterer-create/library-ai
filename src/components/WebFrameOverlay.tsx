import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Frame = { id: string; label: string; url: string; position: number };

const LAST_KEY = "webframe:last";

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function WebFrameOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [frames, setFrames] = useState<Frame[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const loadedRef = useRef(false);

  const active = frames.find((f) => f.id === activeId) ?? null;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("web_frames")
      .select("id,label,url,position")
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Seiten konnten nicht geladen werden");
      return;
    }
    const rows = (data ?? []) as Frame[];
    setFrames(rows);
    const last = typeof window !== "undefined" ? window.localStorage.getItem(LAST_KEY) : null;
    setActiveId((cur) => cur ?? (rows.find((r) => r.id === last)?.id ?? rows[0]?.id ?? null));
  }, [user]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (activeId && typeof window !== "undefined") {
      window.localStorage.setItem(LAST_KEY, activeId);
    }
  }, [activeId]);

  // Heuristik: kein load-Event -> Seite verbietet vermutlich das Einbetten.
  useEffect(() => {
    loadedRef.current = false;
    setBlocked(false);
    if (!active) return;
    const t = window.setTimeout(() => {
      if (!loadedRef.current) setBlocked(true);
    }, 6000);
    return () => window.clearTimeout(t);
  }, [active?.id, active?.url, reloadKey]);

  const addFrame = async () => {
    if (!user) return;
    const clean = normalizeUrl(url);
    if (!clean) {
      toast.error("Bitte eine gültige Adresse eingeben");
      return;
    }
    const name = label.trim() || new URL(clean).hostname.replace(/^www\./, "");
    const { data, error } = await supabase
      .from("web_frames")
      .insert({
        user_id: user.id,
        label: name,
        url: clean,
        position: frames.length,
      })
      .select("id,label,url,position")
      .single();
    if (error || !data) {
      toast.error("Seite konnte nicht gespeichert werden");
      return;
    }
    setFrames((f) => [...f, data as Frame]);
    setActiveId((data as Frame).id);
    setLabel("");
    setUrl("");
  };

  const rename = async (frame: Frame) => {
    const next = window.prompt("Neuer Name", frame.label);
    if (next == null) return;
    const name = next.trim();
    if (!name) return;
    const { error } = await supabase.from("web_frames").update({ label: name }).eq("id", frame.id);
    if (error) {
      toast.error("Umbenennen fehlgeschlagen");
      return;
    }
    setFrames((f) => f.map((x) => (x.id === frame.id ? { ...x, label: name } : x)));
  };

  const remove = async (frame: Frame) => {
    const { error } = await supabase.from("web_frames").delete().eq("id", frame.id);
    if (error) {
      toast.error("Löschen fehlgeschlagen");
      return;
    }
    setFrames((f) => f.filter((x) => x.id !== frame.id));
    setActiveId((cur) => (cur === frame.id ? null : cur));
  };

  const move = async (frame: Frame, dir: -1 | 1) => {
    const idx = frames.findIndex((f) => f.id === frame.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= frames.length) return;
    const next = [...frames];
    const a = next[idx]!;
    const b = next[target]!;
    next[idx] = b;
    next[target] = a;
    const reindexed = next.map((f, i) => ({ ...f, position: i }));
    setFrames(reindexed);
    await Promise.all(
      reindexed.map((f) => supabase.from("web_frames").update({ position: f.position }).eq("id", f.id)),
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-foreground/20 p-2 backdrop-blur-[2px] lg:p-4">
      <div className="glass flex shrink-0 flex-wrap items-center gap-2 rounded-3xl px-3 py-2">
        <Globe className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {loading && frames.length === 0 ? (
            <span className="text-xs text-muted-foreground">Wird geladen…</span>
          ) : frames.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Noch keine Seite hinterlegt – unten hinzufügen.
            </span>
          ) : (
            frames.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "group flex shrink-0 items-center gap-1 rounded-2xl px-2 py-1 text-sm transition-colors",
                  f.id === activeId
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <button type="button" className="max-w-40 truncate" onClick={() => setActiveId(f.id)}>
                  {f.label}
                </button>
                <button
                  type="button"
                  title="Nach links"
                  onClick={() => void move(f, -1)}
                  className="hidden rounded-lg p-0.5 opacity-70 hover:opacity-100 group-hover:inline-flex"
                >
                  <ArrowLeft className="size-3" />
                </button>
                <button
                  type="button"
                  title="Nach rechts"
                  onClick={() => void move(f, 1)}
                  className="hidden rounded-lg p-0.5 opacity-70 hover:opacity-100 group-hover:inline-flex"
                >
                  <ArrowRight className="size-3" />
                </button>
                <button
                  type="button"
                  title="Umbenennen"
                  onClick={() => void rename(f)}
                  className="hidden rounded-lg p-0.5 opacity-70 hover:opacity-100 group-hover:inline-flex"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  title="Entfernen"
                  onClick={() => void remove(f)}
                  className="hidden rounded-lg p-0.5 opacity-70 hover:opacity-100 group-hover:inline-flex"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>

        <Button
          variant="secondary"
          size="icon"
          className="rounded-2xl"
          title="Neu laden"
          disabled={!active}
          onClick={() => setReloadKey((k) => k + 1)}
        >
          <RotateCw className="size-4" />
        </Button>
        {active && (
          <Button asChild variant="secondary" size="icon" className="rounded-2xl">
            <a href={active.url} target="_blank" rel="noreferrer" title="In neuem Tab öffnen">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onClose} title="Schließen">
          <X className="size-4" />
        </Button>
      </div>

      <div className="glass mt-2 flex shrink-0 flex-wrap items-center gap-2 rounded-3xl px-3 py-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name (optional)"
          className="h-9 w-40 rounded-2xl"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addFrame()}
          placeholder="https://beispiel.de"
          className="h-9 min-w-0 flex-1 rounded-2xl"
        />
        <Button className="rounded-2xl" onClick={() => void addFrame()}>
          <Plus className="size-4" /> Hinzufügen
        </Button>
      </div>

      <div className="glass mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl p-0">
        {!active ? (
          <div className="flex size-full items-center justify-center bg-background p-8 text-center text-sm text-muted-foreground">
            Wähle oben eine Seite aus oder füge eine neue Adresse hinzu.
          </div>
        ) : (
          <div className="relative size-full">
            <iframe
              key={`${active.id}-${reloadKey}`}
              src={active.url}
              title={active.label}
              onLoad={() => {
                loadedRef.current = true;
                setBlocked(false);
              }}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="size-full rounded-3xl bg-background"
            />
            {blocked && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
                <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Diese Seite erlaubt das Einbetten möglicherweise nicht.
                  </span>
                  <Button asChild size="sm" className="rounded-xl">
                    <a href={active.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" /> In neuem Tab öffnen
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
