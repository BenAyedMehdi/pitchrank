import type { Tables } from "@/integrations/supabase/types";
import type { TeamResult, ResultsCategory, ResultsCategoryKey } from "@/lib/results";

export interface CategoryCsvExport {
  filename: string;
  content: string;
}

type BuildCategoryCsvExportsInput = {
  sessionName: string;
  categories: ResultsCategory[];
  teamResults: TeamResult[];
  votes: Tables<"votes">[];
  participantNameById: Map<string, string>;
};

function csvEscape(value: string | number): string {
  const raw = String(value);
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function normalizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "category";
}

function voteScoreForCategory(vote: Tables<"votes">, categoryKey: ResultsCategoryKey): number {
  if (categoryKey === "overall") {
    return vote.criteria_scores.reduce((sum, score) => sum + score, 0);
  }
  const index = Number(categoryKey.replace("criterion-", ""));
  return vote.criteria_scores[index] ?? 0;
}

function buildCategoryCsv({
  category,
  teamResults,
  votes,
  participantNameById,
}: {
  category: ResultsCategory;
  teamResults: TeamResult[];
  votes: Tables<"votes">[];
  participantNameById: Map<string, string>;
}): string {
  const rows: string[] = [];

  rows.push(`Category,${csvEscape(category.label)}`);
  rows.push("");

  rows.push("Chart Data");
  rows.push("Rank,Team,Score");
  const ranked = [...teamResults]
    .sort((a, b) => {
      const diff = category.scoreFor(b) - category.scoreFor(a);
      if (diff !== 0) return diff;
      return a.teamName.localeCompare(b.teamName);
    });

  ranked.forEach((team, index) => {
    rows.push(
      [
        csvEscape(index + 1),
        csvEscape(team.teamName),
        csvEscape(Number(category.scoreFor(team).toFixed(2))),
      ].join(","),
    );
  });

  rows.push("");
  rows.push("Voters");
  rows.push("Team,Voter,Category Score,Total Vote,Submitted At");

  const votersRows = [...votes]
    .map((vote) => ({
      vote,
      voterName: participantNameById.get(vote.participant_id) ?? "Unknown voter",
      categoryScore: voteScoreForCategory(vote, category.key),
      totalVote: vote.criteria_scores.reduce((sum, score) => sum + score, 0),
    }))
    .sort((a, b) => {
      const teamCompare = a.vote.team_id.localeCompare(b.vote.team_id);
      if (teamCompare !== 0) return teamCompare;
      return a.voterName.localeCompare(b.voterName);
    });

  votersRows.forEach((row) => {
    const teamName =
      teamResults.find((team) => team.teamId === row.vote.team_id)?.teamName || row.vote.team_id;
    rows.push(
      [
        csvEscape(teamName),
        csvEscape(row.voterName),
        csvEscape(row.categoryScore),
        csvEscape(row.totalVote),
        csvEscape(row.vote.submitted_at),
      ].join(","),
    );
  });

  return rows.join("\n");
}

export function buildCategoryCsvExports({
  sessionName,
  categories,
  teamResults,
  votes,
  participantNameById,
}: BuildCategoryCsvExportsInput): CategoryCsvExport[] {
  const sessionPart = normalizeFilenamePart(sessionName);

  return categories.map((category) => {
    const categoryPart = normalizeFilenamePart(category.label);
    return {
      filename: `${sessionPart}-${categoryPart}.csv`,
      content: buildCategoryCsv({
        category,
        teamResults,
        votes,
        participantNameById,
      }),
    };
  });
}

