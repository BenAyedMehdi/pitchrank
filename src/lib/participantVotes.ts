import type { Tables } from "@/integrations/supabase/types";

export interface ParticipantVoteSummary {
  voteId: string;
  teamId: string;
  teamName: string;
  pitchOrder: number;
  submittedAt: string;
  totalScore: number;
  criteriaScores: Array<{ label: string; score: number }>;
}

export function buildParticipantVoteSummaries(
  votes: Tables<"votes">[],
  participantId: string,
  teams: Tables<"teams">[],
  criteriaDisplayLabels: string[],
): ParticipantVoteSummary[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));

  return votes
    .filter((vote) => vote.participant_id === participantId)
    .map((vote) => {
      const team = teamById.get(vote.team_id);
      const criteriaScores = vote.criteria_scores.map((score, index) => ({
        label: criteriaDisplayLabels[index] || `Criteria ${index + 1}`,
        score,
      }));

      return {
        voteId: vote.id,
        teamId: vote.team_id,
        teamName: team?.name || "Unknown team",
        pitchOrder: team?.pitch_order ?? Number.MAX_SAFE_INTEGER,
        submittedAt: vote.submitted_at,
        totalScore: criteriaScores.reduce((sum, item) => sum + item.score, 0),
        criteriaScores,
      };
    })
    .sort((a, b) => {
      if (a.pitchOrder !== b.pitchOrder) return a.pitchOrder - b.pitchOrder;
      return a.teamName.localeCompare(b.teamName);
    });
}
