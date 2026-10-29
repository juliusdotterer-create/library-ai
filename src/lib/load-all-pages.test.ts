import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { loadAllPages } from "./load-all-pages";

describe("complete library loading", () => {
  for (const count of [1274, 5318]) {
    test(`loads all ${count} rows beyond the backend cap`, async () => {
      const rows = Array.from({ length: count }, (_, id) => ({ id }));
      const ranges: [number, number][] = [];
      const result = await loadAllPages(async (from, to) => {
        ranges.push([from, to]);
        return { data: rows.slice(from, to + 1), error: null };
      });
      assert.deepEqual(result, rows);
      assert.deepEqual(ranges[0], [0, 499]);
      assert.equal(ranges.length, Math.ceil(count / 500));
    });
  }

  test("fetches the terminal page for an exact page multiple", async () => {
    const rows = Array.from({ length: 1000 }, (_, id) => ({ id }));
    let calls = 0;
    const result = await loadAllPages(async (from, to) => {
      calls++;
      return { data: rows.slice(from, to + 1), error: null };
    });
    assert.deepEqual(result, rows);
    assert.equal(calls, 3);
  });

  test("does not silently return a partial tree when a later page fails", async () => {
    const error = new Error("Page failed");
    await assert.rejects(loadAllPages(async (from) => {
      if (from > 0) return { data: null, error };
      return { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null };
    }), error);
  });
});