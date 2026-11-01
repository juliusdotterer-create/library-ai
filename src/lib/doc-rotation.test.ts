import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { nextRotation, parseRotation, unrotatePoint } from "./doc-rotation";

describe("doc-rotation", () => {
  test("dreht in 90°-Schritten und kehrt nach 360° zurück", () => {
    assert.equal(nextRotation(0), 90);
    assert.equal(nextRotation(270), 0);
  });
  test("ignoriert ungültige gespeicherte Werte", () => {
    assert.equal(parseRotation("45"), 0);
    assert.equal(parseRotation("180"), 180);
  });
  test("rechnet Zeigerpunkte auf die ungedrehte Seite zurück", () => {
    assert.deepEqual(unrotatePoint(1, 0, 90), [0, 0]);
    assert.deepEqual(unrotatePoint(0, 1, 270), [0, 0]);
    assert.deepEqual(unrotatePoint(1, 1, 180), [0, 0]);
  });
});
