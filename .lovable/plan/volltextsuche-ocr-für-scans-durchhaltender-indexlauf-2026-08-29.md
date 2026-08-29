# Volltextsuche: OCR für Scans + durchhaltender Indexlauf

## Befund (aus der Datenbank)

- 8.505 Dokumente insgesamt, davon 7.938 PDFs.
- Nur 2.644 Einträge im Volltext-Index: 2.202 „done“, 441 „unsupported“ (Scans ohne Textebene), 1 „failed“.
- Alle Index-Einträge stammen aus einem einzigen Zeitfenster (14–16 Uhr) und brechen dann ab: der Lauf wurde nicht beendet, weil er nur im geöffneten Tab läuft.

## Teil 1: Indexlauf, der nicht mehr abbricht

Die Textextraktion passiert im Browser (die Datei wird dafür geladen und gelesen). Ganz ohne Tab geht das nicht — deshalb zwei Maßnahmen:

**Klar kommunizieren**
- Deutlicher Hinweis in der Indexkarte: „Der Lauf braucht diesen Tab. Nicht schließen.“
- Warnung beim Verlassen der Seite, solange indexiert wird.
- Bildschirm bleibt während des Laufs wach (Wake Lock), damit das Gerät nicht einschläft.

**Technisch durchhalten**
- Der Lauf wandert in einen Web Worker und läuft weiter, wenn man innerhalb der App die Seite wechselt (z. B. in die Library) — nur das Schließen des Tabs stoppt ihn.
- Fortschritt wird gespeichert: Nach Neuladen oder Abbruch macht der Lauf genau dort weiter, wo er aufgehört hat, mit „x von y“, Pause/Fortsetzen.
- Fehlerhafte Dokumente werden mit Status `failed` und Grund abgelegt statt still übersprungen, damit kein Dokument den Lauf blockiert.
- Statuskarte zeigt aufgeschlüsselt: indexiert / nur Scan (OCR nötig) / fehlgeschlagen / offen, plus Button „Nur Fehlgeschlagene erneut versuchen“.

## Teil 2: OCR für Scan-PDFs

- Neuer, bewusst separat gestarteter Lauf „Scans per Texterkennung lesen“ für alle Dokumente mit Status `unsupported` (aktuell 441).
- Texterkennung läuft im Browser mit Tesseract (Deutsch + Englisch), Seite für Seite: PDF-Seite wird gerendert und als Bild erkannt.
- Deutlich langsamer als normale Extraktion (grob 2–5 Sekunden pro Seite) — deshalb eigener Fortschrittsbalken mit Restzeitschätzung, Pause/Fortsetzen und Seitenlimit pro Dokument (Standard 50 Seiten, einstellbar).
- Ergebnis landet im selben Index mit Status `done` und Kennzeichen `ocr`, sodass Treffer in der Suche als „per Texterkennung gefunden“ markiert werden.
- Erkennt OCR ebenfalls keinen brauchbaren Text, bleibt das Dokument als „nicht lesbar“ markiert und wird nicht endlos erneut verarbeitet.

## Nicht Teil dieses Schritts

Indexierung weiterer Dateitypen (Word, Excel, PowerPoint) und das Anheben der Seiten-/Zeichenlimits — separater Schritt.

## Technische Details

- Neues Paket `tesseract.js` (WASM, läuft im Browser-Worker); Sprachdaten `deu`+`eng` werden beim ersten Lauf geladen.
- `src/lib/ocr.ts`: rendert PDF-Seiten via pdfjs auf Canvas und erkennt Text; begrenzte Auflösung (ca. 1.500 px Breite) für Tempo, Abbruch-Signal unterstützt.
- `src/lib/index-runner.ts`: gemeinsamer Warteschlangen-Runner (Extraktion + OCR) im Web Worker, Fortschritt in `localStorage`, `navigator.wakeLock`, `beforeunload`-Guard.
- Migration `document_text`: Spalten `error text`, `source text default 'text'` (`text` | `ocr`), `attempts int default 0`; Grants und RLS wie bestehend.
- `src/lib/document-text.functions.ts`: `saveDocumentText` akzeptiert `error`/`source`; neue `listOcrCandidates` (Status `unsupported`, `attempts` unter Grenze) und `getIndexStats` (Zähler serverseitig statt vollständiges Durchblättern).
- `src/components/TextIndexPanel.tsx`: zwei Aktionen (Volltext, OCR), Statusaufschlüsselung, Pause/Fortsetzen, Hinweis- und Verlassen-Warnung.
- `src/lib/library.functions.ts` / `LibrarySearch.tsx`: Treffer aus OCR-Quellen kennzeichnen.
