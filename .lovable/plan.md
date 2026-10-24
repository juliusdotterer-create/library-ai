## Stundenplan schneller laden: Datumsprüfung nur einmal

Bisher liest der Stundenplan bei jedem Laden und bei jeder Zoom-Änderung den Text jeder Seite erneut aus, um das heutige Datum zu finden. Das bremst die Anzeige.

## Was sich ändert

- Die PDF wird zuerst sofort angezeigt, die Datumssuche läuft danach im Hintergrund und blockiert nichts mehr.
- Das Ergebnis (Datum gefunden / nicht enthalten, Position der Zeile) wird pro Stundenplan und Tag auf dem Gerät gespeichert. Beim erneuten Öffnen am selben Tag wird nicht mehr gesucht, sondern direkt markiert und hingescrollt.
- Zoomen löst keine neue Suche mehr aus; die gespeicherte Markierung wird nur neu gezeichnet.
- Neuer Schalter über dem Stundenplan: **„Heutiges Datum suchen“ (ein/aus)**. Ausgeschaltet wird gar nicht geprüft; die Einstellung bleibt auf dem Gerät gespeichert.
- Wird eine neue PDF hochgeladen, wird automatisch neu gesucht.

## Technische Umsetzung

- `PdfCanvasViewer`: Textauslese (`getTextContent`) aus der Render-Schleife lösen; nach dem Rendern einmalig ausführen. Erkannte Regionen in einem Ref pro `url` cachen und bei Zoom-Redraws wiederverwenden.
- Cache in `localStorage` unter `timetable-today:<url>:<datum>` (Regionen + Status), alte Tage werden verworfen.
- `TimetableDoc`: Schalter mit `localStorage`-Persistenz; `todayDate` nur übergeben, wenn aktiviert.
- Bestehende Unit-Tests für `timetable-today` bleiben; ein Test für den Cache-Schlüssel/-Ablauf kommt dazu.
