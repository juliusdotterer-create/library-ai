# Profil-Bereich in den Einstellungen

Ein neuer Abschnitt "Profil" ganz oben auf der Einstellungsseite, mit dem du Anzeigename, E-Mail und Passwort selbst verwalten kannst.

## Anzeigename
- Eingabefeld mit deinem aktuellen Namen (aus dem Profil geladen, sonst der Teil vor dem @ deiner E-Mail).
- Speichern-Button, kurze Bestätigung per Toast.
- Validierung: 2-50 Zeichen, keine leeren Namen.

## E-Mail ändern
- Aktuelle E-Mail wird angezeigt (schreibgeschützt).
- Feld für die neue Adresse + Button "E-Mail ändern".
- Es wird eine Bestätigungsmail an die neue Adresse geschickt; erst nach dem Klick darin gilt die neue Adresse. Hinweis dazu wird direkt in der Oberfläche angezeigt.
- Wichtig: Die Anmeldung ist auf die Whitelist beschränkt. Die neue Adresse muss also ebenfalls freigeschaltet sein, sonst sperrt sich der Account nach dem Wechsel aus. Der Bereich weist darauf hin und prüft vor dem Absenden, ob die neue Adresse freigegeben ist.

## Passwort ändern
- Felder "Neues Passwort" und "Wiederholen".
- Mindestens 8 Zeichen, beide Felder müssen übereinstimmen.
- Nach Erfolg werden die Felder geleert und eine Bestätigung angezeigt.

## Icon in der Kopfleiste
- Das Zahnrad-Symbol, das zu den Einstellungen führt, wird durch ein typisches Profil-Icon (Person im Kreis) ersetzt - in Kopfleiste und Mobilansicht identisch.
- Tooltip/Beschriftung wird zu "Profil & Einstellungen".


## Technische Umsetzung
- Neue Komponente `src/components/ProfilePanel.tsx`, eingebunden in `src/routes/_authenticated/einstellungen.tsx` als erste Sektion (gleicher Glass-Card-Stil wie die übrigen Bereiche).
- Anzeigename: Lesen/Schreiben auf `public.profiles` (`display_name`) per Upsert über den Browser-Client; RLS deckt das bereits ab (eigene Zeile). Zusätzlich wird `display_name` in den Auth-Metadaten aktualisiert, damit neue Sessions konsistent sind.
- E-Mail: `supabase.auth.updateUser({ email })` mit `emailRedirectTo: window.location.origin`. Vorabprüfung der Whitelist über die bestehende Server-Function in `src/lib/access.functions.ts` (bzw. eine analoge Prüf-Function, falls dort nur der eigene Zugang geprüft wird).
- Passwort: `supabase.auth.updateUser({ password })`.
- Validierung mit `zod`, Feedback über `sonner`-Toasts.
- Keine Datenbank-Migration nötig - `profiles.display_name` existiert bereits.
- In `src/components/AppShell.tsx` wird das `Settings2`-Icon durch `CircleUserRound` (lucide-react) ersetzt.

