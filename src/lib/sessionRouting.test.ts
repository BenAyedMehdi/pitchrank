import { describe, expect, it } from "vitest";
import { getParticipantRoute, isVotingOpen } from "./sessionRouting";

describe("getParticipantRoute", () => {
  it("returns vote when session is active, a pitch is selected, and timer is running", () => {
    const startedAt = new Date(1_000).toISOString();
    const route = getParticipantRoute({ status: "active", current_pitch_index: 0, timer_started_at: startedAt }, 10_000);
    expect(route).toBe("/vote");
  });

  it("returns lobby when session is active but no pitch started yet", () => {
    const route = getParticipantRoute({ status: "active", current_pitch_index: -1, timer_started_at: null }, 10_000);
    expect(route).toBe("/lobby");
  });

  it("returns lobby when timer is missing or expired", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(getParticipantRoute({ status: "active", current_pitch_index: 1, timer_started_at: null }, 10_000)).toBe("/lobby");
    expect(getParticipantRoute({ status: "active", current_pitch_index: 1, timer_started_at: startedAt }, 70_000)).toBe("/lobby");
  });

  it("returns lobby for non-active session states", () => {
    expect(getParticipantRoute({ status: "setup", current_pitch_index: 2, timer_started_at: null }, 10_000)).toBe("/lobby");
    expect(getParticipantRoute({ status: "voting_closed", current_pitch_index: 2, timer_started_at: null }, 10_000)).toBe("/lobby");
    expect(getParticipantRoute({ status: "results_revealed", current_pitch_index: 2, timer_started_at: null }, 10_000)).toBe("/lobby");
  });
});

describe("isVotingOpen", () => {
  it("returns false when timer is expired", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(isVotingOpen({ status: "active", current_pitch_index: 0, timer_started_at: startedAt }, 70_000)).toBe(false);
  });
});
