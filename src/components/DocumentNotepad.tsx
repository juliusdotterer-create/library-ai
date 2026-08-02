import { useEffect, useRef, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Free writing sheet stored separately from the PDF annotations. */
export function DocumentNotepad({ documentId }: { documentId: string }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skip = useRef(true);

  useEffect(() => {
    let cancelled = false;
    skip.current = true;
    setLoaded(false);
    void (async () => {
      const { data } = await supabase
        .from("document_notepads")
        .select("content")
        .eq("document_id", documentId)
        .maybeSingle();
      if (cancelled) return;
      setContent(data?.content ?? "");
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const save = async (value: string, silent = true) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("document_notepads")
      .upsert(
        { user_id: userId, document_id: documentId, content: value },
        { onConflict: "user_id,document_id" },
      );
    setSaving(false);
    if (error) toast.error("Schreibblatt konnte nicht gespeichert werden");
    else if (!silent) toast.success("Schreibblatt gespeichert");
  };

  // autosave
  useEffect(() => {
    if (!loaded) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const t = setTimeout(() => void save(content), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, loaded]);

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Schreibblatt</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {saving ? "Speichert…" : "Automatisch gespeichert"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Speichern"
          onClick={() => void save(content, false)}
        >
          <Save className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-2xl"
          title="Schreibblatt leeren"
          onClick={() => {
            setContent("");
            void save("", false);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Eigene Lösung schreiben…"
        className="min-h-0 flex-1 resize-none bg-transparent p-3 text-sm leading-relaxed outline-none"
      />
    </div>
  );
}
