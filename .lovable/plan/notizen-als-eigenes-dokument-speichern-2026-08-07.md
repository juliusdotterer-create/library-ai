# Notizen als eigenes Dokument speichern

Handschriftliche Notizen bekommen einen Speichern-Knopf. Die Notiz erscheint danach als eigener Eintrag in der Library – weiterhin handschriftlich bearbeitbar – und lässt sich zusätzlich als PDF exportieren.

## Verhalten

- In der Notizen-Leiste (im Dokument-Split und in den freien Notizen) gibt es zwei neue Aktionen:
  - **Speichern als Notiz**: fragt nach einem Namen (Vorschlag: „Notizen – <Dokumentname>“ bzw. „Notiz <Datum>“) und legt einen Library-Eintrag an.
  - **Als PDF exportieren**: rendert alle Notizseiten als PDF und lädt es herunter; optional wird das PDF zusätzlich als normale Datei in der Library abgelegt.
- Speicherort: der aktuell geöffnete Library-Ordner. Bei Notizen zu einem Dokument der Ordner dieses Dokuments.
- Erneutes Speichern aktualisiert denselben Eintrag (kein Duplikat) und benennt ihn bei Bedarf um.
- In der Library wird ein Notiz-Eintrag mit eigenem Icon dargestellt. Klick öffnet direkt die Handschrift-Ansicht mit allen Seiten (kein PDF-Viewer), inklusive Umbenennen, Löschen und Papierkorb wie bei anderen Dateien.
- Bereits gespeicherte Notizen behalten Auto-Save; Änderungen landen sofort im verknüpften Eintrag.

## Technische Umsetzung

- Migration: `public.documents` erhält `notebook_id uuid null references public.notebooks(id) on delete cascade` plus Index; `kind` wird für Notizen auf `'note'` gesetzt. `storage_path` wird bei Notiz-Einträgen leer gelassen (Inhalt liegt in `notebook_pages`) – Code-Pfade, die `storage_path` erwarten, prüfen vorher `kind`.
- `src/components/DocumentNotes.tsx`: neue Props/Callbacks für Speichern und Export; Upsert des Library-Eintrags über den Browser-Client (RLS-geschützt, `user_id = auth.uid()`).
- Neue Datei `src/lib/notes-pdf.ts`: rendert Stroke-Vektoren pro Seite mit `jspdf` (neue Abhängigkeit) in ein mehrseitiges PDF; wird für Export und optionalen Storage-Upload in den `documents`-Bucket genutzt.
- `src/routes/_authenticated/library.tsx`: Notiz-Einträge erkennen (`kind === 'note'`), eigenes Icon, Klick öffnet ein Notiz-Overlay statt `DocumentPreview`; Lösch-/Umbenennen-Logik und Papierkorb behandeln fehlenden `storage_path`.
- `src/components/FreeNotesOverlay.tsx` und `DocumentPreview.tsx` reichen den aktuellen Ordner bzw. den Ordner des Dokuments an `DocumentNotes` weiter, damit der Speicherort stimmt.
- Bestehende Funktionen (Seitenwechsel, Auto-Save, Slider, Timer, Download) bleiben unverändert.
