# Fließtext in Notizen + PDF-Export als Popup

## Was sich ändert

**1. Fließtext zurück in den Notizen**

- In der Notizen-Leiste kommt ein Umschalter „Handschrift / Text“.
- Jede Notizseite bekommt zusätzlich ein Textfeld. Im Text-Modus schreibst du normalen Fließtext, im Handschrift-Modus zeichnest du wie bisher.
- Text wird pro Seite gespeichert, mit demselben Auto-Save wie die Striche (kein Verlust beim Seitenwechsel oder Schließen).
- Gilt für freie Notizen und für Notizen neben einem Dokument.
- Beim PDF-Export wird der Text der Seite mit ausgegeben (unter bzw. hinter der Handschrift derselben Seite).

**2. PDF-Export nicht mehr verdeckt**

- Das Aufklappmenü „Als PDF exportieren“ wird durch ein Popup-Fenster (Dialog) ersetzt, das mittig über der Notiz erscheint und nicht mehr vom Overlay-Rand abgeschnitten wird.
- Im Popup: „PDF herunterladen“ und „PDF in Library speichern“, plus Abbrechen.

## Technische Umsetzung

- Migration: `public.notebook_pages` erhält `text text not null default ''`; bestehende Zeilen bleiben unverändert (Grants/RLS der Tabelle gelten weiter).
- `src/components/DocumentNotes.tsx`:
  - `Page` um `text` erweitert, Laden/Anlegen der Seiten liest und schreibt das Feld; Auto-Save-Schleife aktualisiert `strokes` und `text` gemeinsam.
  - Neuer Zustand `mode: 'draw' | 'text'` (Toggle-Buttons in der Leiste); im Text-Modus rendert ein `Textarea` statt `HandwritingCanvas`.
  - Der bestehende `DropdownMenu` für den PDF-Export wird durch einen zweiten `Dialog` ersetzt (gleiche zwei Aktionen).
- `src/lib/notes-pdf.ts`: `notesToPdfBlob` nimmt Seiten als `{ strokes, text }` entgegen und schreibt vorhandenen Text mit `pdf.text(...)` inklusive Zeilenumbruch in die Seite.
- Keine Änderungen an Seitenwechsel, Slider, Timer, Speichern-als-Notiz oder Library-Integration.
