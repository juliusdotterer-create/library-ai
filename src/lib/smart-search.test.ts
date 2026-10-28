import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { inRange, isQuestion, parseQuery } from "./smart-search";

const now = new Date(2026, 9, 28, 12);

describe("smart search", () => {
  test("question detection", () => {
    assert.equal(isQuestion("Wo steht was zur Abschreibung"), true);
    assert.equal(isQuestion("Abschreibung?"), false);
    assert.equal(isQuestion("Bilanz Abschreibung?"), true);
    assert.equal(isQuestion("Abschreibung Bilanz"), false);
  });
  test("year + folder + type filter", () => {
    const p = parseQuery("PDFs Klausuren aus 2025 im Ordner BWL", now);
    assert.equal(p.filters.folderName, "BWL");
    assert.equal(p.filters.mime, "pdf");
    assert.equal(p.term, "Klausuren");
    assert.equal(inRange(new Date(2025, 5, 1).toISOString(), p.filters), true);
    assert.equal(inRange(new Date(2026, 0, 1).toISOString(), p.filters), false);
  });
  test("last week range", () => {
    const p = parseQuery("Lösung von letzter Woche", now);
    assert.equal(p.term, "Lösung");
    assert.equal(inRange(new Date(2026, 9, 25).toISOString(), p.filters), true);
    assert.equal(inRange(new Date(2026, 9, 10).toISOString(), p.filters), false);
  });
  test("plain term stays untouched", () => {
    assert.equal(parseQuery("Abs", now).term, "Abs");
  });
});
