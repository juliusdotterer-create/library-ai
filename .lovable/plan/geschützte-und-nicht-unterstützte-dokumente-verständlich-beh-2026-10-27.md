# Geschützte und nicht unterstützte Dokumente verständlich behandeln

## Warum manche Dokumente nicht öffnen
- **Unbekannter Dateityp**: Für manche Formate gibt es keine Vorschau (z. B. .acsm, .epub, .pages, .zip). Dann erscheint nur „keine Vorschau" mit Download.
- **Passwortgeschützte PDFs**: Ja, Dokumente können selbst einen Schlüssel haben. Die App fragt aktuell nicht nach dem Passwort, die PDF bleibt dann leer oder zeigt einen Fehler.
- **Kopierschutz (DRM) aus Bibliotheken**: Dateien aus Onleihe, Uni-Bibliotheken oder E-Book-Shops sind oft mit Adobe-DRM oder als .acsm-Ticket verschlüsselt. Solche Dateien lassen sich nur in der Software des Anbieters öffnen (Adobe Digital Editions, Thorium). Die App darf und kann diesen Schutz nicht umgehen.

## Was ich umsetze
1. **Passwortabfrage für PDFs**: Hat eine PDF ein Passwort, erscheint ein Feld „Passwort eingeben". Bei richtigem Passwort öffnet sie sich normal (Vorschau, Annotieren, Stundenplan). Das Passwort wird nicht gespeichert.
2. **Klare Hinweise statt leerer Seite**:
   - „Diese Datei ist kopiergeschützt (DRM) – bitte in Adobe Digital Editions / der Bibliotheks-App öffnen" für .acsm und DRM-verschlüsselte EPUB/PDF.
   - „Datei beschädigt oder unvollständig" bei kaputten Dateien.
   - Bei sonstigen Typen weiterhin Download-Knopf.
3. **Kennzeichnung in der Library**: Kleines Schloss-Symbol an Dokumenten, die beim Öffnen als geschützt erkannt wurden (nur auf diesem Gerät gemerkt).

## Technische Details
- `PdfCanvasViewer` und `PdfAnnotator`: `getDocument` mit `onPassword`-Callback / `PasswordException` abfangen, Passwort-Dialog anzeigen, mit `password` neu laden; `InvalidPDFException` als „beschädigt" melden.
- `DocumentPreview`: Endungen `acsm`, `epub` (mit `META-INF/encryption.xml`) und PDFs mit `EBX_HANDLER`/Adobe-Filter als DRM-Fall erkennen und Hinweis rendern.
- Schloss-Markierung per localStorage-Key pro Dokument-ID.
