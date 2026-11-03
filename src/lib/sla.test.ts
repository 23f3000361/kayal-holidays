import { describe, expect, it } from "vitest";
import { dueAt, slaState, workingMinutesBetween, isWorkingTime } from "./sla";
import { pickConsultant } from "./assign";

// Helper: IST wall-clock time to a Date. 2026-11-03 is a Tuesday.
const ist = (s: string) => new Date(`${s}+05:30`);

describe("dueAt (one working hour, Mon–Sat 9–19 IST)", () => {
  it("adds an hour inside working time", () => {
    expect(dueAt(ist("2026-11-03T10:15:00"))).toEqual(ist("2026-11-03T11:15:00"));
  });
  it("carries over the end of the day", () => {
    expect(dueAt(ist("2026-11-03T18:30:00"))).toEqual(ist("2026-11-04T09:30:00"));
  });
  it("starts the clock at opening for night-time enquiries", () => {
    expect(dueAt(ist("2026-11-03T23:10:00"))).toEqual(ist("2026-11-04T10:00:00"));
    expect(dueAt(ist("2026-11-04T06:00:00"))).toEqual(ist("2026-11-04T10:00:00"));
  });
  it("skips Sunday", () => {
    expect(dueAt(ist("2026-11-07T18:45:00"))).toEqual(ist("2026-11-09T09:45:00")); // Sat evening -> Mon
    expect(dueAt(ist("2026-11-08T12:00:00"))).toEqual(ist("2026-11-09T10:00:00")); // Sunday
  });
});

describe("workingMinutesBetween", () => {
  it("counts only working time", () => {
    expect(workingMinutesBetween(ist("2026-11-03T18:30:00"), ist("2026-11-04T09:30:00"))).toBe(60);
    expect(workingMinutesBetween(ist("2026-11-07T20:00:00"), ist("2026-11-09T09:10:00"))).toBe(10);
  });
  it("is zero for reversed ranges", () => {
    expect(workingMinutesBetween(ist("2026-11-04T10:00:00"), ist("2026-11-03T10:00:00"))).toBe(0);
  });
});

describe("slaState", () => {
  it("reports time left", () => {
    const s = slaState(ist("2026-11-03T10:00:00"), null, ist("2026-11-03T10:20:00"));
    expect(s).toMatchObject({ kind: "open", overdue: false, minutesLeft: 40 });
  });
  it("reports overdue minutes", () => {
    const s = slaState(ist("2026-11-03T10:00:00"), null, ist("2026-11-03T11:25:00"));
    expect(s).toMatchObject({ kind: "open", overdue: true, minutesLeft: -25 });
  });
  it("marks replies within target", () => {
    expect(slaState(ist("2026-11-03T18:50:00"), ist("2026-11-04T09:40:00"), new Date())).toMatchObject({ kind: "done", withinTarget: true, minutes: 50 });
  });
  it("knows working time", () => {
    expect(isWorkingTime(ist("2026-11-03T12:00:00"))).toBe(true);
    expect(isWorkingTime(ist("2026-11-08T12:00:00"))).toBe(false);
  });
});

describe("pickConsultant", () => {
  it("chooses the lightest load, then the longest wait", () => {
    const a = { id: "a", name: "Anjali", open: 3, lastAssignedAt: new Date("2026-11-03T05:00:00Z") };
    const b = { id: "b", name: "Rahul", open: 1, lastAssignedAt: new Date("2026-11-03T06:00:00Z") };
    const c = { id: "c", name: "Fatima", open: 1, lastAssignedAt: new Date("2026-11-03T04:00:00Z") };
    expect(pickConsultant([a, b, c])?.id).toBe("c");
    expect(pickConsultant([])).toBeNull();
  });
});
