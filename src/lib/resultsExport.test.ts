import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { buildCategoryCsvExports } from "./resultsExport";
import type { ResultsCategory, TeamResult } from "./results";

describe("buildCategoryCsvExports", () => {
  const teamResults: TeamResult[] = [
    {
      teamId: "t1",
      teamName: "Alpha",
      voteCount: 2,
      criterionAverages: [4.5, 3.5],
      overall: 8,
    },
    {
      teamId: "t2",
      teamName: "Beta",
      voteCount: 2,
      criterionAverages: [3.5, 4.5],
      overall: 8,
    },
  ];

  const categories: ResultsCategory[] = [
    {
      key: "overall",
      label: "Overall",
      maxScore: 10,
      winners: teamResults,
      scoreFor: (team) => team.overall,
    },
    {
      key: "criterion-0",
      label: "Technicality",
      maxScore: 5,
      winners: teamResults,
      scoreFor: (team) => team.criterionAverages[0] ?? 0,
    },
  ];

  const votes: Tables<"votes">[] = [
    {
      id: "v1",
      session_id: "s1",
      participant_id: "p1",
      team_id: "t1",
      criteria_scores: [5, 3],
      total_score: null,
      submitted_at: "2026-04-13T10:00:00.000Z",
    },
    {
      id: "v2",
      session_id: "s1",
      participant_id: "p2",
      team_id: "t2",
      criteria_scores: [3, 5],
      total_score: null,
      submitted_at: "2026-04-13T10:01:00.000Z",
    },
  ];

  const participantNameById = new Map<string, string>([
    ["p1", "Ada"],
    ["p2", "Bob"],
  ]);

  it("creates one csv export per category", () => {
    const exports = buildCategoryCsvExports({
      sessionName: "Hackathon Finals",
      categories,
      teamResults,
      votes,
      participantNameById,
    });

    expect(exports).toHaveLength(2);
    expect(exports[0].filename).toBe("hackathon-finals-overall.csv");
    expect(exports[1].filename).toBe("hackathon-finals-technicality.csv");
  });

  it("includes chart and voter sections", () => {
    const exports = buildCategoryCsvExports({
      sessionName: "Hackathon Finals",
      categories,
      teamResults,
      votes,
      participantNameById,
    });

    const content = exports[1].content;
    expect(content).toContain("Chart Data");
    expect(content).toContain("Voters");
    expect(content).toContain("Alpha");
    expect(content).toContain("Ada");
    expect(content).toContain("Category Score");
  });
});

