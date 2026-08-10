# Review & Verbesserungsvorschläge

## Zusammenfassung

Die App ist funktional stark und visuell konsistent. Die wichtigsten Probleme liegen im Bereich Sicherheit (besonders der Account-Übertragung) sowie bei Performance-/Wartbarkeits-Schmerzpunkten in großen Komponenten. Der Plan fokussiert auf die Punkte mit dem höchsten Impact.

## 1. Sicherheit – sofort angehen

### 1.1 Account-Transfer nur mit Zustimmung des Ziel-Accounts
**Problem:** Jeder angemeldete Nutzer kann seine Daten in einen anderen Account schieben, nur durch Eingabe der E-Mail-Adresse. Es gibt keine Freigabe durch den Empfänger.
**Lösung:**
- Neue Tabelle `transfer_requests` anlegen (von, nach, Status `pending|accepted|rejected`, Payload-Referenz, Ablaufdatum).
- `transferStart` legt nur noch einen Request an, kopiert noch keine Daten.
- Ziel-Nutzer sieht in den Einstellungen offene Übertragungs-Anfragen und kann annehmen/ablehnen.
- Erst bei Annahme läuft die eigentliche Migration im Hintergrund.
- Optional: Feature komplett auf Admins beschränken, wenn es primär als Admin-Tool gedacht ist.

### 1.2 E-Mail-Enumeration verhindern
**Problem:** `findUserByEmail`/`lookupTransferTarget` und `isEmailAllowed` erlauben es, beliebige E-Mail-Adressen gegen die Nutzerliste zu prüfen.
**Lösung:**
- `lookupTransferTarget` gibt bei nicht gefundener Adresse keine Unterscheidung mehr heraus (z. B. einheitlich "Ziel nicht gefunden oder nicht freigeschaltet").
- Rate-Limit oder zumindest einfache Throttling-Logik auf der Server-Funktion.

### 1.3 Whitelist-Guard nicht fail-open
**Problem:** In `src/routes/_authenticated/route.tsx` fängt ein `try/catch` jeden Fehler und lässt den Nutzer dann durch (`allowed = true`).
**Lösung:**
- Nur auf echte Netzwerk-/Timeout-Fehler fail-open; bei sonstigen Fehlern (z. B. ungültige Antwort, Serverfehler) fail-closed und auf `/auth` umleiten.
- Fehlerursache loggen, ohne sensible Daten preiszugeben.

### 1.4 Hardcoded Owner-E-Mail
**Problem:** `OWNER_EMAIL` liegt als String im Code und die Admin-Rolle wird bei jedem `checkAccess`-Aufruf neu gesetzt.
**Lösung:**
- Owner-E-Mail in Umgebungsvariable auslagern.
- Admin-Rolle einmalig per Migration/Seed setzen, statt bei jedem Seitenaufruf neu zu upserten.

## 2. Performance – nächste Priorität

### 2.1 Library-Suche serverseitig machen
**Problem:** `LibrarySearch.tsx` lädt bei jedem Öffnen die komplette Dokumenten-/Ordner-Tabelle in den Browser und filtert clientseitig.
**Lösung:**
- Server-Funktion mit `ilike`-Suche auf `documents.name` und `folders.name` sowie Pfad-Matching über die Ordner-Hierarchie.
- Ergebnisse begrenzen (z. B. 50 Treffer) und mit Debounce abfragen.
- Breadcrumb-Pfade können weiterhin clientseitig aus den geladenen Ordnern aufgebaut werden, aber nur für die Treffer, nicht für die ganze Bibliothek.

### 2.2 PDF-Annotationen nur betroffene Seite neu zeichnen
**Problem:** `PdfAnnotator.tsx` rendert bei jeder Änderung alle Annotationen aller Seiten neu.
**Lösung:**
- Zeichen-Layer pro Seite trennen oder nur die aktive Seite bei Stiftbewegungen neu rendern.
- Undo/Redo-History pro Seite isolieren, damit nicht der ganze Dokumentzustand kopiert wird.

## 3. Code-Qualität & Wartbarkeit

### 3.1 Große Komponenten aufteilen
**Betroffen:** `PdfAnnotator.tsx` (~646 Zeilen), `library.tsx` (~775 Zeilen), `lehrplaene.tsx` (~720 Zeilen).
**Lösung:**
- Logik in Hooks auslagern: `usePdfAnnotations`, `usePdfZoomPan`, `useLibraryTree`, `useStudyPlanTasks`.
- UI-Teile in kleinere Subkomponenten zerlegen (Toolbar, Seiten-Liste, Lösch-Dialoge).

### 3.2 Wiederkehrende Muster zentralisieren
**Lösung:**
- Einen `useCurrentUser()`-Hook nutzen (bereits `useAuth.ts` vorhanden) statt in jeder Komponente `supabase.auth.getUser()` aufzurufen.
- Gemeinsame Paginierungs-Hilfe für "alle Zeilen holen" aus `transfer.functions.ts` und `LibrarySearch.tsx` in `src/lib/utils.ts` oder `src/lib/supabase-helpers.ts` auslagern.

### 3.3 Typisierung verschärfen
**Problem:** Viele `as never` / `as unknown as` Casts um Supabase-Generics herum.
**Lösung:**
- Generische Helfer gegen das generierte `Database`-Type aus `src/integrations/supabase/types.ts` schreiben.
- `Client = { from: (t: never) => any }` entfernen.

### 3.4 Zerstörungsbestätigungen vereinheitlichen
**Problem:** `WhitelistPanel.tsx` nutzt `window.confirm`, `TrashPanel.tsx` bereits die eigene `ConfirmDelete`-Komponente.
**Lösung:**
- Überall `ConfirmDelete` verwenden; `window.confirm` entfernen.

## 4. UX-Polish

### 4.1 Ladezustände und Fehleranzeige
**Lösung:**
- `DocumentNotes.tsx` Ladezustand durch `Loader2`-Skeleton ersetzen (wie in `ProfilePanel.tsx`).
- `LibrarySearch.tsx` zeigt expliziten Fehlerzustand, falls die Suche fehlschlägt.

### 4.2 Transfer-UI transparent gestalten
**Lösung:**
- Solange kein Accept-Flow implementiert ist, deutlicher kommunizieren, dass der Ziel-Account ungefragt Daten erhält.
- Alternativ den Button für Nicht-Admins deaktivieren, bis der Freigabe-Mechanismus steht.

## Reihenfolge

1. Sicherheit (Transfer-Consent, Enumeration, Whitelist-Guard, Owner-E-Mail).
2. Performance (serverseitige Suche, Annotationen pro Seite).
3. Wartbarkeit (Hooks extrahieren, `useAuth` nutzen, Typisierung).
4. UX-Polish (Ladezustände, einheitliche Dialoge).

## Offene Fragen

- Soll der Account-Transfer grundsätzlich nur für Admins verfügbar sein, oder für alle Nutzer mit Zustimmung des Empfängers?
- Gibt es eine bevorzugte Reihenfolge innerhalb der Sicherheitspunkte, oder soll parallel daran gearbeitet werden?
