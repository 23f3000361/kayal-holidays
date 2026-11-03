import { describe, expect, it } from "vitest";
import { conflictMessage, fingerprint, stableStringify } from "./conflict";
import { SEED_PACKAGES } from "@/data/packages";

describe("fingerprint", () => {
  const c = SEED_PACKAGES[0].content;
  it("is the same for the same content, whatever the key order", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    expect(fingerprint({ b: 1, a: 2 })).toBe(fingerprint({ a: 2, b: 1 }));
    expect(fingerprint(structuredClone(c))).toBe(fingerprint(c));
  });
  it("changes when anything changes, even one rupee", () => {
    const next = structuredClone(c);
    next.seasons[1].pricePerPerson += 1;
    expect(fingerprint(next)).not.toBe(fingerprint(c));
    expect(fingerprint(c)).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe("conflictMessage", () => {
  it("says who saved and when, in IST", () => {
    expect(conflictMessage({ by: "Thomas Varghese", at: new Date("2026-11-03T10:12:00Z") })).toMatch(/^Thomas Varghese saved this draft at 3:42 pm/);
  });
});
