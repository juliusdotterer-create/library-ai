import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildSiteQuery, DEFAULT_PREFS, legalDomains, normalizeDomain, planSearches, isBlocked } from "./web-sources";

describe("web sources", () => {
  test("nur Rechtsquellen nutzt nur aktive Rechtsdomains", () => {
    const p = { ...DEFAULT_PREFS, scope: "legal_only" as const, disabled_domains: ["dejure.org"] };
    const plan = planSearches(p);
    assert.equal(plan.length, 1);
    assert.ok(plan[0].domains.includes("gesetze-im-internet.de"));
    assert.ok(!plan[0].domains.includes("dejure.org"));
    assert.ok(!plan[0].domains.includes("de.wikipedia.org"));
  });

  test("Ausschlüsse werden als -site: angehängt", () => {
    assert.equal(buildSiteQuery("AfA", ["a.de", "b.de"], ["x.de"]), "AfA (site:a.de OR site:b.de) -site:x.de");
  });

  test("bevorzugt macht zwei Suchläufe, ganzes Web einen ohne Filter", () => {
    assert.equal(planSearches(DEFAULT_PREFS, "prefer_legal").length, 2);
    assert.deepEqual(planSearches(DEFAULT_PREFS, "all")[0].domains, []);
    assert.equal(legalDomains(DEFAULT_PREFS).length, 8);
  });

  test("Domain-Eingabe wird normalisiert, Subdomains werden ausgeschlossen", () => {
    assert.equal(normalizeDomain("https://www.Haufe.de/steuern"), "haufe.de");
    assert.equal(normalizeDomain("kein domain"), null);
    assert.equal(isBlocked("https://shop.haufe.de/x", ["haufe.de"]), true);
  });
});
