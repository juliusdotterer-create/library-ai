import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  FolderTree,
  CalendarDays,
  ListChecks,
  LinkIcon,
  Settings2,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LibrarySearch } from "@/components/LibrarySearch";


const NAV = [
  { to: "/library", label: "Library", icon: FolderTree },
  { to: "/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/lehrplaene", label: "Lehrpläne", icon: ListChecks },
  { to: "/links", label: "Linktree", icon: LinkIcon },
];



export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { mode, toggleMode } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen w-full">
      <LibrarySearch open={searchOpen} onOpenChange={setSearchOpen} />
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="glass mx-auto flex max-w-7xl items-center gap-2 rounded-3xl px-3 py-2">
          <div className="flex items-center gap-2 pr-2">
            <Link to="/library" aria-label="Zur Library">
              <Logo className="size-8" />
            </Link>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Library durchsuchen"
              className="hidden text-sm font-semibold tracking-tight transition-colors hover:text-primary sm:block"
            >
              Library
            </button>
          </div>



          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground glow-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            to="/einstellungen"
            title="Design"
            aria-label="Design-Einstellungen"
            className="rounded-2xl p-2 text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            <Settings2 className="size-4" />
          </Link>
          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={toggleMode}>
            {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>

        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-5">{children}</main>
    </div>
  );
}
