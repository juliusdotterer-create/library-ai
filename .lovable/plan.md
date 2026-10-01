# Übersicht „Jetzt auch verfügbar" nach dem Drive-Abgleich

## Was du bekommst
- Nach jedem Drive-Abgleich (alles, ein Ordner oder ein Dokument) öffnet sich automatisch ein Fenster **„Jetzt auch verfügbar"**, wenn etwas Neues dazugekommen ist.
- Oben eine kurze **Übersicht**: Anzahl neuer Dokumente, neuer Unterordner, aktualisierter und in Drive nicht mehr gefundener Dateien.
- Darunter die neuen Dokumente, **gruppiert nach Thema** (= oberster Library-Ordner, z. B. „Klausuren") und darin nach **Unterordner-Pfad** (z. B. „Klausuren – Strafrecht – 2025").
- Neue Unterordner erscheinen als eigene Einträge mit Ordner-Symbol und Anzahl der enthaltenen neuen Dateien.
- Ein Tipp auf ein Dokument öffnet es direkt in der Vorschau; ein Tipp auf einen Ordner springt in diesen Ordner.
- Gruppen lassen sich auf- und zuklappen; bei vielen Treffern gibt es ein Suchfeld zum Filtern.
- Wurde nichts Neues gefunden, bleibt es bei der bisherigen kurzen Meldung.
- In der Library im Abgleich-Menü kommt **„Zuletzt neu aus Drive"** dazu, um die letzte Übersicht jederzeit wieder zu öffnen.
- Neue Drive-Dokumente bekommen in der Library außerdem bis zum ersten Öffnen ein kleines Abzeichen **„Neu"**.

## Technische Details
- Erkennung: Startzeitpunkt des Abgleichs merken; danach Dokumente und Ordner mit `source = 'gdrive'` und `created_at >= Start` des Nutzers laden (Seiten à 1000). Keine Änderung an der Abgleich-Logik in `drive.functions.ts` nötig; Zähler für „aktualisiert/fehlt" kommen aus den bereits aggregierten Ergebnissen.
- Pfad/Thema per vorhandener Ordner-Liste (`useAllFolders`) clientseitig auflösen; Thema = Wurzel des Pfads.
- Neue Komponente `src/components/library/DriveNewItemsDialog.tsx`; Einbindung in `library.tsx` am Ende der `driveSync`-Mutation.
- Letzte Übersicht (Startzeitpunkt + Zähler) in `localStorage` speichern, damit „Zuletzt neu aus Drive" sie erneut berechnen kann.
- „Neu"-Abzeichen: bestehendes `drive_state = 'new'` wird bisher bei allen Drive-Dateien gesetzt; daher stattdessen Kriterium `created_at >= letzter Abgleichsstart` und noch nicht geöffnet (beim Öffnen auf `ok` setzen, wie heute schon bei „changed").
