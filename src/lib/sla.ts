/**
 * Reply-time target: one working hour. Working hours are an assumption (labelled in the TDD):
 * Monday–Saturday, 09:00–19:00 IST. IST has no daylight saving, so a fixed +05:30 offset is exact.
 */

export const WORKING = { offsetMinutes: 330, openHour: 9, closeHour: 19, days: [1, 2, 3, 4, 5, 6] };
export const SLA_MINUTES = 60;

const MIN = 60_000;

/** Shift a UTC instant into "IST wall-clock as if UTC" so getUTC* reads local time. */
const toLocal = (d: Date) => new Date(d.getTime() + WORKING.offsetMinutes * MIN);
const fromLocal = (d: Date) => new Date(d.getTime() - WORKING.offsetMinutes * MIN);

function localDayStart(local: Date) {
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}

/** Start of the working window containing `local`, or the next one if outside hours. */
function nextOpen(local: Date): Date {
  let day = localDayStart(local);
  for (let i = 0; i < 8; i++) {
    const open = day + WORKING.openHour * 60 * MIN;
    const close = day + WORKING.closeHour * 60 * MIN;
    const dow = new Date(day).getUTCDay();
    if (WORKING.days.includes(dow) && local.getTime() < close) return new Date(Math.max(open, local.getTime()));
    day += 24 * 60 * MIN;
  }
  throw new Error("No working day in the next week");
}

function closeOf(local: Date): number {
  return localDayStart(local) + WORKING.closeHour * 60 * MIN;
}

/** When a reply is due: `minutes` of working time after `from`. */
export function dueAt(from: Date, minutes = SLA_MINUTES): Date {
  let cur = nextOpen(toLocal(from));
  let left = minutes * MIN;
  for (;;) {
    const room = closeOf(cur) - cur.getTime();
    if (left <= room) return fromLocal(new Date(cur.getTime() + left));
    left -= room;
    cur = nextOpen(new Date(closeOf(cur) + 1));
  }
}

/** Working minutes elapsed between two instants (0 if b <= a). */
export function workingMinutesBetween(a: Date, b: Date): number {
  if (b <= a) return 0;
  let cur = nextOpen(toLocal(a));
  const end = toLocal(b).getTime();
  let total = 0;
  while (cur.getTime() < end) {
    const stop = Math.min(closeOf(cur), end);
    total += Math.max(0, stop - cur.getTime());
    if (stop >= end) break;
    cur = nextOpen(new Date(closeOf(cur) + 1));
  }
  return Math.round(total / MIN);
}

export function isWorkingTime(d: Date): boolean {
  const local = toLocal(d);
  return nextOpen(local).getTime() === local.getTime();
}

export type SlaState = { kind: "done"; withinTarget: boolean; minutes: number } | { kind: "open"; dueAt: Date; overdue: boolean; minutesLeft: number };

export function slaState(createdAt: Date, firstReplyAt: Date | null, now: Date): SlaState {
  if (firstReplyAt) {
    const minutes = workingMinutesBetween(createdAt, firstReplyAt);
    return { kind: "done", withinTarget: minutes <= SLA_MINUTES, minutes };
  }
  const due = dueAt(createdAt);
  const overdue = now > due;
  const minutesLeft = overdue ? -workingMinutesBetween(due, now) : workingMinutesBetween(now, due);
  return { kind: "open", dueAt: due, overdue, minutesLeft };
}
