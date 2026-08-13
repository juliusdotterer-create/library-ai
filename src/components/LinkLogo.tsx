import { useEffect, useMemo, useState } from "react";

/**
 * Zeigt das echte Logo/Favicon einer Website.
 * Probiert mehrere Quellen der Reihe nach durch – erst als letzte
 * Rückfallebene erscheint der Anfangsbuchstabe (kein generisches Globus-Icon).
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
  const sources = useMemo(() => {
    if (!host) return [];
    return [
      `https://logo.clearbit.com/${host}?size=128`,
      `https://icons.duckduckgo.com/ip3/${host}.ico`,
      `https://www.google.com/s2/favicons?sz=128&domain=${host}`,
      `https://${host}/favicon.ico`,
    ];
  }, [host]);

  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [host]);

  const initial = (title?.trim() || host || "?").charAt(0).toUpperCase();

  if (!host || idx >= sources.length) {
    return (
      <span className={`${className} flex items-center justify-center rounded-md text-sm font-semibold text-primary`}>
        {initial}
      </span>
    );
  }

  return (
    <img
      key={sources[idx]}
      src={sources[idx]}
      alt={`${host} Logo`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${className} rounded-md object-contain`}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
