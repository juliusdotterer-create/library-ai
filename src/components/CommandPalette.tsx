import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  FileText,
  Folder,
  Link as LinkIcon,
  ListChecks,
  Plus,
  Search,
} from "lucide-react";
import { Command } from "cmdk";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  useAllDocuments,
  useAllFolders,
  useEvents,
  useLinks,
  useStudyPlans,
} from "@/hooks/useLibrary";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { id: "new-folder", label: "Neuer Ordner", icon: Folder, to: "/library?create=folder" },
  { id: "new-link", label: "Neuer Link", icon: LinkIcon, to: "/links?create=1" },
  { id: "new-plan", label: "Neuer Lehrplan", icon: ListChecks, to: "/lehrplaene?create=1" },
  { id: "new-event", label: "Neuer Termin", icon: CalendarDays, to: "/kalender?create=1" },
];

const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const docs = useAllDocuments();
  const folders = useAllFolders();
  const plans = useStudyPlans();
  const links = useLinks();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();
  const events = useEvents(monthStart, monthEnd);

  const isLoading =
    docs.isLoading || folders.isLoading || plans.isLoading || links.isLoading || events.isLoading;

  const select = (to: string) => {
    setOpen(false);
    void navigate({ to });
  };

  if (!uid) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass overflow-hidden rounded-3xl border-0 p-0 shadow-2xl sm:max-w-xl">
        <DialogTitle className="sr-only">Kommando-Palette</DialogTitle>
        <Command
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          loop
        >
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-3">
            <Search className="size-4 text-muted-foreground" />
            <Command.Input
              placeholder="Suchen und springen…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-lg bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Inhalte werden geladen…
              </div>
            )}
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Keine Treffer
            </Command.Empty>

            <Command.Group heading="Aktionen">
              {ACTIONS.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`${a.label} ${a.id}`}
                  onSelect={() => select(a.to)}
                  className={itemClass}
                >
                  <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft">
                    <a.icon className="size-4 text-primary" />
                  </span>
                  <span>{a.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {folders.data?.length ? (
              <Command.Group heading="Ordner">
                {folders.data.map((f) => (
                  <Command.Item
                    key={f.id}
                    value={`ordner ${f.name}`}
                    onSelect={() => select(f.parent_id ? `/library?folder=${f.id}` : "/library?folder=root")}
                    className={itemClass}
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft">
                      <Folder className="size-4 text-primary" />
                    </span>
                    <span className="truncate">{f.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {docs.data?.length ? (
              <Command.Group heading="Dokumente">
                {docs.data.map((d) => (
                  <Command.Item
                    key={d.id}
                    value={`dokument ${d.name}`}
                    onSelect={() =>
                      select(d.folder_id ? `/library?folder=${d.folder_id}` : "/library?folder=root")
                    }
                    className={itemClass}
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-muted">
                      <FileText className="size-4 text-muted-foreground" />
                    </span>
                    <span className="truncate">{d.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {plans.data?.length ? (
              <Command.Group heading="Lehrpläne">
                {plans.data.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`lehrplan ${p.title}`}
                    onSelect={() => select(`/lehrplaene?plan=${p.id}`)}
                    className={itemClass}
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft">
                      <ListChecks className="size-4 text-primary" />
                    </span>
                    <span className="truncate">{p.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {links.data?.length ? (
              <Command.Group heading="Links">
                {links.data.map((l) => (
                  <Command.Item
                    key={l.id}
                    value={`link ${l.title} ${l.url}`}
                    onSelect={() => window.open(l.url, "_blank", "noopener,noreferrer")}
                    className={itemClass}
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft">
                      <LinkIcon className="size-4 text-primary" />
                    </span>
                    <span className="truncate">{l.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {events.data?.length ? (
              <Command.Group heading="Termine">
                {events.data.map((e) => (
                  <Command.Item
                    key={e.id}
                    value={`termin ${e.title}`}
                    onSelect={() =>
                      select(`/kalender?date=${e.start_at.slice(0, 10)}`)
                    }
                    className={itemClass}
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft">
                      <CalendarDays className="size-4 text-primary" />
                    </span>
                    <span className="truncate">{e.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
