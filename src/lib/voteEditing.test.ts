import { describe, expect, it } from "vitest";
import type { ParticipantVoteSummary } from "./participantVotes";
import {
  applyVoteScoresUpdate,
  buildEditableScores,
  canEditSubmittedVotes,
  hasScoreChanges,
  isEditedVoteValid,
  setScoreAt,
} from "./voteEditing";

const summary: ParticipantVoteSummary = {
  voteId: "vote-1",
  teamId: "team-1",
  teamName: "Alpha",
  pitchOrder: 0,
  submittedAt: "2026-04-13T10:00:00.000Z",
  totalScore: 9,
  criteriaScores: [
    { label: "Tech", score: 4 },
    { label: "Pitch", score: 5 },
  ],
};

describe("canEditSubmittedVotes", () => {
  it("allows editing while the session is active or voting is closed", () => {
    expect(canEditSubmittedVotes("active")).toBe(true);
    expect(canEditSubmittedVotes("voting_closed")).toBe(true);
  });

  it("blocks editing once results are revealed or status is unknown", () => {
    expect(canEditSubmittedVotes("results_revealed")).toBe(false);
    expect(canEditSubmittedVotes("setup")).toBe(false);
    expect(canEditSubmittedVotes(null)).toBe(false);
    expect(canEditSubmittedVotes(undefined)).toBe(false);
  });
});

describe("buildEditableScores", () => {
  it("maps a summary to a mutable score draft", () => {
    expect(buildEditableScores(summary)).toEqual([4, 5]);
  });
});

describe("setScoreAt", () => {
  it("updates only the targeted criterion", () => {
    expect(setScoreAt([4, 5], 1, 2)).toEqual([4, 2]);
  });

  it("does not mutate the input array", () => {
    const scores = [4, 5];
    setScoreAt(scores, 0, 1);
    expect(scores).toEqual([4, 5]);
  });
});

describe("isEditedVoteValid", () => {
  it("requires every criterion to be rated 1-5", () => {
    expect(isEditedVoteValid([4, 5])).toBe(true);
    expect(isEditedVoteValid([4, null])).toBe(false);
    expect(isEditedVoteValid([0, 5])).toBe(false);
    expect(isEditedVoteValid([4, 6])).toBe(false);
    expect(isEditedVoteValid([])).toBe(false);
  });
});

describe("hasScoreChanges", () => {
  it("detects changed and unchanged drafts", () => {
    expect(hasScoreChanges([4, 5], [4, 5])).toBe(false);
    expect(hasScoreChanges([4, 5], [4, 3])).toBe(true);
    expect(hasScoreChanges([4, 5], [4, 5, 1])).toBe(true);
  });
});

describe("applyVoteScoresUpdate", () => {
  const votes = [
    { id: "vote-1", criteria_scores: [4, 5] },
    { id: "vote-2", criteria_scores: [1, 2] },
  ];

  it("replaces scores for the matching vote only", () => {
    const result = applyVoteScoresUpdate(votes, "vote-1", [3, 3]);
    expect(result[0].criteria_scores).toEqual([3, 3]);
    expect(result[1].criteria_scores).toEqual([1, 2]);
  });

  it("leaves the list untouched when the vote is missing", () => {
    const result = applyVoteScoresUpdate(votes, "missing", [3, 3]);
    expect(result.map((vote) => vote.criteria_scores)).toEqual([[4, 5], [1, 2]]);
  });
});
