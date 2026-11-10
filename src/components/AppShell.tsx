import { Link, useRouterState } from "@tanstack/react-router";
import {
  FolderTree,
  CalendarDays,
  ListChecks,
  LinkIcon,
  CircleUserRound,
  Moon,
  Sun,
  Search,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

/** Abstand der schwebenden Leiste zum oberen Bildschirmrand (inkl. Notch). */
const TOP_GAP = "max(0.75rem, env(safe-area-inset-top))";



export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion();
  const { mode, toggleMode } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnlineStatus();
  const onLehrplaene = path.startsWith("/lehrplaene");
  const activeMobileIndex = NAV.findIndex((item) => path.startsWith(item.to));

  // Obere Leiste hängt sich oben an, sobald man aus dem Startbereich scrollt.
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    const read = () => {
      const y = document.scrollingElement?.scrollTop ?? window.scrollY;
      setDocked((prev) => {
        if (y > 12) return true;
        if (y < 4) return false;
        return prev;
      });
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, [path]);


  return (
    <div className="min-h-screen w-full max-w-[100dvw] overflow-x-clip">
      <LibrarySearch open={searchOpen} onOpenChange={setSearchOpen} />
      <GlobalTimerWatcher />
      <header className="sticky top-0 z-40" style={{ height: `calc(${TOP_GAP} + 3.375rem)` }}>
        <div
          className={cn(
            "absolute bottom-0 flex items-center",
            !reduceMotion &&
              "transition-[top,left,right,border-radius,background-color,box-shadow,border-color] duration-300 ease-out",
            docked
              ? "glass-docked inset-x-0 rounded-b-[1.75rem] rounded-t-none"
              : "glass inset-x-3 rounded-full sm:inset-x-5",
          )}
          style={{ top: docked ? 0 : TOP_GAP }}
        >
          <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 pr-2">
            {/*
              Logo verwandelt sich beim Darüberfahren in eine Lupe (öffnet die Suche, auch per ⌘K).
              Beide Ebenen haben anfangs exakt Größe und Form des Logos: die Fläche wird überblendet
              und rundet sich dabei zum Kreis, das Ordner-Symbol weicht, die Lupe gleitet nach.
            */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Library durchsuchen (⌘K)"
              aria-label="Library durchsuchen"
              className="group relative grid size-9 shrink-0 place-items-center rounded-full outline-none"
            >
              <span
                className={cn(
                  "absolute inset-0 transform-gpu will-change-[transform,opacity]",
                  "transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "group-hover:scale-[0.92] group-hover:opacity-0 group-focus-visible:scale-[0.92] group-focus-visible:opacity-0",
                  "motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:group-hover:scale-100",
                )}
              >
                <Logo className="size-9 drop-shadow-sm" />
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "glass-tinted absolute inset-0 grid place-items-center rounded-[28%] opacity-0 transform-gpu will-change-[transform,opacity,border-radius]",
                  "transition-[transform,opacity,border-radius] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "group-hover:rounded-[50%] group-hover:opacity-100 group-focus-visible:rounded-[50%] group-focus-visible:opacity-100",
                  "motion-reduce:transition-opacity motion-reduce:duration-200",
                )}
              >
                <Search
                  strokeWidth={2.4}
                  className={cn(
                    "size-[1.05rem] -rotate-45 scale-50 opacity-0 transform-gpu",
                    "transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "group-hover:rotate-0 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-[60ms]",
                    "group-focus-visible:rotate-0 group-focus-visible:scale-100 group-focus-visible:opacity-100",
                    "motion-reduce:rotate-0 motion-reduce:scale-100 motion-reduce:transition-opacity",
                  )}
                />
              </span>
            </button>
            <kbd className="sr-only rounded-xl bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              ⌘K
            </kbd>
          </div>


          <span className="font-serif text-lg font-medium tracking-tight">Library</span>

          <nav className="glass-soft mx-auto hidden items-center gap-0.5 overflow-x-auto rounded-full p-1 md:flex">
            {NAV.map((item) => {
              const active = path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "glass-tinted"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
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
            className="rounded-full p-2 text-muted-foreground/70 transition-colors hover:bg-accent/70 hover:text-foreground"
          >
            <CircleUserRound className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-full text-muted-foreground/70 hover:text-foreground md:inline-flex"
            onClick={toggleMode}
          >
            {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-5 md:pb-6">{children}</main>

      {/* Mobile: kompakte Icon-Leiste am unteren Bildschirmrand */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="liquid-nav-shell grid h-[3.75rem] w-full min-w-0 max-w-md grid-cols-4 place-items-stretch overflow-hidden rounded-full p-1">
          {activeMobileIndex >= 0 && (
            <motion.div
              aria-hidden="true"
              className="liquid-nav-lens pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] origin-center transform-gpu will-change-transform rounded-full"
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
                  "relative z-10 flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full p-0 transition-colors duration-200 active:scale-95",
                  active
                    ? "text-primary"
                    : "text-foreground/70",
                )}
              >
                <item.icon className={cn("block size-[1.3rem] shrink-0 transition-transform duration-200", active && "scale-105")} />
                <span className="max-w-full truncate px-1 text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
