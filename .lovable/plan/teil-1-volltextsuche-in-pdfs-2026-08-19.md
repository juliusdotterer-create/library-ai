# Teil 1: Volltextsuche in PDFs

Heute durchsucht die Library nur Dateinamen. Künftig wird der Inhalt jeder hochgeladenen PDF durchsuchbar — inklusive Angabe, auf welcher Seite der Treffer steht.

## Was der Nutzer merkt

- In der Suche (Klick auf das Library-Logo oben links) gibt es zusätzlich zu Ordnern und Dateinamen einen Bereich **Im Inhalt gefunden**.
- Jeder Treffer zeigt Dokumentname, Ordnerpfad, Seitenzahl und einen kurzen Textausschnitt mit hervorgehobenem Suchbegriff.
- Klick auf den Treffer öffnet die Vorschau direkt auf der passenden Seite.
- Beim Hochladen wird der Text im Hintergrund extrahiert; ein kleiner Statushinweis zeigt „wird indexiert“. Bestehende Dokumente lassen sich über einen Button in den Einstellungen nachträglich indexieren.
- Nicht lesbare PDFs (reine Scans ohne Textebene) werden als „kein Text gefunden“ markiert und weiterhin über den Namen gefunden.

## Technische Umsetzung

**Datenbank** (Migration, muss im Build-Modus bestätigt werden)

Neue Tabelle `document_text`:
- `user_id`, `document_id` (eindeutig, löscht mit dem Dokument)
- `content` (Gesamttext), `pages` (Text je Seite als JSON), `page_count`
- `status`: `pending` | `done` | `failed` | `unsupported`
- generierte `tsvector`-Spalte mit deutscher Textsuche-Konfiguration + GIN-Index
- RLS: nur eigene Zeilen; GRANTs für `authenticated` und `service_role`; `updated_at`-Trigger

**Extraktion (Client)**
- `src/lib/pdf-text.ts`: liest eine PDF mit dem bereits installierten `pdfjs-dist`, gibt Text pro Seite zurück, begrenzt auf sinnvolle Seitenanzahl und Zeichenlänge.
- Läuft nach erfolgreichem Upload asynchron, mit kleiner Warteschlange (max. 2 parallel), damit der Upload nicht ausgebremst wird.
- Ergebnis wird per Server Function gespeichert.

**Server Functions** (`src/lib/library.functions.ts`, Muster wie bisher: `createServerFn` + `requireWhitelisted`)
- `saveDocumentText`: schreibt/aktualisiert den Text eines eigenen Dokuments (prüft Ownership).
- `searchLibrary` wird erweitert um `contents`: Volltextsuche über `websearch_to_tsquery('german', …)`, `ts_headline` für den Ausschnitt, Ergebnis inklusive Ordnerpfad und Seitenzahl (aus `pages` ermittelt), Limit 50.
- `listUnindexedDocuments`: liefert PDFs ohne Texteintrag für das Nachindexieren.

**UI**
- `src/components/LibrarySearch.tsx`: dritte Ergebnisgruppe „Im Inhalt“, Snippet-Darstellung, Seitenangabe.
- `src/components/DocumentPreview.tsx` / `PdfCanvasViewer.tsx`: optionales `initialPage`, um direkt zur Trefferseite zu springen.
- `src/routes/_authenticated/einstellungen.tsx`: Karte „Volltext-Index“ mit Anzahl noch nicht indexierter Dokumente und Button „Jetzt indexieren“ (Fortschrittsanzeige).

## Nicht Teil dieses Schritts
Lernkarten, Statistik, Favoriten/Tags, Highlights-Übersicht, KI-Zusammenfassung, Offline — bleiben für spätere Schritte.
