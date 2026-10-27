import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { canvasRatio, TOUCH_MAX_PIXELS } from "./canvas-budget";

describe("canvasRatio", () => {
  test("keeps full sharpness for small pages", () => {
    assert.equal(canvasRatio(800, 1100, 2, TOUCH_MAX_PIXELS), 2);
  });

  test("caps a zoomed iPad page at the touch pixel budget", () => {
    const r = canvasRatio(3000, 4200, 2, TOUCH_MAX_PIXELS);
    assert.ok(3000 * r * 4200 * r <= TOUCH_MAX_PIXELS + 1);
    assert.ok(r < 1);
  });
});
