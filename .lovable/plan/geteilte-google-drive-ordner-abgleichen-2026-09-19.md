# Geteilte Google-Drive-Ordner abgleichen

## Antwort auf die Frage
Doch, grundsätzlich geht das — die Berechtigung (Drive-Lesezugriff) deckt geteilte Dateien ab. Der Abgleich selbst funktioniert mit geteilten Ordnern, sobald ihre ID bekannt ist. Was bisher fehlt: Im Auswahlfenster sind geteilte Ordner nicht erreichbar, weil sie nicht unter „Mein Drive" liegen, sondern nur unter „Mit mir geteilt". Man kann also nicht zu ihnen navigieren.

## Was gebaut wird

1. **Auswahlfenster mit zwei Bereichen**
   - Oben im Drive-Auswahlfenster zwei Reiter: „Mein Drive" (wie bisher) und „Mit mir geteilt".
   - „Mit mir geteilt" listet alle Ordner und Dateien, die andere mit dir geteilt haben.
   - Von dort lassen sich geteilte Ordner wie gewohnt öffnen, auswählen, importieren und spiegeln — inklusive des neuen Knopfs „Diesen Ordner verwenden".

2. **Abgleich & Spiegelung für geteilte Ordner**
   - Ordner-Abgleich (Pfeil-Knopf), Einzel-Abgleich und die Spiegel-Funktion in den Einstellungen funktionieren danach auch mit geteilten Ordnern.
   - Die Drive-Anfragen erhalten die Zusatzparameter für geteilte Ablagen, damit auch Inhalte aus geteilten Ordnern zuverlässig aufgelistet werden.

3. **Hinweis im Text**
   - Kurzer Hinweis im Auswahlfenster: Geteilte Inhalte lassen sich nur abgleichen, solange die Freigabe besteht.

## Technische Details

- `src/lib/drive.functions.ts`
  - `listAllChildren(userId, folderId)` bleibt, zusätzlich Variante `listSharedWithMe(userId)`: Abfrage `sharedWithMe = true and trashed = false`, gleiche Felder und Paging.
  - Alle Listen-Abfragen bekommen `supportsAllDrives=true&includeItemsFromAllDrives=true` (Deckt geteilte Ablagen/Teamdrives mit ab, schadet normalen Ordnern nicht).
  - `listDriveChildren` bekommt optionales Flag `shared: boolean`; bei `true` liefert es die „Mit mir geteilt"-Liste.
  - Scopes bleiben unverändert (`drive.readonly` reicht für geteilte Inhalte) — keine neue Google-Anmeldung nötig.
- `src/components/DrivePicker.tsx`
  - Wurzel der Navigation: Reiter „Mein Drive" / „Mit mir geteilt" (eigener Crumb-Einstieg, `shared`-Flag je Pfadsegment nur auf oberster Ebene nötig; Unterordner werden per ID gelistet).
  - Rest (Auswahl, Spiegeln, „Diesen Ordner verwenden") bleibt unverändert.

## Prüfung
- Typecheck (`bunx tsgo --noEmit`) und Seitenaufruf von /library und /einstellungen.
- Manueller Test im Preview: „Mit mir geteilt" öffnen, geteilten Ordner wählen, importieren bzw. spiegeln.
