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
  WifiOff,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LibrarySearch } from "@/components/LibrarySearch";
import { GlobalTimerWatcher, HeaderTimers } from "@/components/GlobalTimer";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";



const NAV = [
  { to: "/library", label: "Library", icon: FolderTree },
  { to: "/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/lehrplaene", label: "Lehrpläne", icon: ListChecks },
  { to: "/links", label: "Linktree", icon: LinkIcon },
];



export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion();
  const { mode, toggleMode } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnlineStatus();
  const onLehrplaene = path.startsWith("/lehrplaene");
  const activeMobileIndex = NAV.findIndex((item) => path.startsWith(item.to));


  return (
    <div className="min-h-screen w-full max-w-[100dvw] overflow-x-clip">
      <LibrarySearch open={searchOpen} onOpenChange={setSearchOpen} />
      <GlobalTimerWatcher />
      <header className="sticky top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
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
            <kbd className="sr-only rounded-xl bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              ⌘K
            </kbd>
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
            {!online && (
              <span
                title="Keine Verbindung – gespeicherte Inhalte bleiben nutzbar"
                className="flex items-center gap-1.5 rounded-2xl bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                <WifiOff className="size-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
            {!onLehrplaene && <HeaderTimers />}
          </div>


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

      <main className="mx-auto w-full max-w-7xl px-3 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 md:pb-6">{children}</main>

      {/* Mobile: kompakte Icon-Leiste am unteren Bildschirmrand */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="liquid-nav-shell mx-auto grid h-16 max-w-md grid-cols-4 place-items-stretch overflow-hidden rounded-[2rem] p-1">
          {activeMobileIndex >= 0 && (
            <motion.div
              aria-hidden="true"
              className="liquid-nav-lens pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] origin-center transform-gpu will-change-transform rounded-[1.4rem]"
              initial={false}
              animate={{
                x: `${activeMobileIndex * 100}%`,
                scaleX: reduceMotion ? 1 : [1, 1.06, 1],
                opacity: 1,
              }}
              transition={
                reduceMotion
                  ? { duration: 0.12 }
                  : {
                      x: { type: "spring", stiffness: 320, damping: 30, mass: 0.78 },
                      scaleX: { duration: 0.32, times: [0, 0.5, 1], ease: "easeInOut" },
                      opacity: { duration: 0.16 },
                    }
              }
            >
              <span className="liquid-nav-lens-glare absolute inset-0 rounded-[inherit]" />
              <span className="liquid-nav-lens-refraction absolute inset-0 rounded-[inherit]" />
            </motion.div>
          )}
          {NAV.map((item) => {
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 grid h-full w-full min-w-0 place-items-center rounded-[1.4rem] p-0 transition-colors duration-200 active:scale-95",
                  active
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("block size-5 shrink-0 transition-transform duration-200", active && "scale-105")} />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
