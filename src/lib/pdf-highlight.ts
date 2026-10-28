/**
 * Findet Trefferrechtecke eines Suchbegriffs auf einer pdf.js-Seite.
 * Koordinaten liegen im Viewport-System (CSS-Pixel der übergebenen Skalierung).
 */
export type HighlightRect = { x: number; y: number; w: number; h: number };

/** Normalisiert Text für den Vergleich (Kleinschreibung, Ligaturen, Diakritika). */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\u00ad/g, "")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/[’'`´]/g, "'");
}

/** Kurze Paragraphennummern bleiben erhalten; Zahlen werden vollständig markiert. */
export function highlightTokens(term: string): string[] {
  return Array.from(
    new Set(
      normalize(term)
        .replace(/(\p{N})(\p{L})/gu, "$1 $2")
        .replace(/(\p{L})(\p{N})/gu, "$1 $2")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 2 || /\d/.test(t)),
    ),
  );
}

type TextItem = {
  str: string;
  width: number;
  height: number;
  transform: number[];
};

type PdfPage = {
  getTextContent: () => Promise<{ items: unknown[] }>;
};

type Viewport = { transform: number[]; scale: number };

/** Multipliziert zwei 2D-Transformationsmatrizen (pdf.js-Format). */
function mul(m1: number[], m2: number[]): number[] {
  return [
    (m1[0] ?? 0) * (m2[0] ?? 0) + (m1[2] ?? 0) * (m2[1] ?? 0),
    (m1[1] ?? 0) * (m2[0] ?? 0) + (m1[3] ?? 0) * (m2[1] ?? 0),
    (m1[0] ?? 0) * (m2[2] ?? 0) + (m1[2] ?? 0) * (m2[3] ?? 0),
    (m1[1] ?? 0) * (m2[2] ?? 0) + (m1[3] ?? 0) * (m2[3] ?? 0),
    (m1[0] ?? 0) * (m2[4] ?? 0) + (m1[2] ?? 0) * (m2[5] ?? 0) + (m1[4] ?? 0),
    (m1[1] ?? 0) * (m2[4] ?? 0) + (m1[3] ?? 0) * (m2[5] ?? 0) + (m1[5] ?? 0),
  ];
}

/**
 * Liefert alle Trefferrechtecke der Tokens auf einer Seite.
 * Gibt ein leeres Array zurück, wenn die Seite keine Textebene hat (Scan).
 */
export async function findHighlights(
  page: PdfPage,
  viewport: Viewport,
  tokens: string[],
): Promise<HighlightRect[]> {
  if (!tokens.length) return [];
  let content: { items: unknown[] };
  try {
    content = await page.getTextContent();
  } catch {
    return [];
  }

  const rects: HighlightRect[] = [];
  for (const raw of content.items) {
    const item = raw as Partial<TextItem>;
    const str = typeof item.str === "string" ? item.str : "";
    if (!str.trim() || !Array.isArray(item.transform)) continue;

    const hay = normalize(str);
    const m = mul(viewport.transform, item.transform);
    const scale = viewport.scale || 1;
    const width = (item.width ?? 0) * scale;
    const height = Math.max(4, (item.height ?? 0) * scale || Math.hypot(m[1] ?? 0, m[3] ?? 0));
    const left = m[4] ?? 0;
    const baseline = m[5] ?? 0;
    const perChar = hay.length > 0 ? width / hay.length : 0;

    for (const token of tokens) {
      const compactHay = hay.replace(/\s/g, "");
      const compactToken = token.replace(/\s/g, "");
      if (!compactToken) continue;
      const offsets = Array.from(hay).flatMap((c, i) => /\s/.test(c) ? [] : [i]);
      let from = 0;
      for (;;) {
        const compactAt = compactHay.indexOf(compactToken, from);
        if (compactAt === -1) break;
        const at = offsets[compactAt] ?? 0;
        const end = (offsets[compactAt + compactToken.length - 1] ?? at) + 1;
        if (/\d/.test(token) && (/\p{N}/u.test(compactHay[compactAt - 1] ?? "") || /\p{N}/u.test(compactHay[compactAt + compactToken.length] ?? ""))) {
          from = compactAt + compactToken.length;
          continue;
        }
        rects.push({
          x: left + at * perChar,
          y: baseline - height,
          w: Math.max(2, (end - at) * perChar),
          h: height * 1.15,
        });
        from = compactAt + compactToken.length;
      }
    }
  }
  return rects;
}
