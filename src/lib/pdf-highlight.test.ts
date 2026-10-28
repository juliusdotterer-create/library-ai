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