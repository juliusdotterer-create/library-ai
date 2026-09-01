# Warum die App manchmal träge reagiert – Analyse & Maßnahmen

## Was ich im Projekt gefunden habe

1. **Kein Caching in React Query.** In `src/router.tsx` wird der QueryClient ohne Optionen erstellt (`staleTime` = 0). Jede Ansicht lädt ihre Daten also bei jedem Seitenwechsel und bei jedem Fenster-Fokus komplett neu – auch wenn sich nichts geändert hat. Das sieht man in den Netzwerk-Logs: dieselben Ordner-/Dokument-Abfragen laufen mehrfach innerhalb weniger Sekunden.

2. **Zwei Netzwerk-Runden vor jedem geschützten Seitenaufruf.** `src/routes/_authenticated/route.tsx` ruft bei jedem Routenwechsel `auth.getUser()` (Server-Roundtrip) **und** die Server-Funktion `checkAccess()` auf. Erst danach rendert die Seite. Das erzeugt die spürbare Verzögerung beim Klicken auf Library/Kalender/Lehrpläne.

3. **Jede Komponente hat ihre eigene Auth-Instanz.** `useAuth()` startet pro Verwendung einen eigenen `getSession()`-Aufruf und Listener; Queries starten dadurch verzögert (`enabled: !!user`) und teilweise doppelt.

4. **Abfragen holen mehr Daten als nötig.** In `src/hooks/useLibrary.ts` wird durchgängig `select("*")` verwendet, u. a. für „alle Dokumente"/„alle Ordner" (bei ~8.500 Dokumenten im Account) – für Lehrplan-Auswahl und Suche werden ganze Tabellen in den Browser geladen.

5. **Fehlende Datenbank-Indizes.** Vorhanden sind Indizes nur auf `documents(user_id, folder_id)`, `folders(user_id, parent_id)` und `document_text`. Es fehlen Indizes für `events(user_id, start)`, `links(user_id)`, `study_tasks(plan_id)`, `study_plans(user_id)`, `timetable_entries(user_id)` und für die häufige Kombination mit `deleted_at`.

6. **Schwergewichtige Ansichten.** `library.tsx` (842 Zeilen), `lehrplaene.tsx` (685) und `PdfAnnotator.tsx` (779) rendern viele Elemente ohne Virtualisierung; bei großen Ordnern kostet das Renderzeit. Positiv: PDF.js, Tesseract, XLSX, Mammoth werden bereits nur bei Bedarf nachgeladen.

7. **Zusätzlich im Hintergrund:** Der OCR-/Index-Lauf (`index-runner.ts`) belastet CPU und Netz, solange er läuft – während dieser Zeit wirkt die Oberfläche generell zäher.

## Maßnahmen (nach Wirkung sortiert)

### Stufe 1 – sofort spürbar
- QueryClient mit sinnvollen Defaults: `staleTime` ca. 60 s, `gcTime` 10 min, `refetchOnWindowFocus: false`, `retry: 1`.
- Zugriffsprüfung entschlacken: `checkAccess()` nur noch einmal pro Sitzung ausführen (Ergebnis im QueryClient/`sessionStorage` mit kurzer Gültigkeit cachen) statt bei jedem Routenwechsel; Session aus dem bereits vorhandenen Client-State lesen statt `auth.getUser()` erneut zu senden.
- `useAuth` auf einen gemeinsamen Context/Store im `AppShell` umstellen, sodass es nur einen Auth-Listener und keine parallelen `getSession()`-Aufrufe gibt.

### Stufe 2 – Datenmenge reduzieren
- In `useLibrary.ts` `select("*")` durch explizite Spaltenlisten ersetzen (nur was die UI zeigt).
- „Alle Dokumente"/„Alle Ordner" nicht mehr komplett laden: Lehrplan-Picker und Suche über serverseitige Abfrage mit Limit befüllen (die Suche gibt es bereits serverseitig in `library.functions.ts`).
- Migration mit den fehlenden Indizes: `events(user_id, start)`, `links(user_id, position)`, `study_plans(user_id)`, `study_tasks(plan_id)`, `documents(user_id, deleted_at)`, `folders(user_id, deleted_at)`, `timetable_entries(user_id, weekday)`.

### Stufe 3 – Renderleistung
- Ordner-/Dokumentlisten ab ca. 200 Einträgen virtualisieren oder seitenweise nachladen.
- Große Routen in Unterkomponenten aufteilen und Listenelemente memoisieren, damit ein Klick nicht die ganze Seite neu rendert.
- Hinweis in der Oberfläche, dass ein laufender Index-/OCR-Vorgang die App verlangsamt, inklusive Pausieren-Button (Runner unterstützt das bereits).

## Technische Details
- Änderungen betreffen: `src/router.tsx`, `src/routes/_authenticated/route.tsx`, `src/hooks/useAuth.ts`, `src/hooks/useLibrary.ts`, `src/lib/access.functions.ts`, `src/routes/_authenticated/lehrplaene.tsx`, `src/routes/_authenticated/library.tsx` sowie eine neue Datenbank-Migration nur mit `CREATE INDEX`-Anweisungen (keine Schemaänderung, keine Datenänderung).
- Kein Verhalten der Funktionen wird geändert – nur Ladeverhalten, Caching und Abfragegröße.

## Reihenfolge
Stufe 1 zuerst (kleinster Aufwand, größter Effekt), danach Stufe 2, Stufe 3 optional nach erneuter Messung.
