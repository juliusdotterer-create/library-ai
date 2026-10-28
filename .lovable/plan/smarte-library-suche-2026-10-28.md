# Smarte Library-Suche

Die bestehende Suche (Lupe / Suchfenster) wird erweitert, kein neues Feld.

## Was du bekommst

1. **Tippfehler verzeihen**
   „Abschreibnug" findet trotzdem „Abschreibung" – in Datei- und Ordnernamen sowie im Dokumenttext. Ähnliche Treffer stehen unter den exakten.

2. **Filter in Worten**
   Eingaben wie „Klausuren aus 2025 im Ordner BWL" oder „PDFs von letzter Woche mit Lösung" werden automatisch erkannt: Ordner, Dateityp, Zeitraum und Suchbegriff. Die erkannten Filter erscheinen als kleine Chips über den Treffern und lassen sich einzeln entfernen.

3. **Fragen stellen**
   Endet die Eingabe mit „?" oder beginnt sie mit „Wo/Was/Wie/Erkläre …", erscheint oben der Eintrag „Frage an deine Library stellen". Dann:
   - werden die passendsten Textstellen aus deinen Dokumenten gesucht,
   - eine KI formuliert daraus eine kurze Antwort auf Deutsch,
   - darunter stehen die Quellen (Dokument + Seite), ein Tipp öffnet das Dokument direkt an der Stelle.
   Die KI nutzt nur deine eigenen Dokumente. Steht nichts dazu drin, sagt sie das, statt etwas zu erfinden.

Normale Suche bleibt sofort und kostenlos; die KI wird nur bei Fragen bzw. Filtersätzen genutzt.

## Technische Details

- **Datenbank (Migration):** `pg_trgm` aktivieren; GIN-Trigram-Indizes auf `documents.name`, `folders.name`, `document_text.content`. RPC `search_library_fuzzy(term, limit)` (SECURITY INVOKER, nutzt RLS/`auth.uid()`) liefert Name- und Inhaltstreffer per `word_similarity` als Ergänzung, wenn tsvector/ilike wenig liefern.
- **Filter-Parsing:** neue Server-Funktion `parseSearchQuery` (requireSupabaseAuth) via Lovable AI Gateway (`google/gemini-3-flash-preview`, strukturierte Ausgabe: term, folderName, mimeTypes, dateFrom/dateTo, isQuestion). Ordnername wird serverseitig per Trigram auf echte Ordner-IDs aufgelöst (inkl. Unterordner). Nur ausgelöst bei mehrwortigen Eingaben mit Filtersignalen (Jahreszahl, „im Ordner", „von", Dateityp), debounced; Ergebnis pro Eingabe gecacht.
- **Fragen:** Server-Funktion `askLibrary`: Volltext + Trigram über `document_text.pages` → Top ~8 Seitenabschnitte (gekürzt), an Gateway mit Anweisung „nur aus Quellen antworten, Quellen [n] zitieren". Rückgabe: Antwort + Quellenliste (document_id, page, snippet). Fehler 429/402 werden als verständliche Meldung angezeigt.
- **UI:** `CommandPalette.tsx` bekommt Filter-Chips, Abschnitt „Ähnliche Treffer" und einen Antwortbereich mit Ladezustand und Quellen-Links (bestehende Öffnen-Logik mit Seitensprung).
- `searchLibrary` in `library.functions.ts` nimmt optionale Filter (folderIds, mime, Zeitraum) entgegen.
- Tests: Unit-Test für Fragen-Erkennung und Filter-Anwendung (Zeitraum/Ordner) neben bestehenden Tests.
