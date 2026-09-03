/** Erzeugt iCalendar-Dateien (.ics) für den Export in iPhone-/Android-Kalender. */

export type IcsEvent = {
  id: string;
  title: string;
  notes?: string | null;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean | null;
};

/** Escaped Sonderzeichen gemäß RFC 5545. */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC-Zeitstempel: 20260903T180000Z */
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Lokales Datum ohne Zeit: 20260903 */
function dateStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Faltet Zeilen auf max. 75 Oktetts (RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

function eventLines(e: IcsEvent, stamp: string): string[] {
  const start = new Date(e.start_at);
  const lines: string[] = ["BEGIN:VEVENT", `UID:${e.id}@library-ai`, `DTSTAMP:${stamp}`];

  if (e.all_day) {
    const end = e.end_at ? new Date(e.end_at) : new Date(start);
    if (!e.end_at) end.setDate(end.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`, `DTEND;VALUE=DATE:${dateStamp(end)}`);
  } else {
    const end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
  }

  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
  lines.push("END:VEVENT");
  return lines;
}

/** Baut den vollständigen .ics-Inhalt für einen oder mehrere Termine. */
export function buildIcs(events: IcsEvent[]): string {
  const stamp = utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Library AI//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap((e) => eventLines(e, stamp)),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Dateiname aus einem Titel ableiten. */
export function icsFileName(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "termin"}.ics`;
}

/**
 * Bietet die .ics-Datei zum Öffnen an: auf Mobilgeräten möglichst über den
 * System-Teilen-Dialog (Kalender-App), sonst als Download.
 */
export async function downloadIcs(filename: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });

  try {
    const file = new File([blob], filename, { type: "text/calendar" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch {
    /* Teilen abgebrochen oder nicht unterstützt – Download als Fallback. */
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
