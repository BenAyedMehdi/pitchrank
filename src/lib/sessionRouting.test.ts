import { describe, expect, it } from "vitest";
import { getParticipantRoute, isVotingOpen } from "./sessionRouting";

describe("getParticipantRoute", () => {
  it("returns vote when session is active, a pitch is selected, and timer is running", () => {
    const startedAt = new Date(1_000).toISOString();
    const route = getParticipantRoute({
      status: "active",
      current_pitch_index: 0,
      timer_started_at: startedAt,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000);
    expect(route).toBe("/vote");
  });

  it("returns vote when pitch is active but no timer started yet (G6: pre-timer voting)", () => {
    expect(getParticipantRoute({
      status: "active",
      current_pitch_index: 1,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000)).toBe("/vote");
  });

  it("returns lobby when session is active but no pitch started yet", () => {
    const route = getParticipantRoute({
      status: "active",
      current_pitch_index: -1,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000);
    expect(route).toBe("/lobby");
  });

  it("returns lobby when timer has expired", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(getParticipantRoute({
      status: "active",
      current_pitch_index: 1,
      timer_started_at: startedAt,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 70_000)).toBe("/lobby");
  });

  it("returns lobby for setup and results route for closed states", () => {
    expect(getParticipantRoute({
      status: "setup",
      current_pitch_index: 2,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000)).toBe("/lobby");
    expect(getParticipantRoute({
      status: "voting_closed",
      current_pitch_index: 2,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000)).toBe("/results");
    expect(getParticipantRoute({
      status: "results_revealed",
      current_pitch_index: 2,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000)).toBe("/results");
  });

  it("keeps voting route while timer is paused with remaining seconds", () => {
    expect(getParticipantRoute({
      status: "active",
      current_pitch_index: 1,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: 17,
    }, 70_000)).toBe("/vote");
  });
});

describe("isVotingOpen", () => {
  it("returns true when pitch is active but no timer started yet", () => {
    expect(isVotingOpen({
      status: "active",
      current_pitch_index: 0,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000)).toBe(true);
  });

  it("returns false when timer is expired", () => {
    const startedAt = new Date(1_000).toISOString();
    expect(isVotingOpen({
      status: "active",
      current_pitch_index: 0,
      timer_started_at: startedAt,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 70_000)).toBe(false);
  });

  it("returns false when no pitch started", () => {
    expect(isVotingOpen({
      status: "active",
      current_pitch_index: -1,
      timer_started_at: null,
      timer_duration_seconds: 60,
      timer_paused_remaining_seconds: null,
    }, 10_000)).toBe(false);
  });
});
