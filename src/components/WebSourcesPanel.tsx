import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { DEFAULT_PREFS, normalizeDomain, PRESET_SOURCES, SCOPE_LABELS, type WebPrefs, type WebScope } from "@/lib/web-sources";

export function WebSourcesPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<WebPrefs>(DEFAULT_PREFS);
  const [addInput, setAddInput] = useState("");
  const [blockInput, setBlockInput] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("web_search_prefs")
      .select("scope, disabled_domains, custom_domains, blocked_domains")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => data && setPrefs({ ...DEFAULT_PREFS, ...(data as Partial<WebPrefs>) }));
  }, [user]);

  const save = async (next: WebPrefs) => {
    const prev = prefs;
    setPrefs(next);
    if (!user) return;
    const { error } = await supabase
      .from("web_search_prefs")
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
    if (error) {
      setPrefs(prev);
      toast.error("Einstellung konnte nicht gespeichert werden");
    }
  };

  const toggle = (domain: string, on: boolean) =>
    save({
      ...prefs,
      disabled_domains: on ? prefs.disabled_domains.filter((d) => d !== domain) : [...prefs.disabled_domains, domain],
    });

  const addTo = (key: "custom_domains" | "blocked_domains", raw: string, reset: () => void) => {
    const d = normalizeDomain(raw);
    if (!d) return toast.error("Bitte eine Adresse wie haufe.de eingeben");
    if (!prefs[key].includes(d)) save({ ...prefs, [key]: [...prefs[key], d] });
    reset();
  };

  const group = (g: "legal" | "general", title: string) => (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {PRESET_SOURCES.filter((s) => s.group === g).map((s) => (
        <label key={s.domain} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1 text-sm">
          <span className="min-w-0">
            <span className="block truncate">{s.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{s.domain}</span>
          </span>
          <Switch checked={!prefs.disabled_domains.includes(s.domain)} onCheckedChange={(v) => toggle(s.domain, v)} />
        </label>
      ))}
    </div>
  );

  const chips = (key: "custom_domains" | "blocked_domains") => (
    <div className="flex flex-wrap gap-1.5">
      {prefs[key].map((d) => (
        <span key={d} className="flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs">
          {d}
          <button aria-label={`${d} entfernen`} onClick={() => save({ ...prefs, [key]: prefs[key].filter((x) => x !== d) })}>
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(SCOPE_LABELS) as WebScope[]).map((s) => (
          <button
            key={s}
            onClick={() => save({ ...prefs, scope: s })}
            className={cn(
              "rounded-2xl border px-3 py-2 text-sm",
              prefs.scope === s ? "border-primary bg-primary-soft font-medium" : "border-field-border bg-field",
            )}
          >
            {SCOPE_LABELS[s]}
          </button>
        ))}
      </div>
      {group("legal", "Rechtsquellen (deutsches Recht)")}
      {group("general", "Allgemeine Quellen")}
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Eigene Seiten hinzufügen</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addTo("custom_domains", addInput, () => setAddInput("")); }}>
          <Input value={addInput} onChange={(e) => setAddInput(e.target.value)} placeholder="z. B. haufe.de" className="bg-field border-field-border" />
          <Button type="submit" variant="secondary">Hinzufügen</Button>
        </form>
        {chips("custom_domains")}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seiten ausschließen</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addTo("blocked_domains", blockInput, () => setBlockInput("")); }}>
          <Input value={blockInput} onChange={(e) => setBlockInput(e.target.value)} placeholder="z. B. gutefrage.net" className="bg-field border-field-border" />
          <Button type="submit" variant="secondary">Ausschließen</Button>
        </form>
        {chips("blocked_domains")}
      </div>
    </div>
  );
}
