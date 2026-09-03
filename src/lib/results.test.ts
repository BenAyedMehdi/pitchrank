import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { buildTeamResults, weightedAverage } from "./results";
import { buildVoteWeightResolver } from "./participantRoles";

const teams: Tables<"teams">[] = [
  { id: "t1", name: "Alpha", pitch_order: 0, session_id: "s1" },
  { id: "t2", name: "Beta", pitch_order: 1, session_id: "s1" },
];

function vote(id: string, participantId: string, teamId: string, scores: number[]): Tables<"votes"> {
  return {
    id,
    session_id: "s1",
    participant_id: participantId,
    team_id: teamId,
    criteria_scores: scores,
    total_score: null,
    submitted_at: "2026-04-13T10:00:00.000Z",
  };
}

describe("weightedAverage", () => {
  it("returns 0 for an empty set", () => {
    expect(weightedAverage([])).toBe(0);
  });

  it("matches a plain average when all weights are 1", () => {
    expect(weightedAverage([
      { value: 2, weight: 1 },
      { value: 4, weight: 1 },
    ])).toBe(3);
  });

  it("pulls the result towards the heavier vote", () => {
    // (2*1 + 5*2) / 3 = 4
    expect(weightedAverage([
      { value: 2, weight: 1 },
      { value: 5, weight: 2 },
    ])).toBe(4);
  });

  it("ignores non-positive weights", () => {
    expect(weightedAverage([
      { value: 1, weight: 0 },
      { value: 5, weight: 1 },
    ])).toBe(5);
  });
});

describe("buildTeamResults with vote weights", () => {
  const labels = ["Tech", "Pitch"];

  // p2 is the use case owner of team t1.
  const resolver = buildVoteWeightResolver([
    { id: "p1", team_id: "t2" },
    { id: "p2", team_id: "t1", is_use_case_owner: true },
  ]);

  const votes = [
    vote("v1", "p1", "t1", [2, 2]),
    vote("v2", "p2", "t1", [5, 5]),
    vote("v3", "p1", "t2", [2, 2]),
    vote("v4", "p2", "t2", [5, 5]),
  ];

  it("averages unweighted when no resolver is supplied", () => {
    const [alpha, beta] = buildTeamResults(teams, votes, labels);
    expect(alpha.criterionAverages).toEqual([3.5, 3.5]);
    expect(beta.criterionAverages).toEqual([3.5, 3.5]);
    expect(alpha.weightedVoteCount).toBe(2);
  });

  it("counts the use case owner vote twice on their own project", () => {
    const [alpha] = buildTeamResults(teams, votes, labels, undefined, resolver);

    // (2*1 + 5*2) / 3 = 4
    expect(alpha.criterionAverages).toEqual([4, 4]);
    expect(alpha.overall).toBe(4);
    expect(alpha.voteCount).toBe(2);
    expect(alpha.weightedVoteCount).toBe(3);
  });

  it("counts the use case owner vote once on every other project", () => {
    const [, beta] = buildTeamResults(teams, votes, labels, undefined, resolver);

    // (2 + 5) / 2 = 3.5 — no boost on a project they do not own
    expect(beta.criterionAverages).toEqual([3.5, 3.5]);
    expect(beta.overall).toBe(3.5);
    expect(beta.voteCount).toBe(2);
    expect(beta.weightedVoteCount).toBe(2);
  });

  it("still honours exclusions before weighting", () => {
    const [alpha] = buildTeamResults(teams, votes, labels, new Set(["p2"]), resolver);

    expect(alpha.criterionAverages).toEqual([2, 2]);
    expect(alpha.voteCount).toBe(1);
    expect(alpha.weightedVoteCount).toBe(1);
  });

  it("returns zeroes for a team with no votes", () => {
    const [alpha] = buildTeamResults(teams, [], labels, undefined, resolver);
    expect(alpha.criterionAverages).toEqual([0, 0]);
    expect(alpha.overall).toBe(0);
    expect(alpha.weightedVoteCount).toBe(0);
  });
});
