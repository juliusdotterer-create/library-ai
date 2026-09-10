import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/hooks/useLibraryView";

export function LibrarySkeleton({ view }: { view: ViewMode }) {
  return (
    <div
      className={cn(
        view === "grid"
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : "flex flex-col gap-2",
      )}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "glass flex items-center gap-3",
            view === "grid" ? "rounded-3xl p-4" : "rounded-2xl px-4 py-2",
          )}
        >
          <Skeleton
            className={cn(
              "shrink-0 rounded-2xl",
              view === "grid" ? "size-10" : "size-8",
            )}
          />
          <Skeleton className="h-4 flex-1 rounded-xl" />
          <Skeleton className="size-8 shrink-0 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export function LinkSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-3xl p-4">
          <Skeleton className="size-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3 rounded-xl" />
            <Skeleton className="h-3 w-1/3 rounded-xl" />
          </div>
          <Skeleton className="size-9 shrink-0 rounded-2xl" />
          <Skeleton className="size-9 shrink-0 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-soft flex items-start gap-3 rounded-2xl p-3">
          <Skeleton className="h-20 w-1 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pl-2">
            <Skeleton className="h-3 w-16 rounded-xl" />
            <Skeleton className="h-4 w-3/4 rounded-xl" />
            <Skeleton className="h-3 w-1/2 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrashSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-soft flex items-center gap-3 rounded-2xl p-3">
          <Skeleton className="size-10 shrink-0 rounded-2xl" />
          <Skeleton className="h-4 flex-1 rounded-xl" />
          <Skeleton className="size-8 shrink-0 rounded-2xl" />
          <Skeleton className="size-8 shrink-0 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
