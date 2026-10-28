import { test } from "node:test";
import assert from "node:assert/strict";
import { bestPage, relevanceScore, tokenMatches } from "./search-relevance";

test("§ 13 does not match § 1", () => {
  assert.equal(tokenMatches("Regel nach § 1 UStG", "§13"), false);
  assert.equal(tokenMatches("Regel nach § 13 UStG", "§13"), true);
  assert.equal(tokenMatches("Regel nach § 130 UStG", "§13"), false);
  assert.equal(relevanceScore("§ 1 UStG", "§ 13 UStG"), 0);
});

test("more overlapping words rank higher", () => {
  assert.ok(relevanceScore("§ 13 UStG Steuerentstehung", "§ 13 UStG") > relevanceScore("§ 13 EStG", "§ 13 UStG"));
});

test("best page has the most overlap", () => {
  assert.equal(bestPage(["§ 1 UStG", "§ 13 Steuer", "§ 13 UStG"], "§ 13 UStG")?.page, 3);
});

test("missing spaces in the query match spaced document text", () => {
  assert.ok(relevanceScore("Betriebliche Einnahmen", "BetrieblicheEinnahmen") > 0);
  assert.ok(relevanceScore("§ 13 UStG", "§13UStG") > 0);
});

test("missing spaces in document text match spaced queries", () => {
  assert.ok(relevanceScore("BetrieblicheEinnahmen", "Betriebliche Einnahmen") > 0);
  assert.equal(bestPage(["§1UStG", "§130UStG", "§13UStG"], "§ 13 UStG")?.page, 3);
});

test("space tolerance never turns 13 into 1 or 130", () => {
  assert.equal(relevanceScore("§1UStG", "§13UStG"), 0);
  assert.equal(relevanceScore("§130UStG", "§13UStG"), 0);
  assert.equal(relevanceScore("§ 13b UStG", "§13UStG"), 0);
});