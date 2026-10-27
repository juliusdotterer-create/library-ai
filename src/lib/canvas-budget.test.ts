import { describe, expect, it } from "vitest";
import { canvasRatio, TOUCH_MAX_PIXELS } from "./canvas-budget";

describe("canvasRatio", () => {
  it("keeps full sharpness for small pages", () => {
    expect(canvasRatio(800, 1100, 2, TOUCH_MAX_PIXELS)).toBe(2);
  });

  it("caps a zoomed iPad page at the touch pixel budget", () => {
    const r = canvasRatio(3000, 4200, 2, TOUCH_MAX_PIXELS);
    expect(3000 * r * 4200 * r).toBeLessThanOrEqual(TOUCH_MAX_PIXELS + 1);
    expect(r).toBeLessThan(1);
  });
});
