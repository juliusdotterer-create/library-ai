import { useEffect, useMemo, useRef, useState } from "react";

/** Mehrteilige Endungen, bei denen die Hauptdomain drei Labels hat. */
const MULTI_TLD = new Set([
  "co.uk",
  "ac.uk",
  "org.uk",
  "gov.uk",
  "com.au",
  "co.nz",
  "co.jp",
  "com.br",
  "co.za",
]);

/** Liefert die registrierbare Hauptdomain zu einem Host. */
export function mainDomain(host: string) {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  const take = MULTI_TLD.has(lastTwo) ? 3 : 2;
  return parts.slice(-take).join(".");
}

function buildSources(host: string) {
  const root = mainDomain(host);
  const list = [
    `https://www.google.com/s2/favicons?sz=128&domain=${host}`,
    root !== host ? `https://www.google.com/s2/favicons?sz=128&domain=${root}` : null,
    root !== host ? `https://icons.duckduckgo.com/ip3/${root}.ico` : null,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://${host}/favicon.ico`,
  ];
  return list.filter((s): s is string => Boolean(s));
}

/**
 * Prüft, ob ein geladenes Icon nur ein generischer Platzhalter ist
 * (leer, einfarbig oder das graue DuckDuckGo-/Google-Ersatzbild).
 * Bei Cross-Origin-Sperren wird das Bild akzeptiert.
 */
function looksGeneric(img: HTMLImageElement) {
  if (!img.naturalWidth || !img.naturalHeight) return true;
  // Google liefert für unbekannte Domains ein 16x16-Standardsymbol.
  if (img.naturalWidth <= 16 && img.src.includes("google.com/s2/favicons")) return true;
  try {
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let visible = 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const rs: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 24) continue;
      visible++;
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      rs.push(data[i]);
    }
    if (visible < 8) return true; // praktisch leeres Bild
    const rAvg = rSum / visible;
    const gAvg = gSum / visible;
    const bAvg = bSum / visible;
    // Graustufig + wenig Kontrast => generischer Platzhalter (grauer Pfeil/Globus)
    const grey = Math.abs(rAvg - gAvg) < 8 && Math.abs(gAvg - bAvg) < 8;
    const variance = rs.reduce((acc, v) => acc + (v - rAvg) ** 2, 0) / rs.length;
    return grey && variance < 900;
  } catch {
    return false; // Canvas durch CORS gesperrt: Bild so akzeptieren
  }
}

/**
 * Zeigt das echte Logo/Favicon einer Website.
 * Probiert mehrere Quellen inkl. Hauptdomain-Fallback durch – zuletzt erscheint
 * der Anfangsbuchstabe, nie ein generisches Globus-/Pfeil-Icon.
 */
export function LinkLogo({
  host,
  title,
  className = "size-7",
}: {
  host: string;
  title?: string;
  className?: string;
}) {
  const sources = useMemo(() => (host ? buildSources(host) : []), [host]);
  const [idx, setIdx] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => setIdx(0), [host]);

  const initial = (title?.trim() || host || "?").charAt(0).toUpperCase();

  if (!host || idx >= sources.length) {
    return (
      <span
        className={`${className} flex items-center justify-center rounded-md text-sm font-semibold text-primary`}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      ref={imgRef}
      key={sources[idx]}
      src={sources[idx]}
      alt={`${host} Logo`}
      loading="lazy"
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      className={`${className} rounded-md object-contain`}
      onLoad={(e) => {
        if (looksGeneric(e.currentTarget)) setIdx((i) => i + 1);
      }}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
