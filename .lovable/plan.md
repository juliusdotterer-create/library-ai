# Weitere Verbesserungsvorschläge – Review & Plan

## Zusammenfassung

Die App ist funktional umfangreich und visuell konsistent. Die nächsten größten Hebel liegen in **Sicherheit/Datenisolation**, **Code-Qualität/Wartbarkeit** und **UX-Polish**. Mehrere Stellen filtern Datenbank-Abfragen nicht korrekt nach `user_id`, was zu Querlesen zwischen Accounts führen kann. Große Route-Komponenten (>700 Zeilen) erschweren Tests und Erweiterungen.

## 1. Sicherheit & Datenisolation – sofort angehen

### 1.1 Fehlende `user_id`-Filter in zentralen Abfragen
**Problem:** Mehrere Komponenten und Helfer laden Daten ohne `user_id`-Einschränkung. Auch wenn RLS teilweise greift, verlassen sich einige Queries (Papierkorb, Ordner-Baum) nicht darauf und können Daten anderer Nutzer lesen.

**Betroffene Stellen:**
- `src/lib/tree.ts:14` – `allFolders()` holt **alle** Ordner aller Nutzer, keine `deleted_at`-Filterung.
- `src/components/TrashPanel.tsx:19-20` – Papierkorb-Abfragen ohne `user_id`.
- `src/routes/_authenticated/lehrplaene.tsx:73-124` – `study_plans`, `study_tasks`, `documents`, `folders` ohne `user_id`.
- `src/routes/_authenticated/kalender.tsx:67-78` – `events` ohne `user_id`.
- `src/routes/_authenticated/links.tsx:52-61` – `links` ohne `user_id`.
- `src/routes/_authenticated/library.tsx:93-114` – Breadcrumb-Auflösung aus `folderParam` ohne `user_id`.

**Lösung:**
- In `allFolders()` und alle betroffenen Queries `.eq("user_id", uid)` ergänzen.
- `tree.ts` in einen serverseitigen Helfer umziehen oder zumindest user-scoped machen.
- Kurze Audit-Query über alle `supabase.from(...).select(...)`-Aufrufe, um weitere fehlende Filter zu finden.

### 1.2 Owner-E-Mail weiterhin im Code
**Problem:** `src/lib/access.functions.ts:4` setzt `OWNER_EMAIL` mit Fallback auf `"julius.dotterer@gmail.com"`. Admin-Rolle wird bei jedem `checkAccess`-Aufruf neu geprüft/upsertet.

**Lösung:**
- `OWNER_EMAIL` ausschließlich aus `process.env["OWNER_EMAIL"]` lesen, keinen Fallback im Code.
- Admin-Seed in eine einmalige Migration/Funktion auslagern, statt bei jedem Seitenaufruf.

### 1.3 Account-Transfer: User-Enumeration und Volltransfer
**Problem:** `findUserByEmail` in `src/lib/transfer.functions.ts:4-15` paginiert durch alle Auth-Nutzer. Bei vielen Nutzern langsam und enumeration-freundlich.

**Lösung:**
- Suche auf `profiles`-Tabelle beschränken (ohne Auth-Admin-Rechte).
- Oder: Transfer nur anhand von `user_id` ermöglichen, nachdem Empfänger einen kurzen Code generiert hat.
- Transfer-Scopes prüfen: aktuell werden Kalender/Links mit Admin-Client kopiert – prüfen, ob Empfänger-Account danach noch isoliert ist.

## 2. Performance – nächste Priorität

### 2.1 Lehrplan-Dokument-Picker lädt komplette Library
**Problem:** `lehrplaene.tsx` lädt alle Dokumente und Ordner in den Browser, um den Picker zu füllen.

**Lösung:**
- Serverseitige Suche/Snippet-Endpunkt in `src/lib/library.functions.ts` erweitern.
- Picker erst bei Tippen befüllen, Baum-Navigation lazy nachladen.

### 2.2 PDF-Annotationen: Speicher- und Render-Optimierung
**Problem:** `PdfAnnotator.tsx` hält Annotationen als großes Array im State. Bei vielen Seiten/Strokes wächst der Speicher, Undo/Redo kopiert das ganze Array.

**Lösung:**
- Annotationen pro Seite in separate State-Maps aufteilen.
- Undo/Redo pro Seite isolieren.
- Nur sichtbare Seiten rendern (IntersectionObserver) statt aller Seiten auf einmal.

### 2.3 Upload-Performance
**Problem:** `library.tsx` lädt Dateien sequenziell hoch und erzeugt Ordner einzeln.

