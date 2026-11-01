import { describe, expect, it } from "vitest";
import { nextRotation, parseRotation, unrotatePoint } from "./doc-rotation";

describe("doc-rotation", () => {
  it("dreht in 90°-Schritten und kehrt nach 360° zurück", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(270)).toBe(0);
  });
  it("ignoriert ungültige gespeicherte Werte", () => {
    expect(parseRotation("45")).toBe(0);
    expect(parseRotation("180")).toBe(180);
  });
  it("rechnet Zeigerpunkte auf die ungedrehte Seite zurück", () => {
    // Bei 90° liegt die linke obere Seitenecke oben rechts
    expect(unrotatePoint(1, 0, 90)).toEqual([0, 0]);
    expect(unrotatePoint(0, 1, 270)).toEqual([0, 0]);
    expect(unrotatePoint(1, 1, 180)).toEqual([0, 0]);
  });
});
