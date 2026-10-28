import { test } from "node:test";
import assert from "node:assert/strict";
import { findHighlights, highlightTokens } from "./pdf-highlight";

test("§ 13 highlighting keeps short number and ignores § 1 / § 130", async () => {
  const tokens = highlightTokens("§ 13");
  assert.deepEqual(tokens, ["13"]);
  const rects = await findHighlights({ getTextContent: async () => ({ items: [
    { str: "§ 1", width: 30, height: 10, transform: [1, 0, 0, 1, 0, 0] },
    { str: "§ 130", width: 50, height: 10, transform: [1, 0, 0, 1, 0, 0] },
    { str: "§ 13", width: 40, height: 10, transform: [1, 0, 0, 1, 0, 0] },
  ] }) }, { transform: [1, 0, 0, 1, 0, 0], scale: 1 }, tokens);
  assert.equal(rects.length, 1);
  assert.equal(rects[0]?.w, 20);
});

test("highlighting tolerates missing spaces and retains exact paragraph numbers", async () => {
  const page = { getTextContent: async () => ({ items: [
    { str: "Betriebliche Einnahmen", width: 210, height: 10, transform: [1, 0, 0, 1, 0, 0] },
    { str: "§130UStG §13UStG", width: 160, height: 10, transform: [1, 0, 0, 1, 0, 0] },
  ] }) };
  const viewport = { transform: [1, 0, 0, 1, 0, 0], scale: 1 };
  assert.equal((await findHighlights(page, viewport, highlightTokens("BetrieblicheEinnahmen"))).length, 1);
  assert.equal((await findHighlights(page, viewport, ["13"])).length, 1);
});