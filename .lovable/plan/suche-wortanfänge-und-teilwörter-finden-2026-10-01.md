# Suche: Wortanfänge und Teilwörter finden

## Problem

Die Suche nach „Abs" liefert nichts, obwohl Dokumente Wörter wie „Absatz" oder „Abschnitt" enthalten. Zwei Ursachen:

1. **Inhaltssuche**: Die Volltextsuche in `document_text` nutzt `textSearch` mit Typ `phrase` (deutsche Konfiguration). Das findet nur **ganze Wörter** — „abs" als eigenes Wort, nicht „Absatz". Wortanfänge werden nicht gematcht.
2. **Namensuche**: `ilike "%Abs%"` sollte eigentlich treffen — wird im Zuge der Arbeit mit echten Daten geprüft (mögliche Stolpersteine: der `desktop.ini`-Filter oder fehlende Indexierung).

## Was sich ändert

- Die Suche findet künftig auch **Wortanfänge und Teilwörter**: „Abs" findet „Absatz", „Abschnitt", „Abs. 1" usw. — sowohl in Dateinamen als auch im Dokumentinhalt.
- Verhalten bei mehreren Wörtern bleibt: alle Wörter müssen vorkommen, das letzte Wort darf ein Wortanfang sein.
- Snippet und Seitenzahl im Ergebnis bleiben wie bisher (die vorhandene `locate`-Funktion matcht bereits normalisiert und findet Teilwörter).

## Technische Umsetzung

**`src/lib/library.functions.ts` — `searchLibrary`:**

1. **Inhaltssuche umbauen**: Statt `textSearch(..., { type: "phrase" })` eine Prefix-Query:
   - Suchbegriff in Tokens zerlegen, Sonderzeichen entfernen.
   - `to_tsquery('german', 'token1 & token2 & letztes:*')` — das letzte Token bekommt `:*` (Wortanfang), bei einem einzelnen Wort immer `:*`.
   - Umsetzung über `.filter("tsv", "@@", ...)` ist mit supabase-js nicht direkt möglich → stattdessen `.rpc` ist nicht nötig: `textSearch` mit `type: "raw"` akzeptiert eine fertige tsquery-Zeichenkette (`'abs:*'`), Konfiguration `german` bleibt.
2. **Fallback**: Liefert die tsquery nichts (z. B. Stoppwörter, sehr kurze Begriffe), zusätzlich `ilike` auf `document_text.content` mit `%begriff%` (Limit 50) — damit auch Teilwörter mitten im Wort gefunden werden.
3. **Namensuche prüfen**: Mit einer Testabfrage gegen die echte Datenbank verifizieren, dass `ilike "%Abs%"` auf `documents.name` trifft; falls der `desktop.ini`-Filter oder etwas anderes stört, korrigieren.
4. `locate` bleibt unverändert (findet Teilwörter bereits); Treffer ohne `locate`-Match werden nicht verworfen, sondern mit erstem Snippet der ersten Seite angezeigt (robuster gegen tsquery/locate-Abweichungen).

**Keine UI-Änderung nötig** — `LibrarySearch.tsx` bleibt wie es ist.

## Prüfung

- `bunx tsgo --noEmit` und Build-Log.
- Testabfrage über die Datenbank: Suche „Abs" gegen echte `document_text`-Daten, Ergebnis muss Dokumente mit „Absatz"/„Abschnitt" enthalten.
