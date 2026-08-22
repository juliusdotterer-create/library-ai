# .doc-Dateien mit Formatierung anzeigen

## Woran es liegt

Alte `.doc`-Dateien (Word 97–2003) werden aktuell von einem eigenen Reader gelesen, der bewusst **nur den reinen Text** aus dem Word-Container holt (`src/lib/doc-legacy.ts`). Alles, was Formatierung ausmacht — Überschriften, Fett/Kursiv, Listen, Tabellen, Bilder — steckt in separaten Strukturen der Datei, die dieser Reader gar nicht ausliest. In der Vorschau wird der Text danach nur in schlichte Absätze zerlegt (`DocxViewer` im Legacy-Modus).

Neue `.docx`-Dateien sind davon nicht betroffen: die laufen über mammoth und behalten ihre Formatierung.

Zusätzlich fällt beim reinen Text auf: Tabellenzellen-Trenner und Feldmarken werden entfernt statt umgewandelt, und der Text wird nicht auf den Haupttext begrenzt — dadurch können Fuß-/Kopfzeilen-Reste hinten anhängen.

## Was gebaut wird

1. **Formatierung aus .doc auslesen**
   Den Legacy-Reader erweitern, sodass er neben dem Text auch die Zeichen- und Absatzformate liest und daraus HTML erzeugt:
   - Absätze mit Überschriften-Ebenen (H1–H3) statt nur `<p>`
   - Fett, Kursiv, Unterstrichen
   - Aufzählungen und nummerierte Listen als echte Listen
   - Tabellenzellen-/Zeilenmarken in eine einfache Tabelle umsetzen
   - Zentriert/rechtsbündig, wo im Absatzformat hinterlegt

2. **Textqualität verbessern**
   - Text auf den Haupttextbereich begrenzen, damit keine Fragmente aus Kopf-/Fußzeilen oder Fußnoten hinten anhängen
   - Feldmarken (z. B. Seitenzahlen, Verweise) sauber entfernen statt als Zeichenmüll stehen zu lassen
   - Sonderzeichen (Zeilenumbruch, Seitenumbruch, Tabulator, Anführungszeichen) korrekt übersetzen

3. **Ehrliche Fallbacks**
   - Ist eine `.doc` in Wahrheit RTF oder HTML (kommt oft vor): erkennen und RTF-Text lesbar darstellen statt Fehlermeldung
   - Ist die Datei verschlüsselt oder nicht lesbar: klarer Hinweis plus Download-Button
   - Bilder aus alten `.doc` werden nicht dargestellt; an der Stelle erscheint ein dezenter Platzhalter „[Bild]“

4. **Anzeige**
   Das Ergebnis wird im selben Vorschaufenster gerendert wie `.docx`, mit gleicher Typografie und gleichem Look.

## Technische Details

- `src/lib/doc-legacy.ts`: zusätzlich zum Piece-Table-Text die Formatierungsstrukturen (Absatz- und Zeichen-Eigenschaften über die Bin-Tables sowie die Stylesheet-Namen) auslesen; neue Export-Funktion liefert HTML statt nur `string`, die bisherige Text-Funktion bleibt für die Volltextsuche erhalten.
- `src/components/DocxViewer.tsx`: im Legacy-Pfad das gelieferte HTML rendern (sanitisiert, gleiche `prose`-Klassen wie bei `.docx`) statt Text in `<p>` zu zerlegen; RTF-Erkennung vorschalten.
- Kein Backend nötig — alles läuft weiterhin im Browser.

## Grenzen

Alte `.doc` ist ein binäres Word-Format; eine 100 % originalgetreue Darstellung (exakte Schriftgrößen, Bilder, komplexe Tabellen) ist im Browser nicht erreichbar. Ziel ist eine sauber strukturierte, gut lesbare Darstellung — mit Download für den Originalfall.
