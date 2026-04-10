import { describe, expect, it } from "vitest";
import { getSecondsRemaining, getSessionTimerRemaining, isTimerPaused } from "./timer";

describe("getSecondsRemaining", () => {
  it("returns 0 when timer has not started", () => {
    expect(getSecondsRemaining(null, 1_000)).toBe(0);
  });

  it("returns 60 seconds at timer start", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(getSecondsRemaining(startedAt, 1_000)).toBe(60);
  });

  it("counts down and clamps to 0", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(getSecondsRemaining(startedAt, 30_500)).toBe(31);
    expect(getSecondsRemaining(startedAt, 61_000)).toBe(0);
    expect(getSecondsRemaining(startedAt, 80_000)).toBe(0);
  });

  it("returns 0 for invalid timestamp", () => {
    expect(getSecondsRemaining("invalid-date", 1_000)).toBe(0);
  });

  it("supports custom duration", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(getSecondsRemaining(startedAt, 20_000, 90)).toBe(71);
  });
});

describe("getSessionTimerRemaining", () => {
  it("uses paused remaining seconds when timer is paused", () => {
    expect(
      getSessionTimerRemaining(
        {
          timer_started_at: "2026-04-10T10:00:00.000Z",
          timer_duration_seconds: 60,
          timer_paused_remaining_seconds: 24,
        },
        999_999,
      ),
    ).toBe(24);
  });

  it("calculates remaining from started_at when timer is not paused", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(
      getSessionTimerRemaining({
        timer_started_at: startedAt,
        timer_duration_seconds: 80,
        timer_paused_remaining_seconds: null,
      }, 20_000),
    ).toBe(61);
  });
});

describe("isTimerPaused", () => {
  it("returns true when paused remaining is set", () => {
    expect(isTimerPaused({ timer_paused_remaining_seconds: 10 })).toBe(true);
    expect(isTimerPaused({ timer_paused_remaining_seconds: null })).toBe(false);
  });
});