**Lösung:**
- Paralleles Upload mit begrenzter Konkurrenz (z. B. 3 gleichzeitig).
- Ordner-Cache persistieren, um wiederholte `ensureFolder`-Aufrufe zu vermeiden.

## 3. Code-Qualität & Wartbarkeit

### 3.1 Riesige Route-Komponenten aufteilen
**Betroffen:**
- `src/routes/_authenticated/library.tsx` (~781 Zeilen)
- `src/routes/_authenticated/lehrplaene.tsx` (~722 Zeilen)
- `src/components/PdfAnnotator.tsx` (~677 Zeilen)

**Lösung:**
- Logik in benannte Hooks auslagern: `useLibraryUpload`, `useLibraryNavigation`, `useStudyPlanTasks`, `usePdfAnnotations`, `usePdfZoom`.
- UI-Teile in Subkomponenten: `FolderCard`, `DocumentCard`, `UploadProgress`, `TaskList`, `AnnotationToolbar`.

### 3.2 Gemeinsame Query-Hooks einführen
**Problem:** Jede Route wiederholt ähnliche `useQuery`-Patterns.

**Lösung:**
- `useFolders()`, `useDocuments()`, `useTrash()`, `useStudyPlans()`, `useEvents()`, `useLinks()` als zentrale Hooks mit korrektem `user_id`-Filter.
- Query-Keys zentralisieren.

### 3.3 Typisierung verschärfen
**Problem:**
- `src/lib/transfer.functions.ts:27` `type Client = { from: (t: never) => any }`.
- Mehrere `as never` / `as unknown as` Casts.

**Lösung:**
- Generierte `Database`-Types aus `src/integrations/supabase/types.ts` nutzen.
- Hilfstypen für `Row`-Typen aus der Datenbank ableiten.

### 3.4 Sprache im Code vereinheitlichen
**Problem:** Gemischte deutsche/englische Kommentare und Variablennamen.

**Lösung:**
- Für neue Dateien Deutsch beibehalten, aber konsistente Begriffe festlegen (z. B. `folder`, `document`, `studyPlan`).

## 4. UX-Polish

### 4.1 Bibliothek: Bulk-Aktionen und Sortierung
**Lösung:**
- Mehrfachauswahl von Dateien/Ordnern ermöglichen (Checkboxen im Hover).
- Bulk-Löschen, Bulk-Verschieben in Ordner.
- Sortierung nach Name, Datum, Favoriten.

### 4.2 PDF-Viewer erweitern
**Lösung:**
- Textauswahl und PDF-Suche.
- Thumbnail-Leiste für schnelles Springen.
- Gespeicherte Zoom-Stufe pro Dokument.

### 4.3 Kalender erweitern
**Lösung:**
- Ganztägige Termine.
- Farbkategorien für Termine.
- Wochen-/Tagesansicht optional.

### 4.4 Mobile Navigation verbessern
**Lösung:**
- Aktive Icons im Bottom-Bar mit kleinem Label oder Tooltip.
- Haptisches Feedback bei wichtigen Aktionen.

### 4.5 Leere Zustände und Onboarding
**Lösung:**
- Einheitliche Illustrationen/Empty-States für leere Library, leeren Kalender, leere Lehrpläne.
- Kurze Hinweise, wie man den ersten Ordner/Termin/Link anlegt.

## 5. Robustheit

### 5.1 Fehlergrenzen und Retry-Logik
**Lösung:**
- Globale Fehlerbehandlung für Supabase-Timeouts.
- Optimistic Updates für Löschen/Umbenennen.
- Netzwerk-Offline-Indikator.

### 5.2 Datenbank-Indizes
**Lösung:**
- Migration für Indizes auf `(user_id, deleted_at)`, `(folder_id, deleted_at)`, `(user_id, start_at)` für Events.

## Empfohlene Reihenfolge

1. **Sicherheit:** `user_id`-Filter in `tree.ts`, `TrashPanel`, `lehrplaene`, `kalender`, `links`, `library` ergänzen.
2. **Owner-E-Mail:** Umgebungsvariable ohne Fallback, Admin-Seed einmalig.
3. **Wartbarkeit:** Gemeinsame Query-Hooks und Aufteilung der größten Komponenten.
4. **Performance:** Serverseitiger Picker, PDF-Annotationen pro Seite, paralleler Upload.
5. **UX-Polish:** Bulk-Aktionen, PDF-Suche, Kalender-Kategorien, Empty-States.

## Offene Fragen

- Soll der Account-Transfer weiterhin über E-Mail-Adresse funktionieren, oder lieber über einen vom Empfänger generierten Code?
- Sollen Bulk-Aktionen (Mehrfachauswahl) in der Library als nächstes kommen, oder erst die Sicherheitsfixes?
