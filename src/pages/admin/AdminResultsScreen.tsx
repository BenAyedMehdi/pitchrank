import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, Loader2, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { AdminSessionLayout } from "@/components/AdminSessionLayout";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { normalizeCriteriaLabels } from "@/lib/voting";
import { toast } from "sonner";

type TeamResult = {
  teamId: string;
  teamName: string;
  voteCount: number;
  criterionAverages: number[];
  overall: number;
};

type CategoryTop = {
  key: string;
  label: string;
  maxScore: number;
  winners: TeamResult[];
  scoreFor: (team: TeamResult) => number;
};

const PODIUM_COLORS = ["#F59E0B", "#94A3B8", "#CD7F32"];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

function statusMap(status: string | undefined): "setup" | "active" | "closed" {
  if (status === "setup") return "setup";
  if (status === "active") return "active";
  return "closed";
}

export default function AdminResultsScreen() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [votes, setVotes] = useState<Tables<"votes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async (sessionId: string) => {
    const [sessionRes, teamsRes, votesRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    if (sessionRes.error) throw sessionRes.error;
    if (teamsRes.error) throw teamsRes.error;
    if (votesRes.error) throw votesRes.error;

    setSession(sessionRes.data);
    setTeams(teamsRes.data || []);
    setVotes(votesRes.data || []);
    setError("");
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    loadData(id)
      .catch((loadError) => {
        console.error("Failed to load results:", loadError);
        setError("Failed to load results");
      })
      .finally(() => setLoading(false));

    const channel = supabase
      .channel(`admin-results-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const criteriaLabels = useMemo(() => normalizeCriteriaLabels(session?.criteria_labels), [session?.criteria_labels]);

  const criteriaDisplayLabels = useMemo(() => {
    const maxCriteriaInVotes = votes.reduce((max, vote) => Math.max(max, vote.criteria_scores?.length ?? 0), 0);
    const criteriaCount = Math.max(criteriaLabels.length, maxCriteriaInVotes);
    return Array.from({ length: criteriaCount }, (_, index) => criteriaLabels[index] || `Criteria ${index + 1}`);
  }, [criteriaLabels, votes]);

  const teamResults = useMemo<TeamResult[]>(() => {
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
        overall: criterionAverages.reduce((sum, value) => sum + value, 0),
      };
    });
  }, [criteriaDisplayLabels, teams, votes]);

  const sortedResults = useMemo(
    () =>
      [...teamResults].sort((a, b) => {
        if (b.overall !== a.overall) return b.overall - a.overall;
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return a.teamName.localeCompare(b.teamName);
      }),
    [teamResults],
  );

  const categoryWinners = useMemo<CategoryTop[]>(() => {
    const categories: CategoryTop[] = [
      {
        key: "overall",
        label: "Overall",
        maxScore: Math.max(1, criteriaDisplayLabels.length * 5),
        winners: [],
        scoreFor: (team) => team.overall,
      },
      ...criteriaDisplayLabels.map((label, criterionIndex) => ({
        key: `criterion-${criterionIndex}`,
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
          if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
          return a.teamName.localeCompare(b.teamName);
        })
        .slice(0, 3);

      return { ...category, winners };
    });
  }, [criteriaDisplayLabels, teamResults]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  if (loading) {
    return (
      <AdminSessionLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminSessionLayout>
    );
  }

  return (
    <AdminSessionLayout
      sessionName={session?.name}
      sessionCode={session?.join_code}
      status={statusMap(session?.status)}
      isLive={session?.status === "active"}
      containerClassName="max-w-[1200px]"
      contentClassName="py-6 lg:py-8"
    >
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Results Board</p>
            <h2 className="text-2xl font-heading font-semibold">Top 3 Winners by Category</h2>
            <p className="text-sm text-muted-foreground">
              Live ranking across overall score and every voting criterion.
            </p>
          </div>
        </div>

        {teams.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No teams available for this session yet.</p>
          </Card>
        ) : votes.length === 0 ? (
          <Card className="p-8 text-center space-y-2">
            <p className="text-sm font-medium">No votes submitted yet.</p>
            <p className="text-xs text-muted-foreground">Start pitches and collect votes to see rankings.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {categoryWinners.map((category, categoryIndex) => {
                const chartData = category.winners.map((winner, winnerIndex) => ({
                  rank: winnerIndex + 1,
                  team: winner.teamName,
                  score: Number(category.scoreFor(winner).toFixed(2)),
                }));

                return (
                  <motion.div
                    key={category.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: categoryIndex * 0.06 }}
                  >
                    <Card className="p-4 space-y-4 h-full">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                          <h3 className="text-lg font-semibold">{category.label}</h3>
                        </div>
                        <Award className="w-5 h-5 text-primary" />
                      </div>

                      <div className="space-y-2">
                        {category.winners.map((winner, winnerIndex) => (
                          <div key={winner.teamId} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-foreground"
                                style={{ backgroundColor: `${PODIUM_COLORS[winnerIndex]}33` }}
                              >
                                #{winnerIndex + 1}
                              </span>
                              <span className="font-medium truncate">{winner.teamName}</span>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">
                              {formatScore(category.scoreFor(winner))}
                            </span>
                          </div>
                        ))}
                      </div>

                      <ChartContainer
                        config={{ score: { label: "Score", color: "hsl(var(--primary))" } }}
                        className="h-[220px] w-full aspect-auto"
                      >
                        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
                          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, category.maxScore]} tickMargin={8} />
                          <YAxis type="category" dataKey="team" width={120} tickLine={false} axisLine={false} />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent formatter={(value) => formatScore(Number(value))} />}
                          />
                          <Bar dataKey="score" radius={6}>
                            {chartData.map((entry, index) => (
                              <Cell key={`${entry.team}-${index}`} fill={PODIUM_COLORS[index] ?? "hsl(var(--primary))"} />
                            ))}
                            <LabelList
                              dataKey="score"
                              position="right"
                              className="fill-foreground text-xs font-medium"
                              formatter={(value: number) => formatScore(value)}
                            />
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Full Team Scores
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Team</TableHead>
                    <TableHead className="text-right">Overall</TableHead>
                    {criteriaDisplayLabels.map((label) => (
                      <TableHead key={label} className="text-right whitespace-nowrap">
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Votes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result) => (
                    <TableRow key={result.teamId}>
                      <TableCell className="font-medium">{result.teamName}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatScore(result.overall)}</TableCell>
                      {result.criterionAverages.map((score, index) => (
                        <TableCell key={`${result.teamId}-${index}`} className="text-right tabular-nums">
                          {formatScore(score)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">{result.voteCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </AdminSessionLayout>
  );
}
