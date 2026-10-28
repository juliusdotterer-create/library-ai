import { test } from "node:test";
import assert from "node:assert/strict";
import { bestPage, relevanceScore, tokenMatches } from "./search-relevance";

test("§ 13 does not match § 1", () => {
  assert.equal(tokenMatches("Regel nach § 1 UStG", "§13"), false);
  assert.equal(tokenMatches("Regel nach § 13 UStG", "§13"), true);
});

test("more overlapping words rank higher", () => {
  assert.ok(relevanceScore("§ 13 UStG Steuerentstehung", "§ 13 UStG") > relevanceScore("§ 13 EStG", "§ 13 UStG"));
});

test("best page has the most overlap", () => {
  assert.equal(bestPage(["§ 1 UStG", "§ 13 Steuer", "§ 13 UStG"], "§ 13 UStG")?.page, 3);
});