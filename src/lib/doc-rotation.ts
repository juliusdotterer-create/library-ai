import { useEffect, useState } from "react";

export type Rotation = 0 | 90 | 180 | 270;

const PREFIX = "doc-rotation:";

/** Nächste Drehung im Uhrzeigersinn (90°-Schritte). */
export function nextRotation(r: Rotation): Rotation {
  return (((r + 90) % 360) as Rotation);
}

export function parseRotation(raw: string | null): Rotation {
  const n = Number(raw);
  return n === 90 || n === 180 || n === 270 ? n : 0;
}

/**
 * Wandelt einen Punkt im gedrehten Anzeigerahmen (u,v je 0..1) in Seitenkoordinaten
 * der ungedrehten Seite um, damit Zeichnungen unabhängig von der Drehung gespeichert bleiben.
 */
export function unrotatePoint(u: number, v: number, r: Rotation): [number, number] {
  switch (r) {
    case 90:
      return [v, 1 - u];
    case 180:
      return [1 - u, 1 - v];
    case 270:
      return [1 - v, u];
    default:
      return [u, v];
  }
}

/** Drehung pro Dokument dauerhaft auf diesem Gerät merken. */
export function useDocRotation(key: string | null) {
  const [rotation, setRotation] = useState<Rotation>(0);
  useEffect(() => {
    if (!key) return setRotation(0);
    try {
      setRotation(parseRotation(window.localStorage.getItem(PREFIX + key)));
    } catch {
      setRotation(0);
    }
  }, [key]);
  const rotate = () => {
    setRotation((r) => {
      const next = nextRotation(r);
      if (key) {
        try {
          if (next === 0) window.localStorage.removeItem(PREFIX + key);
          else window.localStorage.setItem(PREFIX + key, String(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };
  return { rotation, rotate };
}
