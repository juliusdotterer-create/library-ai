# Vorschau für restliche Dateitypen

## Ziel
Die Vorschau abrunden, damit alle gängigen Alltags-Dateien direkt im Popup lesbar sind.

## Was gebaut wird

### 1. PowerPoint (.pptx) – neu
- Text-Vorschau pro Folie: Folientitel + Inhalte als nummerierte Karten im Glass-Design, Folien-Navigation oben.
- Umsetzung: pptx = ZIP mit XML; clientseitig entpacken (JSZip), Folientexte aus `slide*.xml` extrahieren, in Reihenfolge anzeigen.
- Ehrliche Grenze: Layout/Bilder/Animationen werden nicht 1:1 gerendert – dafür Download-Button. Altes .ppt (binär) bekommt Hinweis + Download.

### 2. Audio & Video
- mp3, wav, m4a, ogg → natives `<audio controls>`-Element im Popup.
- mp4, webm, mov (soweit Browser kann) → natives `<video controls>`-Element.
- Kein externes Paket nötig.

### 3. OpenDocument (.odt/.ods)
- .ods: über vorhandenes `xlsx`-Paket mitladen (SheetJS liest .ods) → SheetViewer.
- .odt: Text extrahieren (ZIP + content.xml) → einfache formatierte HTML-Ansicht wie bei .doc.

### 4. Verbesserte Text-/Fallback-Anzeige
- .rtf als eigenes Format: vorhandener RTF-Reader aus dem .doc-Pfad wiederverwenden.
- .zip und sonstige Binärformate: aufgeräumte Fallback-Karte mit Dateiname, Typ und großem Download-Button (statt generischem Hinweis).

### Nicht Teil dieses Plans
- HEIC-Konvertierung (kein Browser-Support; Hinweis bleibt)
- .epub, .eml/.msg, natives .ppt (binär), CAD/Photoshop-Formate – bleiben Download-only.

## Technische Details
- Neues Paket: `jszip` (clientseitig, für pptx/odt). `xlsx` ist bereits installiert.
- Neue Komponenten: `PptxViewer.tsx`, `MediaViewer.tsx`, `OdtViewer.tsx`; Routing in `DocumentPreview.tsx` über Endung + MIME wie bisher.
- Alles clientseitig auf der signierten Datei-URL, kein Backend-Aufwand.
