# Slack-Integration pro Nutzer mit Anara-Unterstützung

## Ziel
Jeder angemeldete Nutzer kann seinen eigenen Slack-Workspace mit der Library-App verbinden. Über Slack kann er Nachrichten an den App-Bot senden und empfangen (z. B. „Welche PDFs habe ich zu Vertragsrecht?“). Anara AI lässt sich über den bereits vorhandenen MCP-Server anbinden.

## Nutzerantworten
- Slack-Modus: Jeder Nutzer seinen eigenen Slack-Workspace (App User Connector).
- Richtung: Senden und Empfangen (Mentions/DMs beantworten).
- Anara AI: anara.com – unterstützt MCP-Clients und kann so direkt auf den bestehenden `/mcp`-Endpunkt zugreifen.

## Plan

### 1. Slack App User Connector vorbereiten
- Im Workspace einen Slack OAuth-Client für dieses Projekt anlegen/linken (`connector_app_user--connect_client` mit `connector_id: "slack"`).
- Scopes festlegen: `channels:read`, `channels:history`, `chat:write`, `users:read`, `users:read.email`, `app_mentions:read`, `im:history`, `im:write`.
- Prüfen, ob `allow_offline_access` aktiv ist – sonst kann die App später keine Server-zu-Slack-Aufrufe im Hintergrund machen.

### 2. Serverseitige Speicher für Verbindungsschlüssel
- Tabelle `app_user_connections` anlegen/ergänzen (sofern noch nicht vorhanden): `id`, `user_id`, `connector_id`, `connection_key_ciphertext`, `created_at`, `updated_at`.
- Verschlüsselung mit `APP_USER_CONNECTION_KEY_SECRET` übernehmen.
- Nur `service_role` darf lesen/schreiben; RLS aktivieren.

### 3. Slack-Verbindung im UI ermöglichen
- Neue Seite oder Bereich in den Einstellungen: „Slack verbinden“.
- Button startet OAuth-Consent für den jeweiligen Nutzer.
- Nach Callback wird der `lovack_*`-Connection-Key serverseitig gespeichert.
- Status anzeigen: verbunden / nicht verbunden / Fehler.

### 4. Slack-Events-Endpunkt bauen
- Route `src/routes/api/public/slack/events.ts` anlegen.
- Verifikations-Handshake (`url_verification`) sofort beantworten.
- Slack-Retries (`x-slack-retry-num`) überspringen.
- Slack-Signatur mit dem projektspezifischen `SLACK_SIGNING_SECRET` prüfen.
- Innerhalb von 3 Sekunden mit HTTP 200 acken.
- Danach asynchron verarbeiten:
  - Nutzer anhand der Slack-User-ID oder E-Mail zuordnen.
  - Verbindungsschlüssel aus `app_user_connections` laden.
  - Nachrichtentyp filtern (`app_mention`, `message.im`).
  - Intent verstehen und passende Library-Funktion/MCP-Tool aufrufen.
  - Antwort über `chat.postMessage` zurücksenden.

### 5. Nachrichten-Logik implementieren
- Einfache Befehle erkennen, z. B.:
  - „Suche nach <Begriff>“ → `search-library`-Tool.
  - „Zeige meine Ordner“ → `list-folder`-Tool.
  - „Termine diese Woche“ → `list-events`-Tool.
- Antworten kurz und mit Links zurückgeben (wo sinnvoll).
- Unbekannte Anfragen freundlich ablehnen.

### 6. Anara AI anbinden
- Anara als MCP-Client über die bestehende `/mcp`-URL verbinden (OAuth über Supabase-Auth).
- In den Einstellungen die MCP-URL anzeigen und kurze Anleitung bereitstellen.
- Kein zusätzlicher Code nötig, solange die bestehenden MCP-Tools die gewünschten Daten freigeben.

### 7. Testen
- Lokal den Events-Handler mit einem Slack-Simulator-Request prüfen.
- OAuth-Flow in der Vorschui durchspielen.
- Mention im verbundenen Slack-Workspace senden und Antwort der App prüfen.

## Technische Details
- Stack: TanStack Start, Supabase-Auth, App User Connector für Slack.
- Endpunkt: `POST /api/public/slack/events`.
- Slack-Aufrufe über Lovable Gateway: `https://connector-gateway.lovable.dev/slack/api/<method>`.
- Auth-Header: `Authorization: Bearer ${LOVABLE_API_KEY}` und `X-Connection-Api-Key: ${SLACK_APP_USER_CONNECTOR_CLIENT_API_KEY}`.
- Verbindungsschlüssel werden serverseitig verschlüsselt in `app_user_connections` gespeichert.

## Offene Punkte vor dem Start
- Bestätigen, dass im Workspace ein Slack App User Connector-Client angelegt werden kann.
- Entscheiden, ob der Bot in DMs, Channels oder beidem antworten soll (Scopes anpassen).
