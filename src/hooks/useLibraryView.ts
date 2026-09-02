import { useEffect, useState } from "react";

export type SortKey = "name-asc" | "name-desc" | "date-desc" | "date-asc";
export type ViewMode = "grid" | "list";

export const SORT_LABELS: Record<SortKey, string> = {
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  "date-desc": "Neueste zuerst",
  "date-asc": "Älteste zuerst",
};

const SORT_STORAGE = "library:sort";
const VIEW_STORAGE = "library:view";

/** Sortierung und Ansicht der Library, pro Gerät gespeichert. */
export function useLibraryView() {
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    const s = localStorage.getItem(SORT_STORAGE) as SortKey | null;
    if (s && s in SORT_LABELS) setSort(s);
    const v = localStorage.getItem(VIEW_STORAGE) as ViewMode | null;
    if (v === "grid" || v === "list") setView(v);
  }, []);

  const changeSort = (s: SortKey) => {
    setSort(s);
    localStorage.setItem(SORT_STORAGE, s);
  };
  const changeView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_STORAGE, v);
  };

  return { sort, view, setSort: changeSort, setView: changeView };
}

/** Sortiert Ordner bzw. Dateien nach der gewählten Reihenfolge. */
export function sortItems<T extends { name: string; created_at?: string | null }>(
  items: T[] | undefined,
  sort: SortKey,
): T[] {
  if (!items) return [];
  const copy = [...items];
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "de", { sensitivity: "base" });
  const byDate = (a: T, b: T) =>
    new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();

  switch (sort) {
    case "name-desc":
      return copy.sort((a, b) => byName(b, a));
    case "date-desc":
      return copy.sort((a, b) => byDate(b, a));
    case "date-asc":
      return copy.sort(byDate);
    default:
      return copy.sort(byName);
  }
}
