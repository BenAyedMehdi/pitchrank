import type { Tables } from "@/integrations/supabase/types";

export const OVERALL_CATEGORY_KEY = "overall";
const TOP_TEAMS_PER_CATEGORY = 5;

export type ResultsCategoryKey = typeof OVERALL_CATEGORY_KEY | `criterion-${number}`;

export interface TeamResult {
  teamId: string;
  teamName: string;
  voteCount: number;
  criterionAverages: number[];
  overall: number;
}

export interface ResultsCategory {
  key: ResultsCategoryKey;
  label: string;
  maxScore: number;
  winners: TeamResult[];
  scoreFor: (team: TeamResult) => number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatScore(score: number): string {
  return score.toFixed(2);
}

export function buildCriteriaDisplayLabels(
  criteriaLabels: string[],
  votes: Tables<"votes">[],
): string[] {
  const maxCriteriaInVotes = votes.reduce(
    (max, vote) => Math.max(max, vote.criteria_scores?.length ?? 0),
    0,
  );
  const criteriaCount = Math.max(criteriaLabels.length, maxCriteriaInVotes);
  return Array.from({ length: criteriaCount }, (_, index) => criteriaLabels[index] || `Criteria ${index + 1}`);
}

export function buildTeamResults(
  teams: Tables<"teams">[],
  votes: Tables<"votes">[],
  criteriaDisplayLabels: string[],
): TeamResult[] {
  return teams.map((team) => {
    const teamVotes = votes.filter((vote) => vote.team_id === team.id);
    const criterionAverages = criteriaDisplayLabels.map((_, criterionIndex) => {
      const criterionScores = teamVotes
        .map((vote) => vote.criteria_scores?.[criterionIndex])
        .filter((value): value is number => typeof value === "number");
      return average(criterionScores);
    });

    return {
      teamId: team.id,
      teamName: team.name,
      voteCount: teamVotes.length,
      criterionAverages,
      overall: average(criterionAverages),
    };
  });
}

export function sortTeamResultsByOverall(teamResults: TeamResult[]): TeamResult[] {
  return [...teamResults].sort((a, b) => {
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.teamName.localeCompare(b.teamName);
  });
}

export function buildResultsCategories(
  teamResults: TeamResult[],
  criteriaDisplayLabels: string[],
): ResultsCategory[] {
  const categories: ResultsCategory[] = [
    {
      key: OVERALL_CATEGORY_KEY,
      label: "Overall",
      maxScore: 5,
      winners: [],
      scoreFor: (team) => team.overall,
    },
    ...criteriaDisplayLabels.map((label, criterionIndex) => ({
      key: `criterion-${criterionIndex}` as const,
      label,
      maxScore: 5,
      winners: [],
      scoreFor: (team: TeamResult) => team.criterionAverages[criterionIndex] ?? 0,
    })),
  ];

  return categories.map((category) => {
    const winners = [...teamResults]
      .sort((a, b) => {
        const scoreDiff = category.scoreFor(b) - category.scoreFor(a);
        if (scoreDiff !== 0) return scoreDiff;
        return a.teamName.localeCompare(b.teamName);
      })
      .slice(0, TOP_TEAMS_PER_CATEGORY);

    return { ...category, winners };
  });
}

export function getAllCategoryKeys(criteriaCount: number): ResultsCategoryKey[] {
  return [
    OVERALL_CATEGORY_KEY,
    ...Array.from({ length: criteriaCount }, (_, index) => `criterion-${index}` as const),
  ];
}
