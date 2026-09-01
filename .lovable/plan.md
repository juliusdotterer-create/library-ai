# Web-Fenster (Iframe) in der Kopfzeile

Ein neuer Knopf in der oberen Leiste – direkt neben dem Profil-/Einstellungs-Icon – öffnet ein Vollbild-Overlay, in dem eine Webseite eingebettet angezeigt wird. Mehrere Adressen können hinterlegt und direkt im Fenster gewechselt werden.

## Knopf in der Kopfzeile

- Neues Icon (Globus/Fenster) links neben dem Profil-Icon, gleiche gedämpfte Optik wie die anderen Header-Icons.
- Auch in der mobilen unteren Leiste nicht nötig – bleibt im Header sichtbar.
- Tooltip: „Web-Fenster“.

## Vollbild-Overlay

Aufbau analog zur Dokumentvorschau (gleicher Glas-Look, Escape schließt):

- Kopfzeile: Auswahl-Leiste mit den gespeicherten Seiten als Chips/Tabs, Neu laden, In neuem Tab öffnen, Schließen.
- Darunter der Iframe im vollen Rest-Bereich.
- Verwaltung direkt im Fenster: Eingabefeld für Name + URL, Hinzufügen; jeder Eintrag hat Umbenennen und Löschen. Reihenfolge per Pfeil-Knöpfen.
- URL-Prüfung: fehlendes `https://` wird ergänzt; ungültige Eingaben werden abgelehnt.
- Hinweisfläche, wenn eine Seite das Einbetten technisch verbietet (z. B. Google, viele Banken), mit Knopf „In neuem Tab öffnen“.

## Speicherung

Die Liste der Seiten wird pro Account in der Datenbank gespeichert (neue Tabelle mit Zeilen je Nutzer, Zugriff nur auf eigene Einträge), damit sie auf allen Geräten gleich ist. Zuletzt geöffnete Seite wird lokal gemerkt.

## Technische Umsetzung

- Neue Tabelle `web_frames` (`id`, `user_id`, `label`, `url`, `position`, `created_at`) mit GRANTs für `authenticated`/`service_role`, RLS aktiviert und Policies auf `auth.uid() = user_id` für select/insert/update/delete.
- Neue Komponente `src/components/WebFrameOverlay.tsx`: lädt/legt Einträge über den Supabase-Client an, hält Auswahl-State, rendert `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer">`.
- `src/components/AppShell.tsx`: Icon-Knopf + Overlay-State einbauen (neben `/einstellungen`-Link).
- Da Blockaden durch `X-Frame-Options` im Browser nicht direkt erkennbar sind: Timeout-Heuristik (kein `load`-Event nach ca. 6 s → Hinweis anzeigen) plus permanent sichtbarer „In neuem Tab öffnen“-Knopf.
