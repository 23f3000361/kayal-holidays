import { describe, expect, it } from "vitest";
import { extractRules, overallConfidence } from "./extract";

const TODAY = new Date("2026-11-03T10:00:00Z");
const run = (msg: string) => extractRules(msg, TODAY);

describe("client sample enquiry", () => {
  const msg = "Hi, 2 adults and 1 kid, Kerala 5-6 nights in December, budget around 1.2 lakh total, houseboat a must";
  const { fields, questions } = run(msg);

  it("reads the party", () => {
    expect(fields.adults?.value).toBe(2);
    expect(fields.children?.value).toBe(1);
    expect(fields.tripType?.value).toBe("family");
  });
  it("reads destination, nights and month", () => {
    expect(fields.destinations?.value).toEqual(["Kerala"]);
    expect(fields.nights?.value).toEqual({ min: 5, max: 6 });
    expect(fields.travelDates?.value.month).toBe("2026-12");
    expect(fields.travelDates?.value.start).toBeNull();
  });
  it("reads the budget as an approximate total in rupees", () => {
    expect(fields.budget?.value).toMatchObject({ amount: 120000, currency: "INR", basis: "total", limit: "around", inr: 120000 });
    expect(fields.budget!.confidence).toBeGreaterThan(0.8);
  });
  it("treats the houseboat as a must-have", () => {
    expect(fields.mustHaves?.value).toEqual(["houseboat"]);
  });
  it("points evidence at the original words", () => {
    const ev = fields.budget!.evidence[0];
    expect(msg.slice(ev.start, ev.end)).toBe("1.2 lakh total");
    const n = fields.nights!.evidence[0];
    expect(msg.slice(n.start, n.end)).toBe("5-6 nights");
  });
  it("asks only for what is missing", () => {
    expect(questions).toContain("How old is the child? Children under 5 usually travel free.");
    expect(questions).toContain("Which dates in that month suit you best?");
    expect(questions.some((q) => q.startsWith("How many adults"))).toBe(false);
  });
});

describe("dates", () => {
  it("reads a day range with month", () => {
    const f = run("Honeymoon in Munnar and Alleppey from 20-26 Dec").fields;
    expect(f.travelDates?.value).toMatchObject({ start: "2026-12-20", end: "2026-12-26" });
    expect(f.nights?.value).toEqual({ min: 6, max: 6 });
    expect(f.adults?.value).toBe(2);
    expect(f.tripType?.value).toBe("honeymoon");
  });
  it("reads a range across New Year", () => {
    const f = run("28 Dec to 3 Jan, 4 adults").fields;
    expect(f.travelDates?.value).toMatchObject({ start: "2026-12-28", end: "2027-01-03" });
  });
  it("rolls a past month into next year", () => {
    expect(run("We want to come in February with 2 adults").fields.travelDates?.value.month).toBe("2027-02");
  });
  it("does not read 'may' the verb as a month", () => {
    expect(run("We may travel with 3 adults, please call").fields.travelDates).toBeNull();
  });
  it("reads 'in May' as a month", () => {
    expect(run("Planning a trip in May").fields.travelDates?.value.month).toBe("2027-05");
  });
  it("flags ambiguous numeric dates", () => {
    const f = run("arriving 05/01 for a week").fields;
    expect(f.travelDates?.value.start).toBe("2027-01-05");
    expect(f.travelDates!.confidence).toBeLessThan(0.7);
    expect(f.nights?.value).toEqual({ min: 7, max: 7 });
  });
  it("understands next month", () => {
    expect(run("next month for a long weekend").fields.travelDates?.value.month).toBe("2026-12");
  });
});

describe("travellers", () => {
  it("derives adults from a total and children", () => {
    const f = run("We are 4 people including 2 kids aged 6 and 9, Wayanad or Coorg").fields;
    expect(f.adults?.value).toBe(2);
    expect(f.children?.value).toBe(2);
    expect(f.children?.note).toBe("Ages 6, 9");
    expect(f.destinations?.value).toEqual(["Wayanad", "Coorg"]);
  });
  it("reads a group size with low confidence on the split", () => {
    const f = run("Group of 18 from Germany, 10 days Kerala and Tamil Nadu in February 2027, culture and ayurveda, budget EUR 1500 per person").fields;
    expect(f.adults?.value).toBe(18);
    expect(f.adults!.confidence).toBeLessThan(0.7);
    expect(f.nights?.value).toEqual({ min: 9, max: 9 });
    expect(f.destinations?.value).toEqual(["Kerala", "Tamil Nadu"]);
    expect(f.travelDates?.value.month).toBe("2027-02");
    expect(f.budget?.value).toMatchObject({ amount: 1500, currency: "EUR", basis: "per_person" });
    expect(f.interests?.value).toEqual(expect.arrayContaining(["ayurveda", "culture"]));
    expect(f.tripType?.value).toBe("group");
  });
  it("asks about children mentioned without a number", () => {
    const r = run("Family trip with kids to Kerala");
    expect(r.fields.children).toBeNull();
    expect(r.questions).toContain("How many children are travelling, and how old are they?");
  });
  it("reads shorthand 2A+1C", () => {
    const f = run("2A+1C munnar 3N").fields;
    expect([f.adults?.value, f.children?.value, f.nights?.value.min]).toEqual([2, 1, 3]);
  });
});

describe("budget", () => {
  it("reads per-person rupees with an upper limit", () => {
    const b = run("under ₹45,000 per person please").fields.budget?.value;
    expect(b).toMatchObject({ amount: 45000, basis: "per_person", limit: "max" });
  });
  it("reads 80k without a basis at lower confidence", () => {
    const b = run("budget 80k, 2 adults, Kovalam").fields.budget!;
    expect(b.value.amount).toBe(80000);
    expect(b.confidence).toBeLessThan(0.7);
    expect(b.note).toMatch(/total or per person/);
  });
  it("does not confuse phone numbers or durations with budgets", () => {
    expect(run("Call me on 9847012345, 6 days in Kerala").fields.budget).toBeNull();
  });
  it("converts dollars at the assumed rate", () => {
    expect(run("$3,000 total for two").fields.budget?.value.inr).toBe(252000);
  });
});

describe("weak messages", () => {
  it("asks for everything and scores low", () => {
    const r = run("Please call me back");
    expect(r.questions.length).toBeGreaterThanOrEqual(4);
    expect(overallConfidence(r.fields)).toBe(0);
    expect(r.warnings).toContain("Very short message; most details will need to be asked.");
  });
  it("warns on non-English text", () => {
    expect(run("केरल में हनीमून पैकेज चाहिए दिसंबर में").warnings[0]).toMatch(/not be in English/);
  });
  it("picks up contact details from chat messages", () => {
    expect(run("I'm Anna, anna.k@example.com, +49 151 2345 6789").contact).toEqual({ email: "anna.k@example.com", phone: "+4915123456789" });
  });
});
