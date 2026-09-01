import { Link, useRouterState } from "@tanstack/react-router";
import {
  FolderTree,
  CalendarDays,
  ListChecks,
  LinkIcon,
  CircleUserRound,
  Bot,
  Moon,
  Sun,
  Search,
  Globe,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LibrarySearch } from "@/components/LibrarySearch";
import { WebFrameOverlay } from "@/components/WebFrameOverlay";
import { GlobalTimerWatcher, HeaderTimers } from "@/components/GlobalTimer";



const NAV = [
  { to: "/library", label: "Library", icon: FolderTree },
  { to: "/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/lehrplaene", label: "Lehrpläne", icon: ListChecks },
  { to: "/links", label: "Linktree", icon: LinkIcon },
];



export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { mode, toggleMode } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [webOpen, setWebOpen] = useState(false);
  const onLehrplaene = path.startsWith("/lehrplaene");

  return (
    <div className="min-h-screen w-full">
      <LibrarySearch open={searchOpen} onOpenChange={setSearchOpen} />
      <WebFrameOverlay open={webOpen} onClose={() => setWebOpen(false)} />
      <GlobalTimerWatcher />

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="glass mx-auto flex max-w-7xl items-center gap-2 rounded-3xl px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Library durchsuchen"
              aria-label="Library durchsuchen"
              className="relative rounded-2xl transition-transform hover:scale-105"
            >
              <Logo className="size-8 shrink-0" />
              <span className="hidden absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-background shadow-sm">
                <Search className="size-3 text-primary" />
              </span>
            </button>
          </div>


          <nav className="hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
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

          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
            {!onLehrplaene && <HeaderTimers />}
          </div>

          <Link
            to="/connect"
            title="Mit Agent verbinden"
            aria-label="Mit Agent verbinden"
            className={cn(
              "rounded-2xl p-2 transition-colors",
              path.startsWith("/connect")
                ? "text-primary"
                : "text-muted-foreground/40 hover:text-foreground",
            )}
          >
            <Bot className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setWebOpen(true)}
            title="Web-Fenster"
            aria-label="Web-Fenster"
            className="rounded-2xl p-2 text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            <Globe className="size-4" />
          </button>
          <Link

            to="/einstellungen"
            title="Profil & Einstellungen"
            aria-label="Profil & Einstellungen"
            className="rounded-2xl p-2 text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            <CircleUserRound className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-2xl text-muted-foreground/40 hover:text-foreground md:inline-flex"
            onClick={toggleMode}
          >
            {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-6 pb-24 sm:px-5 md:pb-6">{children}</main>

      {/* Mobile: kompakte Icon-Leiste am unteren Bildschirmrand */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 md:hidden">
        <div className="glass mx-auto flex max-w-md items-center justify-around rounded-3xl px-2 py-2">
          {NAV.map((item) => {
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "rounded-2xl p-3 transition-all",
                  active
                    ? "bg-primary text-primary-foreground glow-primary"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
