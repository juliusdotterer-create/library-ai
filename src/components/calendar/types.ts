export type CalEvent = {
  id: string;
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  color: string | null;
  document_id: string | null;
};

export const EVENT_COLORS = ["orange", "blue", "green", "violet", "rose"] as const;
export type EventColor = (typeof EVENT_COLORS)[number];

/** Hintergrund-/Randklassen je Terminfarbe (semantische Tokens). */
export const COLOR_CLASS: Record<EventColor, { solid: string; soft: string; dot: string }> = {
  orange: { solid: "bg-event-orange", soft: "bg-event-orange/15 border-event-orange", dot: "bg-event-orange" },
  blue: { solid: "bg-event-blue", soft: "bg-event-blue/15 border-event-blue", dot: "bg-event-blue" },
  green: { solid: "bg-event-green", soft: "bg-event-green/15 border-event-green", dot: "bg-event-green" },
  violet: { solid: "bg-event-violet", soft: "bg-event-violet/15 border-event-violet", dot: "bg-event-violet" },
  rose: { solid: "bg-event-rose", soft: "bg-event-rose/15 border-event-rose", dot: "bg-event-rose" },
};

export function colorOf(e: { color: string | null }) {
  const c = (EVENT_COLORS as readonly string[]).includes(e.color ?? "") ? (e.color as EventColor) : "orange";
  return COLOR_CLASS[c];
}

/** Ende eines Termins; ohne Ende 60 Minuten. */
export function endOf(e: CalEvent): Date {
  const s = new Date(e.start_at);
  const end = e.end_at ? new Date(e.end_at) : null;
  return end && end > s ? end : new Date(s.getTime() + 60 * 60000);
}

/** Verteilt überlappende Termine eines Tages auf Spalten. */
export function layoutDay(list: CalEvent[]) {
  const sorted = [...list].sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
  const out: { e: CalEvent; col: number; cols: number }[] = [];
  let cluster: { e: CalEvent; col: number; cols: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const n = colEnds.length;
    cluster.forEach((c) => (c.cols = n));
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const e of sorted) {
    const s = +new Date(e.start_at);
    const en = +endOf(e);
    if (cluster.length && s >= clusterEnd) flush();
    let col = colEnds.findIndex((t) => t <= s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(en);
    } else colEnds[col] = en;
    cluster.push({ e, col, cols: 1 });
    clusterEnd = Math.max(cluster.length === 1 ? 0 : clusterEnd, en);
  }
  if (cluster.length) flush();
  return out;
}
