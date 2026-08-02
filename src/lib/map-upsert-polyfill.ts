/**
 * Recent pdf.js builds use the TC39 `Map.prototype.getOrInsertComputed`
 * proposal, which most browsers (incl. Safari/iPad and current Chrome) do not
 * ship yet. Without it every page render throws and the PDF stays blank.
 */
type Upsertable = {
  getOrInsertComputed?: (key: unknown, factory: (key: unknown) => unknown) => unknown;
  getOrInsert?: (key: unknown, value: unknown) => unknown;
  get: (key: unknown) => unknown;
  set: (key: unknown, value: unknown) => unknown;
  has: (key: unknown) => boolean;
};

function patch(proto: Upsertable) {
  if (typeof proto.getOrInsertComputed !== "function") {
    proto.getOrInsertComputed = function (key, factory) {
      if (!this.has(key)) this.set(key, factory(key));
      return this.get(key);
    };
  }
  if (typeof proto.getOrInsert !== "function") {
    proto.getOrInsert = function (key, value) {
      if (!this.has(key)) this.set(key, value);
      return this.get(key);
    };
  }
}

patch(Map.prototype as unknown as Upsertable);
patch(WeakMap.prototype as unknown as Upsertable);

export {};
