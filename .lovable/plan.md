# Passwort zurücksetzen

Passwörter sind grundsätzlich nicht abrufbar – sie liegen nur als unumkehrbarer Prüfwert vor. Statt Abrufen bekommt die App einen Zurücksetzen-Weg.

## Was neu ist

1. **„Passwort vergessen?"** auf der Anmeldeseite: E-Mail eingeben, Person bekommt eine Mail mit Link.
2. **Neue Seite „Neues Passwort setzen"**: Über den Link aus der Mail landet die Person direkt auf einer Seite, auf der sie ein neues Passwort zweimal eingeben kann. Danach wird sie angemeldet zur Library geleitet.
3. **Für dich als Admin**: In den Einstellungen im Bereich Zugänge kannst du bei jeder freigegebenen E-Mail-Adresse „Zurücksetz-Link senden" antippen. Die Person erhält dieselbe Mail – du siehst oder setzt das Passwort nie selbst.
4. Bestätigungs- und Fehlermeldungen jeweils als kurzer Hinweis (z. B. „E-Mail ist unterwegs").

Bereits vorhanden bleibt: In den Einstellungen kann jede Person ihr eigenes Passwort selbst ändern.

## Voraussetzung

Damit die Mails ankommen, muss der Mail-Versand für die App eingerichtet sein (eigene Absender-Domain). Ist das noch nicht erledigt, führe ich dich beim Umsetzen durch die Einrichtung; bis dahin verschickt die Plattform Standard-Mails.

## Technisch

- `src/routes/auth.tsx`: Modus „forgot" ergänzen, `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` })`.
- Neue öffentliche Route `src/routes/auth.reset.tsx`: wartet auf `PASSWORD_RECOVERY`-Session bzw. `getSession()`, dann `supabase.auth.updateUser({ password })`, Validierung min. 8 Zeichen + Wiederholung, anschließend `navigate({ to: "/library" })`. Eigener `head()` mit Titel/Beschreibung.
- Admin-Aktion im Whitelist-Bereich (`allowed_emails`): neue Server-Funktion in `src/lib/admin.functions.ts` mit `requireSupabaseAuth`, prüft Adminrolle über `has_role`, ruft dann `supabaseAdmin.auth.resetPasswordForEmail` (Import erst im Handler). Button in der bestehenden Whitelist-Liste.
- Kein Schema-Änderung nötig; Passwort-Hashes werden nie gelesen.
