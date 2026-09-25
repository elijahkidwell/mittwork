import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slotsForDay, validateBookingStart, type AvailabilityWindow } from "./booking-rules.ts";

// Monday 9:00–12:00 LA time.
const MON: AvailabilityWindow[] = [{ weekday: 1, startMin: 9 * 60, endMin: 12 * 60 }];
const NOW = Date.parse("2026-10-28T12:00:00Z");

describe("slotsForDay", () => {
  it("labels slots in LA wall-clock time on both sides of DST", () => {
    const before = slotsForDay("2026-10-26", MON, 60, [], Date.parse("2026-10-20T00:00:00Z"));
    assert.equal(before[0].label, "9:00 AM");
    assert.equal(before[0].startAt, "2026-10-26T16:00:00.000Z");
    const after = slotsForDay("2026-11-02", MON, 60, [], NOW);
    assert.equal(after[0].label, "9:00 AM");
    assert.equal(after[0].startAt, "2026-11-02T17:00:00.000Z");
    assert.deepEqual(
      after.map((s) => s.label),
      ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM"],
    );
  });

  it("skips busy ranges and non-matching weekdays", () => {
    const busy = [{ start: Date.parse("2026-11-02T17:00:00Z"), end: Date.parse("2026-11-02T18:00:00Z") }];
    assert.deepEqual(
      slotsForDay("2026-11-02", MON, 60, busy, NOW).map((s) => s.label),
      ["10:00 AM", "10:30 AM", "11:00 AM"],
    );
    assert.deepEqual(slotsForDay("2026-11-03", MON, 60, [], NOW), []);
  });
});

describe("validateBookingStart", () => {
  it("accepts a real future slot", () => {
    assert.equal(validateBookingStart("2026-11-02T17:00:00.000Z", 60, MON, NOW), null);
  });

  it("rejects past, off-schedule, off-grid, overlong, and far-future times", () => {
    assert.match(validateBookingStart("2026-10-26T16:00:00.000Z", 60, MON, NOW) ?? "", /passed/);
    assert.match(validateBookingStart("2026-11-02T16:00:00.000Z", 60, MON, NOW) ?? "", /schedule/);
    assert.match(validateBookingStart("2026-11-02T17:10:00.000Z", 60, MON, NOW) ?? "", /schedule/);
    assert.match(validateBookingStart("2026-11-02T19:30:00.000Z", 60, MON, NOW) ?? "", /schedule/);
    assert.match(validateBookingStart("2027-03-01T17:00:00.000Z", 60, MON, NOW) ?? "", /too far/);
    assert.match(validateBookingStart("nope", 60, MON, NOW) ?? "", /valid/);
  });
});
