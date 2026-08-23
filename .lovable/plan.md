# Bilder & Excel-Dateien in der Vorschau anzeigen

## Ziel
JPG/PNG (und weitere Bildformate) sowie XLSX/XLS/CSV sollen direkt im Vorschau-Popup angezeigt werden, statt nur einen Download-Hinweis zu zeigen.

## Was passiert

### 1. Bilder zuverlässig erkennen
Bilder werden heute nur angezeigt, wenn beim Upload ein korrekter MIME-Typ gespeichert wurde. Fehlt der (kommt bei Ordner-Importen und alten Dateien oft vor), landet die Datei in der "keine Vorschau"-Ansicht.

- Erkennung zusätzlich über die Dateiendung: jpg, jpeg, png, gif, webp, avif, bmp, svg, heic/heif.
- Bildansicht bekommt Zoom (Buttons + Mausrad/Pinch) und Verschieben, damit gescannte Seiten lesbar sind.
- HEIC bleibt ohne Browser-Unterstützung: klarer Hinweis plus Download.

### 2. Excel-Vorschau (neu)
Neue Komponente, die Tabellen im Popup rendert:

- Unterstützt .xlsx, .xlsm, .xls sowie .csv.
- Tabellenblätter als Reiter oben, wenn mehrere Blätter existieren.
- Anzeige als scrollbare Tabelle mit fixierter Kopfzeile, im bestehenden Glass-Design.
- Zahlen-/Datumsformate aus der Datei werden übernommen; leere Randzeilen/-spalten werden abgeschnitten.
- Sehr große Blätter werden auf die ersten ca. 2.000 Zeilen begrenzt, mit Hinweiszeile und Download-Option.
- Fehlerfall (defekte/passwortgeschützte Datei): verständliche Meldung + Download-Button.

### 3. Einbindung
Das Vorschau-Popup routet Tabellen-Dateien auf die neue Komponente, Bilder auf die erweiterte Bildansicht. Notizen-Splitview, Timer-Anzeige und Download-Button bleiben unverändert nutzbar.

## Technische Details
- Neues Paket `xlsx` (SheetJS) für das Parsen im Browser.
- Neue Datei `src/components/SheetViewer.tsx`; Bildansicht als kleine Komponente `src/components/ImageViewer.tsx`.
- Erkennungs-Helfer (MIME + Endung) zentral in `src/components/DocumentPreview.tsx` bzw. `src/lib/utils.ts`, damit Library-Icons und Vorschau dieselbe Logik nutzen.
- Parsen mit `{ cellDates: true, cellStyles: false }`, Rendering über `sheet_to_json({ header: 1, raw: false })`.
- Kein Backend-Aufwand: alles läuft clientseitig auf der signierten Datei-URL.
