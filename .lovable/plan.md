# Volltextsuche: warum nicht alles indexiert ist

## Befund (aus der Datenbank)

- 8.505 Dokumente insgesamt, davon 7.938 PDFs.
- Nur 2.644 Einträge im Volltext-Index: 2.202 „done“, 441 „unsupported“, 1 „failed“.
- Alle Index-Einträge stammen aus einem einzigen Zeitfenster heute (14–16 Uhr) und brechen dann ab — der Lauf wurde also nicht beendet, nicht gleichmäßig verteilt.

## Ursachen

1. **Indexierung läuft nur im Browser-Tab.** Der Button „Fehlende PDFs indexieren“ lädt jede PDF herunter und liest sie lokal aus. Schließt man den Tab, wechselt die Seite oder schläft das Gerät ein, stoppt der Lauf sofort — genau das ist passiert (~2.600 von 7.900).
2. **Kein Fortsetzen nach Fehler / Endlosschleife möglich.** Wenn das Speichern eines Dokuments scheitert, bleibt es „ungelesen“ und wird im nächsten Durchlauf erneut geholt. Ein einzelnes problematisches Dokument kann den Lauf damit blockieren, ohne dass man es sieht.
3. **Reine Scan-PDFs ohne Textebene** (441 Stück) liefern keinen Text — sie sind als „unsupported“ markiert und nur über den Namen auffindbar. Das braucht Texterkennung (OCR).
4. **Andere Dateitypen werden gar nicht indexiert** (~570 Word-, Excel-, PowerPoint-, Text-Dateien) — der Index kennt nur PDFs.
5. **Große Dateien werden gekappt**: max. 300 Seiten bzw. 400.000 Zeichen pro Dokument; alles darüber ist nicht durchsuchbar.

## Vorgeschlagene Umsetzung

**A. Indexlauf robust und wiederaufnehmbar machen**
- Fehlgeschlagene Dokumente werden mit Status `failed` und Fehlergrund gespeichert, statt still übersprungen — damit blockiert kein Dokument den Lauf mehr.
- Fortschritt bleibt beim Neuladen erhalten: Der Lauf startet dort, wo er aufgehört hat, mit Anzeige „x von y“, Pause/Fortsetzen und Warnung vor dem Verlassen der Seite.
- Statuskarte in den Einstellungen zeigt aufgeschlüsselt: indexiert / ohne Textebene / fehlgeschlagen / offen — inklusive Liste der Problemdokumente.
- Erneutes Indexieren nur der fehlgeschlagenen Dokumente per Button.

**B. Weitere Dateitypen indexieren**
- Word (.docx/.doc), Excel/CSV, PowerPoint, ODT und reine Textdateien werden mit den bereits vorhandenen Lesern (mammoth, xlsx, Legacy-Doc-Parser) ausgelesen und in denselben Index geschrieben.

**C. Grenzen anheben**
- Seiten- und Zeichenlimit erhöhen (z. B. 1.000 Seiten / 1 Mio. Zeichen) und pro Dokument protokollieren, wenn gekürzt wurde.

**D. Optional: Scan-PDFs per OCR (separater Schritt)**
- Für die 441 Dokumente ohne Textebene wäre Texterkennung nötig. Das ist deutlich rechenintensiver und sollte als eigener, bewusst gestarteter Lauf umgesetzt werden — nicht Teil dieses Schritts, sofern nicht gewünscht.

## Technische Details

- `src/lib/pdf-text.ts`: Limits anheben, Fehlerursache zurückgeben.
- Neuer Extraktor `src/lib/text-extract.ts`, der je nach Dateityp an pdfjs, mammoth, xlsx, `doc-legacy` oder Plaintext delegiert.
- `src/lib/document-text.functions.ts`: `saveDocumentText` akzeptiert `error`-Text; `listUnindexedDocuments` liefert Zähler nach Status und filtert nicht mehr nur PDFs; Zählabfragen serverseitig statt vollständiges Durchblättern aller Zeilen.
- Migration: Spalte `error text` und `truncated boolean` in `document_text` (Grants/RLS wie bestehend).
- `src/components/TextIndexPanel.tsx`: Statusaufschlüsselung, Pause/Fortsetzen, `beforeunload`-Warnung, „Nur Fehlgeschlagene erneut versuchen“.
