import { useEffect, useState, useSyncExternalStore } from "react";

export type StudyTimer = {
  id: string;
  label: string;
  /** epoch ms when the timer ends (only meaningful while running) */
  endsAt: number;
  /** remaining ms while paused */
  remaining: number;
  running: boolean;
  done: boolean;
};

const KEY = "library.timers";

let timers: StudyTimer[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function read(): StudyTimer[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StudyTimer[]) : [];
  } catch {
    return [];
  }
}

function emit() {
  for (const l of listeners) l();
}

export function loadTimers() {
  if (typeof window === "undefined") return;
  timers = read();
  loaded = true;
  emit();
}

export function setTimers(next: StudyTimer[]) {
  timers = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!loaded) loadTimers();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) loadTimers();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: StudyTimer[] = [];

export function useTimers() {
  return useSyncExternalStore(
    subscribe,
    () => timers,
    () => EMPTY,
  );
}

/** re-render every 500ms so countdowns update */
export function useTick(ms = 500) {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}

export function remainingOf(t: StudyTimer) {
  return t.running ? t.endsAt - Date.now() : t.remaining;
}

export function isExpired(t: StudyTimer) {
  return remainingOf(t) <= 0;
}

export function fmt(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function toggleTimer(id: string) {
  setTimers(
    timers.map((x) =>
      x.id !== id
        ? x
        : x.running
          ? { ...x, running: false, remaining: Math.max(0, x.endsAt - Date.now()) }
          : { ...x, running: true, done: false, endsAt: Date.now() + Math.max(1000, x.remaining) },
    ),
  );
}

export function extendTimer(id: string, min: number) {
  setTimers(
    timers.map((x) =>
      x.id !== id
        ? x
        : x.running
          ? { ...x, done: false, endsAt: Math.max(Date.now(), x.endsAt) + min * 60_000 }
          : { ...x, done: false, remaining: Math.max(0, x.remaining) + min * 60_000 },
    ),
  );
}

export function removeTimer(id: string) {
  setTimers(timers.filter((x) => x.id !== id));
}

export function addTimer(label: string, minutes: number) {
  const ms = Math.max(1, minutes) * 60_000;
  setTimers([
    ...timers,
    {
      id: crypto.randomUUID(),
      label: label.trim() || "Lernzeit",
      endsAt: Date.now() + ms,
      remaining: ms,
      running: true,
      done: false,
    },
  ]);
}

export function acknowledgeTimer(id: string) {
  setTimers(
    timers.map((x) => (x.id === id ? { ...x, running: false, remaining: 0, done: true } : x)),
  );
}
