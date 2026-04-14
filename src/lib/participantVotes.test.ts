import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { buildParticipantVoteSummaries } from "./participantVotes";

describe("buildParticipantVoteSummaries", () => {
  const teams: Tables<"teams">[] = [
    { id: "team-1", name: "Alpha", pitch_order: 1, session_id: "session-1" },
    { id: "team-2", name: "Beta", pitch_order: 0, session_id: "session-1" },
  ];

  const votes: Tables<"votes">[] = [
    {
      id: "vote-1",
      session_id: "session-1",
      participant_id: "participant-1",
      team_id: "team-1",
      criteria_scores: [5, 4, 3],
      total_score: null,
      submitted_at: "2026-04-13T10:00:00.000Z",
    },
    {
      id: "vote-2",
      session_id: "session-1",
      participant_id: "participant-2",
      team_id: "team-2",
      criteria_scores: [2, 2, 2],
      total_score: null,
      submitted_at: "2026-04-13T10:01:00.000Z",
    },
    {
      id: "vote-3",
      session_id: "session-1",
      participant_id: "participant-1",
      team_id: "team-2",
      criteria_scores: [3, 5, 4],
      total_score: null,
      submitted_at: "2026-04-13T10:02:00.000Z",
    },
  ];

  it("returns only current participant votes ordered by pitch", () => {
    const result = buildParticipantVoteSummaries(votes, "participant-1", teams, ["Tech", "Pitch", "Demo"]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.teamName)).toEqual(["Beta", "Alpha"]);
  });

  it("maps criteria labels and computes total score", () => {
    const result = buildParticipantVoteSummaries(votes, "participant-1", teams, ["Tech", "Pitch", "Demo"]);

    expect(result[0].criteriaScores).toEqual([
      { label: "Tech", score: 3 },
      { label: "Pitch", score: 5 },
      { label: "Demo", score: 4 },
    ]);
    expect(result[0].totalScore).toBe(12);
  });
});
