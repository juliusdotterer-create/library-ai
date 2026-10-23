# Kalender neu: Tag, Woche, Monat, Jahr (wie Google/Apple)

## Was du bekommst
- Oben eine Umschaltleiste: **Tag · Woche · Monat · Jahr** (plus wie bisher „Stundenplan"). Pfeile vor/zurück und „Heute".
- **Tag**: Zeitleiste von oben nach unten (00–24 Uhr, Start beim aktuellen Zeitpunkt). Termine sind Blöcke, so hoch wie ihre Dauer. Überlappende Termine stehen nebeneinander. Ganztägige Termine stehen oben in einer eigenen Zeile. Eine rote Linie zeigt die aktuelle Uhrzeit.
- **Woche**: 7 Spalten (Mo–So) mit derselben Zeitleiste, auf dem Handy wischbar. Ein Tipp auf den Tagesnamen öffnet die Tagesansicht.
- **Monat**: klassisches Raster. Pro Tag stehen bis zu 3 Termine als farbige Zeilen untereinander, darunter „+X weitere". Ein Tipp auf einen Tag öffnet die Tagesansicht.
- **Jahr**: 12 Mini-Monate, Tage mit Terminen sind markiert. Ein Tipp auf einen Monat öffnet die Monatsansicht.
- **Termine anlegen**: Tipp in einen freien Zeitslot (Tag/Woche) oder auf „+". Das Formular hat Titel, Datum, Start, Ende, Ganztägig, Farbe und Notiz. So lassen sich beliebig viele Termine pro Tag oder Woche erfassen.
- Ein Tipp auf einen Termin öffnet die Details mit Bearbeiten, Löschen und Export in den Handy-Kalender.
- Die zuletzt gewählte Ansicht und das Datum bleiben in der Adresse erhalten, Zurück funktioniert also.

## Unverändert
Stundenplan-Ansicht, Export, bestehende Termine (Daten bleiben gleich).

## Technische Details
- `validateSearch` erhält `view: "tag" | "woche" | "monat" | "jahr" | "stundenplan"` und `date`; die Zeitspanne für `useEvents` wird je Ansicht berechnet.
- Neue Komponenten unter `src/components/calendar/`: `DayWeekGrid` (gemeinsame Zeitleiste für 1 oder 7 Tage, Layout überlappender Termine nach Spalten), `MonthGrid`, `YearGrid` und `EventDialog` (Anlegen/Bearbeiten mit `end_at`, `all_day`, `color`). Die Tabelle `events` hat diese Spalten bereits, es ist keine Datenbankänderung nötig.
- Ein Update-Mutation wird ergänzt (bisher gibt es nur insert/delete). Termine ohne Ende werden mit 60 Minuten dargestellt.
- Die Farben laufen über die bestehenden Design-Tokens. Getestet wird auf dem Desktop und bei 393 px.
