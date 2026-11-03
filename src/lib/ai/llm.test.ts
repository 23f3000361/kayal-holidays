import { describe, expect, it } from "vitest";
import { extractRules } from "./extract";
import { mergeLlm } from "./llm";

const TODAY = new Date("2026-11-03T10:00:00Z");
const msg = "Hi, 2 adults and 1 kid, Kerala 5-6 nights in December, budget around 1.2 lakh total, houseboat a must";

describe("mergeLlm", () => {
  const rules = extractRules(msg, TODAY);

  it("returns the rules result untouched when the model is unavailable", () => {
    expect(mergeLlm(rules, null, msg)).toBe(rules);
  });
  it("raises confidence when both agree", () => {
    const m = mergeLlm(rules, { adults: 2, budget_amount: 120000, budget_currency: "INR", budget_basis: "total" }, msg);
    expect(m.engine).toBe("rules+llm");
    expect(m.fields.adults!.confidence).toBeGreaterThanOrEqual(0.95);
    expect(m.fields.budget!.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("flags disagreements instead of silently picking one", () => {
    const m = mergeLlm(rules, { adults: 3 }, msg);
    expect(m.fields.adults!.value).toBe(2);
    expect(m.fields.adults!.confidence).toBeLessThanOrEqual(0.5);
    expect(m.fields.adults!.note).toContain('language model read "3"');
  });
  it("down-weights model values that do not appear in the message", () => {
    const m = mergeLlm(extractRules("Need a quote please", TODAY), { destinations: ["Goa"] }, "Need a quote please");
    expect(m.fields.destinations!.confidence).toBeLessThan(0.4);
    expect(m.fields.destinations!.note).toMatch(/not found in the message/);
  });
  it("ignores must-haves outside the known theme list", () => {
    const m = mergeLlm(extractRules("Kerala trip", TODAY), { must_haves: ["helicopter"] }, "Kerala trip");
    expect(m.fields.mustHaves).toBeNull();
  });
});
