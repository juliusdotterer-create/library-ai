export type TimetableText = { text: string; x: number; y: number; width: number; height: number };
export type DayRegion = { x: number; y: number; width: number; height: number };
const weekdays = ["so", "mo", "di", "mi", "do", "fr", "sa"];
export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Positions are in the unscaled, top-left-origin page viewport. */
export function detectTimetableDay(items: TimetableText[], width: number, height: number, todayKey: string) {
  const today = new Date(`${todayKey}T12:00:00`);
  const range = items.map(i => i.text).join(" ").match(/(20\d{2})\s*\/\s*(20\d{2})/);
  const headers: { item: TimetableText; day: number; month: number; year?: number; weekday?: number }[] = [];
  const rows: TimetableText[][] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(r => Math.abs((r[0]?.y ?? 0) - item.y) < Math.max(3, item.height * .45));
    if (row) row.push(item); else rows.push([item]);
  }
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    for (let n = 0; n < row.length; n++) {
      const item = row[n];
      const before = row[n - 1];
      const prefix = before && item.x - (before.x + before.width) < 18 ? before.text + " " : "";
      const text = prefix + item.text;
      const match = text.match(/\b(?:(Mo(?:ntag)?|Di(?:enstag)?|Mi(?:ttwoch)?|Do(?:nnerstag)?|Fr(?:eitag)?|Sa(?:mstag)?|So(?:nntag)?)\.?\s*)?(\d{1,2})\.(\d{1,2})\.(?:(20\d{2}|\d{2})(?!\d))?/i);
      if (!match) continue;
      const day = Number(match[2]), month = Number(match[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      const weekday = match[1] ? weekdays.indexOf(match[1].slice(0, 2).toLowerCase()) : undefined;
      const year = match[4] ? (Number(match[4]) < 100 ? 2000 + Number(match[4]) : Number(match[4])) : undefined;
      headers.push({ item, day, month, year, weekday });
    }
  }
  // Ignore isolated print dates: timetable headers form a row or column with peers.
  const candidates = headers.filter(h => h.weekday !== undefined || headers.some(other => other !== h &&
    (Math.abs(other.item.x - h.item.x) < 25 || Math.abs(other.item.y - h.item.y) < 6)));
  const regions: DayRegion[] = [];
  for (const h of candidates) {
    let year = h.year;
    if (!year && range) year = h.month >= 8 ? Number(range[1]) : Number(range[2]);
    year ??= today.getFullYear();
    const date = new Date(year, h.month - 1, h.day, 12);
    if (date.getMonth() !== h.month - 1 || (h.weekday !== undefined && date.getDay() !== h.weekday)) continue;
    if (localDateKey(date) !== todayKey) continue;
    const vertical = candidates.filter(o => o !== h && Math.abs(o.item.x - h.item.x) < 25);
    const horizontal = candidates.filter(o => o !== h && Math.abs(o.item.y - h.item.y) < 6);
    if (vertical.length >= horizontal.length) {
      const gaps = vertical.map(o => Math.abs(o.item.y - h.item.y)).filter(g => g > 3);
      const step = Math.min(...gaps, h.item.height * 4);
      regions.push({ x: Math.max(0, h.item.x - 12), y: Math.max(0, h.item.y + h.item.height / 2 - step / 2), width: width - Math.max(0, h.item.x - 12) - 16, height: step });
    } else {
      const centers = horizontal.map(o => o.item.x + o.item.width / 2);
      const center = h.item.x + h.item.width / 2;
      const step = Math.min(...centers.map(c => Math.abs(c - center)), width / 5);
      regions.push({ x: Math.max(0, center - step / 2), y: Math.max(0, h.item.y - 6), width: step, height: height - h.item.y - 16 });
    }
  }
  return { regions, hasDates: candidates.length > 0 };
}
export type TodayCache = { status: "found" | "absent" | "unreadable"; pages: Record<number, DayRegion[]> };
type KV = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export const todayCacheKey = (docKey: string, date: string) => `timetable-today:${docKey}:${date}`;
export function readTodayCache(store: KV, docKey: string, date: string): TodayCache | null {
  try { return JSON.parse(store.getItem(todayCacheKey(docKey, date)) ?? "null"); } catch { return null; }
}
/** Stores today's result and drops older days of the same document. */
export function writeTodayCache(store: KV, docKey: string, date: string, value: TodayCache) {
  const prefix = `timetable-today:${docKey}:`;
  const stale: string[] = [];
  for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k?.startsWith(prefix) && k !== todayCacheKey(docKey, date)) stale.push(k); }
  stale.forEach(k => store.removeItem(k));
  try { store.setItem(todayCacheKey(docKey, date), JSON.stringify(value)); } catch { /* quota */ }
}
