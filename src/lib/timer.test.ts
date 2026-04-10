import { describe, expect, it } from "vitest";
import { getSecondsRemaining } from "./timer";

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
});

