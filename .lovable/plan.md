# Anara als MCP-Verbindung ergänzen

## Ziel
Anara soll auf die Dateien des jeweils angemeldeten Nutzers in Library zugreifen können. Dafür wird Anara als weiterer MCP-Client auf der Seite „Mit Agent verbinden“ eingerichtet – mit klarer Anleitung und den passenden Adressen.

## Ausgangslage
Die App hat bereits einen eigenen MCP-Server unter `/mcp` mit Anmeldung über das Nutzerkonto. Die vorhandenen Werkzeuge decken Suche, Ordner, Termine, Lehrplan-Aufgaben und Links ab. Es ist also kein neuer Server nötig – Anara muss nur als Client eingetragen werden.

## Umsetzung

### 1. Neuer Reiter „Anara“ auf der Verbinden-Seite
- In `src/routes/_authenticated/connect.tsx` einen fünften Reiter „Anara“ ergänzen.
- Der Reiter zeigt die eigene MCP-Adresse der App (automatisch aus der aktuellen Domain, z. B. `https://library-ai.lovable.app/mcp`) mit Kopier-Button.
- Schritt-für-Schritt-Anleitung:
  1. In Anara die Verbindungen bzw. MCP-Einstellungen öffnen.
  2. Neue MCP-Verbindung anlegen und die Library-Adresse einfügen.
  3. Anmeldung im geöffneten Fenster mit dem Library-Konto abschließen.
  4. Anara kann danach die eigenen Dokumente, Ordner und Termine durchsuchen.

### 2. Anara-Adresse hinterlegen
- Die von dir genannte Adresse `https://anara.com/api/mcp` wird im Reiter als Anara-eigener Endpunkt mit Kopier-Button angezeigt – nützlich, falls du umgekehrt Anara-Quellen in einem anderen Agenten einbinden willst.
- Ein kurzer Hinweistext trennt beide Richtungen deutlich voneinander, damit nichts verwechselt wird.

### 3. Layout und Sprache
- Die Reiter-Leiste von vier auf fünf Spalten anpassen, damit sie auf dem Smartphone nicht überläuft.
- Gleicher Aufbau, gleiche Karten-Optik und deutsche Texte wie bei den bestehenden Reitern.
- Der Abschnitt „Tools aktualisieren“ bekommt eine Zeile für Anara.

## Technische Details
- Nur Frontend-Änderungen in `src/routes/_authenticated/connect.tsx`.
- Keine neuen Datenbank-Tabellen, keine neuen Server-Funktionen, keine neuen Zugangsdaten.
- Der bestehende OAuth-Ablauf des MCP-Servers sorgt dafür, dass Anara ausschließlich die Daten des angemeldeten Nutzers sieht.

## Hinweis
Ob Anara beliebige externe MCP-Server als Quelle akzeptiert, hängt von deinem Anara-Tarif ab. Falls Anara dort nur eigene Connectors erlaubt, ist die Adresse trotzdem korrekt hinterlegt und funktioniert, sobald Anara diese Option freischaltet.
