# Quellen für die Internetsuche einstellbar machen

Aktuell durchsucht „Auch im Internet suchen" das ganze Web ohne Einschränkung. Neu kannst du festlegen, welche Quellen genutzt werden.

## Was du einstellen kannst

In den Einstellungen gibt es den neuen Bereich „Internetsuche – Quellen":

1. **Suchumfang** (eine Auswahl):
  - Nur Rechtsquellen
  - Rechtsquellen bevorzugt, dazu allgemeine Quellen
  - Ganzes Internet (wie bisher)
2. **Rechtsquellen** (einzeln an/aus), vorbelegt mit:
  - gesetze-im-internet.de (Bundesgesetze)
  - dejure.org (Gesetze und Urteile)
  - eur-lex.europa.eu (EU-Recht)
  - bundesverfassungsgericht.de, bundesgerichtshof.de, bundesfinanzhof.de
  - bundesfinanzministerium.de (BMF-Schreiben)
  - [rechtsprechung-im-internet.de](http://rechtsprechung-im-internet.de)
  - Nur deutsches Recht
3. **Allgemeine Quellen** (einzeln an/aus), z. B. Wikipedia, bpb.de, destatis.de
4. **Eigene Seiten hinzufügen** und **Seiten ausschließen**: einfach eine Adresse eintragen, z. B. „haufe.de".

Die Einstellung gilt für deine Suche auf allen Geräten.

## In der Suche

- Unter dem Knopf „Auch im Internet suchen" steht klein der aktive Umfang, z. B. „Nur Rechtsquellen (7)".
- Ein Antippen davon ändert den Umfang für diese eine Suche, ohne die Einstellung zu ändern.
- Die Quellen in der Antwort bekommen ein Schild „Gesetz", „Urteil" oder „Allgemein".
- Bei „Rechtsquellen bevorzugt" stehen Rechtsquellen in der Antwort zuerst.

## Technische Details

- Neue Tabelle `web_search_prefs` (user_id, scope, enabled_domains text[], custom_domains text[], blocked_domains text[]), RLS nur für den eigenen Eintrag, mit GRANTs.
- Pure Hilfsfunktion `src/lib/web-sources.ts`: Voreinstellungsliste mit Kategorie, `buildSiteQuery(query, prefs)` erzeugt `(site:a OR site:b) -site:x`, Prüfung von Domains und Kategorie-Zuordnung von Treffern. Dazu Tests (nur Rechtsquellen erzeugt nur site:-Filter der aktiven Domains; Ausschlüsse kommen als -site:).
- `searchWeb` bekommt optional `scope`, lädt sonst die gespeicherten Einstellungen. Bei „bevorzugt" laufen zwei Firecrawl-Suchen parallel (Rechtsquellen + allgemein), zusammengeführt ohne doppelte Treffer. Treffer von ausgeschlossenen Domains werden zusätzlich auf dem Server herausgefiltert.
- Die KI-Anweisung bekommt den Hinweis, Normen und Urteile genau zu zitieren.
- Einstellungs-Oberfläche als eigener Abschnitt in den Einstellungen; einmalige Auswahl in `LibrarySearch.tsx`.