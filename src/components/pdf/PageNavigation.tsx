import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export function PageNavigation({ page, total, onJump }: {
  page: number;
  total: number;
  onJump: (page: number) => void;
}) {
  const [draft, setDraft] = useState(String(page));
  const [scrub, setScrub] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(String(page));
  }, [page, editing]);

  if (total < 2) return null;
  const submit = () => {
    const value = Number(draft);
    if (!Number.isInteger(value) || value < 1 || value > total) {
      setDraft(String(page));
      return;
    }
    onJump(value);
  };
  const iconClass = "size-8 shrink-0 rounded-full";
  return (
    <nav aria-label="PDF-Seitennavigation" className="glass flex w-full max-w-xl flex-col gap-1 rounded-3xl px-2 py-1.5 text-foreground">
      <div className="flex items-center justify-center gap-0.5">
        <Button variant="ghost" size="icon" className={iconClass} title="Erste Seite" aria-label="Erste Seite" disabled={page === 1} onClick={() => onJump(1)}><ChevronsLeft className="size-4" /></Button>
        <Button variant="ghost" size="icon" className={iconClass} title="Vorherige Seite" aria-label="Vorherige Seite" disabled={page === 1} onClick={() => onJump(page - 1)}><ChevronLeft className="size-4" /></Button>
        <form className="mx-1 flex min-w-0 items-center gap-1" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <span className="text-xs text-muted-foreground">Seite</span>
          <Input aria-label="Seitenzahl" type="text" inputMode="numeric" pattern="[0-9]*" value={editing ? draft : String(scrub ?? page)}
            onFocus={(event) => { setEditing(true); event.currentTarget.select(); }} onBlur={() => setEditing(false)}
            onChange={(event) => setDraft(event.target.value)}
            className="h-8 w-16 rounded-xl border-glass-border bg-background/40 px-1 text-center text-sm tabular-nums shadow-none" />
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">/ {total}</span>
          <Button type="submit" variant="secondary" size="icon" className={iconClass} title="Zur Seite springen" aria-label="Zur Seite springen"
            onPointerDown={(event) => event.preventDefault()}><ArrowRight className="size-4" /></Button>
        </form>
        <Button variant="ghost" size="icon" className={iconClass} title="Nächste Seite" aria-label="Nächste Seite" disabled={page === total} onClick={() => onJump(page + 1)}><ChevronRight className="size-4" /></Button>
        <Button variant="ghost" size="icon" className={iconClass} title="Letzte Seite" aria-label="Letzte Seite" disabled={page === total} onClick={() => onJump(total)}><ChevronsRight className="size-4" /></Button>
      </div>
      <Slider aria-label="Seite auswählen" min={1} max={total} step={1} value={[scrub ?? page]} className="h-5 px-2"
        onValueChange={([value]) => { if (value !== undefined) setScrub(value); }}
        onValueCommit={([value]) => { if (value !== undefined) onJump(value); setScrub(null); }} />
    </nav>
  );
}