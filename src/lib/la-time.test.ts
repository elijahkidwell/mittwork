import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatWhen, laDayIso, laOffsetMinutes, laWallDate, laWeekday } from "./la-time.ts";

describe("laWallDate (America/Los_Angeles, DST-aware)", () => {
  it("uses PDT (UTC-7) before the Nov 1 2026 change", () => {
    assert.equal(laWallDate(2026, 10, 31, 9, 0).toISOString(), "2026-10-31T16:00:00.000Z");
    assert.equal(laWallDate(2026, 9, 25, 18, 30).toISOString(), "2026-09-26T01:30:00.000Z");
  });

  it("uses PST (UTC-8) after the Nov 1 2026 change", () => {
    assert.equal(laWallDate(2026, 11, 2, 9, 0).toISOString(), "2026-11-02T17:00:00.000Z");
    assert.equal(laWallDate(2026, 12, 15, 0, 0).toISOString(), "2026-12-15T08:00:00.000Z");
  });

  it("handles the change day itself (after 2 AM is PST)", () => {
    assert.equal(laWallDate(2026, 11, 1, 12, 0).toISOString(), "2026-11-01T20:00:00.000Z");
    assert.equal(laWallDate(2026, 3, 8, 12, 0).toISOString(), "2026-03-08T19:00:00.000Z");
  });

  it("round-trips through formatWhen with the same wall-clock time", () => {
    assert.match(formatWhen(laWallDate(2026, 11, 5, 9, 0).toISOString()), /9:00\s?AM PST/);
    assert.match(formatWhen(laWallDate(2026, 10, 5, 9, 0).toISOString()), /9:00\s?AM PDT/);
  });

  it("reports the right offset and weekday", () => {
    assert.equal(laOffsetMinutes(Date.UTC(2026, 9, 1)), -420);
    assert.equal(laOffsetMinutes(Date.UTC(2026, 10, 10)), -480);
    assert.equal(laWeekday(laWallDate(2026, 11, 2, 12, 0)), 1);
  });

  it("steps LA calendar days across the DST boundary", () => {
    const now = new Date("2026-10-30T19:00:00Z");
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((i) => laDayIso(i, now)),
      ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"],
    );
  });
});
