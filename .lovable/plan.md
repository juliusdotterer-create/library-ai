# App-Links (Deep Links) im Linktree

## Ziel
Linktree-Einträge können optional eine App direkt öffnen statt einer Website. Ist die App nicht installiert, öffnet sich als Ausweichlösung die normale Web-Adresse.

## Hintergrund (kurz erklärt)
Apps wie YouTube, WhatsApp oder Spotify lassen sich über spezielle Adressen (App-Links / Deep Links) direkt starten, z. B. `youtube://...` statt `https://youtube.com/...`. Ob die App geöffnet wird, entscheidet das Gerät selbst — eine App kann nicht erkennen, welche Apps installiert sind. Deshalb gilt: App-Link zuerst versuchen, nach kurzer Zeit auf die Web-Adresse ausweichen.

## Änderungen

1. **Links-Seite: Feld „App-Link (optional)"** beim Erstellen/Bearbeiten eines Links
   - Zusätzliches Textfeld neben der normalen Web-Adresse
   - Hinweistext mit Beispielen (`youtube://`, `spotify:`, `whatsapp://`)
   - Leer lassen = bisheriges Verhalten

2. **Öffnen-Logik** beim Tippen auf einen Link mit App-Link:
   - Gerät versucht zuerst, die App über den App-Link zu öffnen
   - Nach ca. 1,5 Sekunden ohne App-Start öffnet sich die normale Web-Adresse im Browser
   - Links ohne App-Link bleiben unverändert

3. **Datenbank**: neue Spalte `app_url` (Text, optional) in der Links-Tabelle inkl. Typen und RLS-Konformität

## Technische Details
- `src/routes/_authenticated/links.tsx`: neues Formularfeld `appUrl`, Klick-Handler mit `window.location` (App-Link) + `setTimeout`-Fallback auf `l.url`
- Migration: `ALTER TABLE ... ADD COLUMN app_url text;` (keine neue Tabelle, keine Policy-Änderung nötig)
- `security-definer`/RLS unverändert; Spalte übernimmt bestehende Policies

## Grenzen
- Es gibt keine zuverlässige Erkennung, ob die App wirklich installiert ist — der Ausweichmechanismus (Web-Adresse) ist die Standardlösung, die auch große Dienste nutzen.
- Nicht jede App stellt Deep Links bereit; die Web-Adresse bleibt daher Pflichtfeld.
