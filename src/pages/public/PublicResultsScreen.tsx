import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Award, Loader2, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildCriteriaDisplayLabels,
  buildResultsCategories,
  buildTeamResults,
  formatScore,
  sortTeamResultsByOverall,
} from "@/lib/results";
import { normalizeCriteriaLabels } from "@/lib/voting";

const PODIUM_COLORS = ["#F59E0B", "#94A3B8", "#CD7F32"];

export default function PublicResultsScreen() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [votes, setVotes] = useState<Tables<"votes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadData = async (sessionId: string) => {
    const [sessionRes, teamsRes, votesRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    if (sessionRes.error || !sessionRes.data) {
      setNotFound(true);
      return;
    }
    if (teamsRes.error || votesRes.error) {
      return;
    }

    setSession(sessionRes.data);
    setTeams(teamsRes.data || []);
    setVotes(votesRes.data || []);
    setNotFound(false);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadData(id).finally(() => setLoading(false));

    const channel = supabase
      .channel(`public-results-${id}`)
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
  const criteriaDisplayLabels = useMemo(
    () => buildCriteriaDisplayLabels(criteriaLabels, votes),
    [criteriaLabels, votes],
  );
  const teamResults = useMemo(
    () => buildTeamResults(teams, votes, criteriaDisplayLabels),
    [criteriaDisplayLabels, teams, votes],
  );
  const categories = useMemo(
    () => buildResultsCategories(teamResults, criteriaDisplayLabels),
    [criteriaDisplayLabels, teamResults],
  );
  const sortedResults = useMemo(() => sortTeamResultsByOverall(teamResults), [teamResults]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-[560px] w-full p-8 text-center space-y-2">
          <h1 className="text-xl font-semibold">Results link is not valid</h1>
          <p className="text-sm text-muted-foreground">Check the URL and try again.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-[1200px] mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Public Results</p>
            <h1 className="text-2xl font-heading font-semibold">{session.name}</h1>
            <p className="text-sm text-muted-foreground">
              Live ranking across overall score and every voting criterion.
            </p>
          </div>
        </div>

        {teams.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No teams available for this session.</p>
          </Card>
        ) : votes.length === 0 ? (
          <Card className="p-8 text-center space-y-2">
            <p className="text-sm font-medium">No votes submitted yet.</p>
            <p className="text-xs text-muted-foreground">Results will appear once voting starts.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {categories.map((category) => {
                const chartData = category.winners.map((winner, winnerIndex) => ({
                  rank: winnerIndex + 1,
                  team: winner.teamName,
                  score: Number(category.scoreFor(winner).toFixed(2)),
                }));

                return (
                  <Card key={category.key} className="p-4 space-y-4 h-full">
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
    </div>
  );
}
