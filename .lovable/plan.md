# Google Drive mit der App verbinden

Der OAuth-Client in der Google Cloud Console ist angelegt. Jetzt fehlt nur noch, ihn in der App zu registrieren und einmal durchzutesten.

## Schritte

1. **Client hinterlegen** — Ich öffne die Verknüpfungs-Karte für Google Drive. Dort trägst du Client-ID und Client-Secret aus der Google Cloud Console ein (oder wählst den bereits gespeicherten Client aus). Danach ist der Zugangsschlüssel automatisch im Projekt hinterlegt.
2. **Berechtigungen prüfen** — Es werden nur lesende Drive-Rechte plus Name/E-Mail angefragt, passend zur bestehenden Anbindung.
3. **Verbindung testen** — Du klickst in Einstellungen → Google Drive auf „Mit Google Drive verbinden", meldest dich im Google-Fenster an, und ich prüfe danach, dass der Status „verbunden" anzeigt.
4. **Ordner importieren und abgleichen** — In der Library über „Aus Google Drive" einen Ordner auswählen, dann den Abgleich-Knopf drücken. Ich kontrolliere, dass Dateien ankommen und Änderungen korrekt markiert werden.
5. **Fehler beheben** — Falls Google eine Meldung zur Weiterleitungsadresse oder zu Rechten zeigt, korrigiere ich die Einstellungen bzw. sage dir genau, was in der Google Cloud Console noch fehlt.

## Wichtig

Die Weiterleitungsadresse in Google muss exakt lauten:

```text
https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
```

Am Code der App sind dafür keine Änderungen nötig — die Drive-Funktionen sind fertig eingebaut.
