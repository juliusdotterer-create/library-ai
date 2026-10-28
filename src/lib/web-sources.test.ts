import { describe, expect, test } from "bun:test";
import { buildSiteQuery, DEFAULT_PREFS, legalDomains, normalizeDomain, planSearches, isBlocked } from "./web-sources";

describe("web sources", () => {
  test("nur Rechtsquellen nutzt nur aktive Rechtsdomains", () => {
    const p = { ...DEFAULT_PREFS, scope: "legal_only" as const, disabled_domains: ["dejure.org"] };
    const plan = planSearches(p);
    expect(plan.length).toBe(1);
    expect(plan[0].domains).toContain("gesetze-im-internet.de");
    expect(plan[0].domains).not.toContain("dejure.org");
    expect(plan[0].domains).not.toContain("de.wikipedia.org");
  });

  test("Ausschlüsse werden als -site: angehängt", () => {
    expect(buildSiteQuery("AfA", ["a.de", "b.de"], ["x.de"])).toBe("AfA (site:a.de OR site:b.de) -site:x.de");
  });

  test("bevorzugt macht zwei Suchläufe, ganzes Web einen ohne Filter", () => {
    expect(planSearches(DEFAULT_PREFS, "prefer_legal").length).toBe(2);
    expect(planSearches(DEFAULT_PREFS, "all")[0].domains).toEqual([]);
    expect(legalDomains(DEFAULT_PREFS).length).toBe(8);
  });

  test("Domain-Eingabe wird normalisiert, Subdomains werden ausgeschlossen", () => {
    expect(normalizeDomain("https://www.Haufe.de/steuern")).toBe("haufe.de");
    expect(normalizeDomain("kein domain")).toBe(null);
    expect(isBlocked("https://shop.haufe.de/x", ["haufe.de"])).toBe(true);
  });
});
