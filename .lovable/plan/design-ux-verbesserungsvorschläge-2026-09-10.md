# Design & UX – Verbesserungsvorschläge

## Ziel
Die App soll sich noch durchdachter, schneller und einladender anfühlen – auf dem iPhone genauso wie am Desktop. Fokus liegt auf sichtbaren UX-Quick-Wins und einem größeren, aber beherrschbaren Brocken.

## Quick Wins (schnell umsetzbar, sofort spürbar)

### 1. Einheitliche Leerzustände
Aktuell erscheinen an vielen Stellen schlichte Textzeilen wie „Noch keine Links gespeichert“. Diese werden durch eine konsistente Empty-State-Komponente ersetzt:
- Illustratives Icon im Akzentfarb-Look (z. B. Ordner- oder Link-Icon in einer weichen, farbigen Kugel).
- Kurze Überschrift und ein Satz Erklärung.
- Primärer Call-to-Action direkt in der Karte, z. B. „Ersten Link hinzufügen“ oder „Ordner erstellen“.
- Betroffene Seiten: Library (leerer Ordner), Lehrpläne (kein Plan), Kalender (kein Termin), Links (kein Link), Papierkorb (leer).

### 2. Lade-Skeletons statt Spinner
Dort, wo heute Listen oder Karten nachladen, werden Skeleton-Platzhalter eingeblendigt:
- Ordner- und Dokumentenkarten in der Library.
- Link-Einträge im Linktree.
- Lehrplan-Seitenleiste und Aufgabenliste.
- Kalender-Terminliste.
Das verhindert Layout-Sprünge und wirkt schneller.

### 3. Mikro-Animationen für Listen und Karten
- Sanftes Einblenden neuer Einträge (Fade + leichte Verschiebung nach oben).
- Subtile Hover- und Tap-Rückmeldung auf Karten und Buttons.
- Weiche Seitenübergänge beim Navigieren zwischen Library, Kalender, Lehrpläne und Links.
- Alle Bewegungen respektieren `prefers-reduced-motion`.

### 4. Mobile Touch-Verbesserungen
- Touch-Ziele auf mindestens 44 × 44 px prüfen und vergrößern, wo nötig (z. B. kleine Icon-Buttons in der Toolbar).
- Pull-to-Refresh für die Library und den Kalender ergänzen.
- Langes Drücken auf Dokumente/Ordner öffnet direkt das Kontextmenü (Umbenennen, Löschen, Verschieben).

### 5. Einheitliche Dialoge und Hinweise
- Alle löschen-ähnlichen Aktionen nutzen dieselbe `ConfirmDelete`-Komponente.
- Der Account-Transfer im Einstellungsbereich zeigt deutlicher, dass der Ziel-Account ungefragt Daten erhält, bis ein Accept-Flow folgt.

## Größerer Brocken

### 6. Globale Kommando-Palette (Cmd/Ctrl + K)
Eine systemweite Such- und Aktionsleiste, die von überall erreichbar ist:
- Schnellnavigation zu Library, Kalender, Lehrpläne, Links, Einstellungen.
- Direktes Öffnen von Dokumenten und Ordnern aus der Volltextsuche.
- Aktionen wie „Neuer Ordner“, „Neuer Termin“, „Neuer Link“, „Lehrplan erstellen“ ohne Seitenwechsel.
- Optisch als zentriertes, halbtransparentes Liquid-Glass-Overlay mit Tastaturkürzeln.

## Reihenfolge

1. Leerzustände und Skeletons parallel bauen (sichtbarer Impact, geringes Risiko).
2. Mikro-Animationen und mobile Touch-Verbesserungen.
3. Einheitliche Dialoge / Transfer-Hinweis.
4. Kommando-Palette als abschließender größerer Brocken.

## Technische Hinweise

- Keine neuen Datenbank-Tabellen nötig.
- Animationen über Motion for React; auf `prefers-reduced-motion` achten.
- Skeletons nutzen bestehende `glass`- und Farbtokens aus `src/styles.css`.
- Kommando-Palette bindet bestehende `LibrarySearch`-Logik und Routen-Navigation ein.
