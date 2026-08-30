# Suchbegriff im PDF farblich hervorheben

Wenn du über das Library-Symbol oben links nach Text suchst und einen Treffer öffnest, springt die Vorschau heute nur auf die richtige Seite. Künftig wird der gesuchte Begriff zusätzlich direkt im PDF gelb markiert – auf allen Seiten, auf denen er vorkommt.

## Was du sehen wirst

- Treffer aus der Volltextsuche öffnen das PDF auf der Trefferseite, der Suchbegriff ist dort gelb hinterlegt.
- In der Kopfzeile der Vorschau erscheint ein kleiner Treffer-Zähler mit Pfeilen ("‹ 3/12 ›"), um zwischen den Fundstellen zu springen; der aktuelle Treffer wird kräftiger (orange) markiert.
- Ein X im Zähler blendet die Markierung aus.
- Die Markierung liegt unter Notizen/Zeichnungen, stört also weder Stift noch Textmarker.

## Umfang

- Gilt für PDFs mit echter Textebene. Bei reinen Scans (nur per Texterkennung indexiert) gibt es keine Wortkoordinaten – dort bleibt es beim Seitensprung, mit kurzem Hinweis "In Scans keine Markierung möglich".
- Nur für Treffer aus der Volltextsuche; eine eigene Suchleiste innerhalb der Vorschau ist nicht Teil dieses Plans.

## Technische Umsetzung

1. `PreviewDoc` (in `src/components/DocumentPreview.tsx`) bekommt ein optionales Feld `highlight?: string | null`; `src/components/LibrarySearch.tsx` gibt beim Öffnen eines Inhaltstreffers den Suchbegriff mit (Name-/Ordner-Treffer ohne Begriff).
2. `DocumentPreview` reicht `highlight` an `PdfAnnotator` und `PdfCanvasViewer` weiter.
3. Neues Modul `src/lib/pdf-highlight.ts`: nimmt eine pdf.js-Seite plus Suchbegriff und liefert Rechtecke im Viewport-Koordinatensystem. Umsetzung über `page.getTextContent()`, Zusammenbau des Seitentexts aus den Items, normalisiertes Matching (Kleinschreibung, Umlaute/Ligaturen, Bindestrich-Umbrüche) und Rückrechnung der Zeichenposition auf Item-Transformationen (`item.transform`, `width`, `height`). Suchbegriff wird wie in `src/lib/library.functions.ts` in Tokens (>2 Zeichen) zerlegt.
4. `PdfAnnotator`: zusätzliche, nicht interaktive Canvas-Ebene (bzw. absolut positionierte Divs) zwischen Seiten-Canvas und Annotations-Overlay. Treffer-Rechtecke werden beim Rendern/Zoomen mit der jeweiligen `scale` neu berechnet und gezeichnet (gelb, `globalAlpha` ~0.35; aktiver Treffer in der Akzentfarbe).
5. `PdfCanvasViewer`: gleiche Logik, die Rechtecke werden nach dem `page.render()` direkt auf ein zweites, über dem Seiten-Canvas liegendes Canvas gemalt (Container wird dafür auf `position: relative` pro Seite umgestellt).
6. Treffer-Navigation: gemeinsamer State (Liste aller Treffer mit Seite + Index) in `DocumentPreview`, Zähler-UI in der bestehenden Kopfzeile, Sprung per `scrollIntoView` auf das Seitenelement und Scroll-Offset zum Rechteck.
