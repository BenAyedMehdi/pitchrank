import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, Loader2, Sparkles, Star, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { buildParticipantVoteSummaries } from "@/lib/participantVotes";
import {
  buildCriteriaDisplayLabels,
  buildResultsCategories,
  buildTeamResults,
  formatScore,
  getAllCategoryKeys,
  type ResultsCategoryKey,
} from "@/lib/results";
import { normalizeCriteriaLabels } from "@/lib/voting";

const PODIUM_COLORS = ["#F59E0B", "#94A3B8", "#CD7F32"];

function getCriteriaCountForSession(session: Tables<"sessions">): number {
  return normalizeCriteriaLabels(session.criteria_labels).length;
}

function getRevealedCategoryKeys(session: Tables<"sessions">, criteriaCount: number): ResultsCategoryKey[] {
  if (session.status === "results_revealed" && (session.results_revealed_categories?.length ?? 0) === 0) {
    return getAllCategoryKeys(criteriaCount);
  }

  return (session.results_revealed_categories || []) as ResultsCategoryKey[];
}

function getCategoryLabel(session: Tables<"sessions">, categoryKey: ResultsCategoryKey): string {
  if (categoryKey === "overall") return "Overall";

  const labels = normalizeCriteriaLabels(session.criteria_labels);
  const index = Number(categoryKey.replace("criterion-", ""));
  return labels[index] || `Criteria ${index + 1}`;
}

export default function ResultsScreen() {
  const navigate = useNavigate();
  const [participant] = useState(() => getParticipant());
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [votes, setVotes] = useState<Tables<"votes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategoryKey, setActiveCategoryKey] = useState<ResultsCategoryKey | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [countdownLabel, setCountdownLabel] = useState("");
  const [pendingRevealTarget, setPendingRevealTarget] = useState<
    { type: "single"; key: ResultsCategoryKey } | { type: "all" } | null
  >(null);
  const [myVotesOpen, setMyVotesOpen] = useState(false);

  const applySessionRevealState = (
    previousSession: Tables<"sessions"> | null,
    nextSession: Tables<"sessions">,
    triggerCountdown: boolean,
  ) => {
    const criteriaCount = getCriteriaCountForSession(nextSession);
    const allKeys = getAllCategoryKeys(criteriaCount);
    const nextRevealedKeys = getRevealedCategoryKeys(nextSession, criteriaCount);
    const previousRevealedKeys = previousSession
      ? getRevealedCategoryKeys(previousSession, getCriteriaCountForSession(previousSession))
      : [];
    const previousLastKey = previousRevealedKeys[previousRevealedKeys.length - 1];
    const nextLastKey = nextRevealedKeys[nextRevealedKeys.length - 1];
    const revealSequenceAdvanced =
      nextRevealedKeys.length > previousRevealedKeys.length || nextLastKey !== previousLastKey;
    const allRevealed = allKeys.length > 0 && allKeys.every((key) => nextRevealedKeys.includes(key));

    if (triggerCountdown && revealSequenceAdvanced) {
      const newKeys = nextRevealedKeys.filter((key) => !previousRevealedKeys.includes(key));
      if (newKeys.length > 0) {
        if (allRevealed) {
          setPendingRevealTarget({ type: "all" });
          setCountdownLabel("All categories");
          setCountdownSeconds(5);
          return;
        }

        const latestNewKey = newKeys[newKeys.length - 1];
        setPendingRevealTarget({ type: "single", key: latestNewKey });
        setCountdownLabel(getCategoryLabel(nextSession, latestNewKey));
        setCountdownSeconds(5);
        return;
      }

      const replayKey = nextLastKey;
      if (replayKey) {
        setPendingRevealTarget({ type: "single", key: replayKey });
        setCountdownLabel(getCategoryLabel(nextSession, replayKey));
        setCountdownSeconds(5);
        return;
      }
    }

    if (allRevealed) {
      setActiveCategoryKey(null);
      return;
    }

    if (nextRevealedKeys.length > 0) {
      setActiveCategoryKey(nextRevealedKeys[nextRevealedKeys.length - 1]);
    } else {
      setActiveCategoryKey(null);
    }
  };

  const loadData = async (
    sessionId: string,
    options?: { triggerCountdown?: boolean; sessionOverride?: Tables<"sessions"> },
  ) => {
    const nextSession = options?.sessionOverride
      ? options.sessionOverride
      : (await supabase.from("sessions").select("*").eq("id", sessionId).single()).data;

    if (!nextSession) {
      navigate("/lobby");
      return;
    }

    const nextRoute = getParticipantRoute(nextSession);
    if (nextRoute !== "/results") {
      navigate(nextRoute);
      return;
    }

    setSession((previous) => {
      applySessionRevealState(previous, nextSession, options?.triggerCountdown === true);
      return nextSession;
    });
    setError("");

    const [teamsRes, votesRes] = await Promise.all([
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    if (teamsRes.error) {
      console.error("Failed to load teams in participant results:", teamsRes.error);
      setError("Failed to load full results data. Retrying with available data.");
      setTeams([]);
    } else {
      setTeams(teamsRes.data || []);
    }

    if (votesRes.error) {
      console.error("Failed to load votes in participant results:", votesRes.error);
      setError("Failed to load full results data. Retrying with available data.");
      setVotes([]);
    } else {
      setVotes(votesRes.data || []);
    }
  };

  useEffect(() => {
    if (!participant) {
      navigate("/");
      return;
    }

    setLoading(true);
    loadData(participant.sessionId, { triggerCountdown: false }).finally(() => setLoading(false));

    const channel = supabase
      .channel(`participant-results-${participant.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${participant.sessionId}`,
        },
        (payload) => {
          const updatedSession = payload.new as Tables<"sessions">;
          void loadData(participant.sessionId, {
            triggerCountdown: true,
            sessionOverride: updatedSession,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `session_id=eq.${participant.sessionId}`,
        },
        () => {
          void loadData(participant.sessionId, { triggerCountdown: false });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, participant?.sessionId]);

  useEffect(() => {
    if (countdownSeconds === null) return;
    setMyVotesOpen(false);

    const timer = window.setTimeout(() => {
      if (countdownSeconds <= 1) {
        if (pendingRevealTarget?.type === "single") {
          setActiveCategoryKey(pendingRevealTarget.key);
        } else {
          setActiveCategoryKey(null);
        }

        setCountdownSeconds(null);
        setCountdownLabel("");
        setPendingRevealTarget(null);
        return;
      }

      setCountdownSeconds((current) => (current ? current - 1 : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdownSeconds, pendingRevealTarget]);

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

  const revealedCategoryKeys = useMemo(
    () => (session ? getRevealedCategoryKeys(session, criteriaDisplayLabels.length) : []),
    [criteriaDisplayLabels.length, session],
  );
  const revealedCategoryKeySet = useMemo(() => new Set(revealedCategoryKeys), [revealedCategoryKeys]);
  const allCategoryKeys = useMemo(
    () => getAllCategoryKeys(criteriaDisplayLabels.length),
    [criteriaDisplayLabels.length],
  );
  const allRevealed = useMemo(
    () => allCategoryKeys.length > 0 && allCategoryKeys.every((key) => revealedCategoryKeySet.has(key)),
    [allCategoryKeys, revealedCategoryKeySet],
  );

  const visibleCategories = useMemo(() => {
    if (activeCategoryKey && revealedCategoryKeySet.has(activeCategoryKey)) {
      return categories.filter((category) => category.key === activeCategoryKey);
    }

    if (allRevealed) {
      return categories.filter((category) => revealedCategoryKeySet.has(category.key));
    }

    const latestRevealedKey = revealedCategoryKeys[revealedCategoryKeys.length - 1];
    if (!latestRevealedKey) return [];

    return categories.filter((category) => category.key === latestRevealedKey);
  }, [activeCategoryKey, allRevealed, categories, revealedCategoryKeySet, revealedCategoryKeys]);

  const waitingForReveal = session?.status === "voting_closed" && revealedCategoryKeys.length === 0;
  const myVoteSummaries = useMemo(() => {
    if (!participant) return [];
    return buildParticipantVoteSummaries(votes, participant.id, teams, criteriaDisplayLabels);
  }, [criteriaDisplayLabels, participant, teams, votes]);

  if (!participant) return null;

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (countdownSeconds !== null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-200/20 via-primary/10 to-background" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative w-full max-w-[640px] rounded-3xl border bg-card/95 backdrop-blur p-8 md:p-10 text-center space-y-4 shadow-2xl"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">New Reveal Incoming</p>
          <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold">
            <span className="text-primary">{countdownLabel}</span> is coming in {countdownSeconds}s
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <p className="text-sm">Get ready for the next winner board.</p>
          </div>
          <p className="text-5xl md:text-6xl font-heading font-bold tabular-nums text-primary">{countdownSeconds}</p>
        </motion.div>
        <div className="relative z-20 mt-6">
          <Drawer open={myVotesOpen} onOpenChange={setMyVotesOpen}>
            <DrawerTrigger asChild>
              <Button variant="secondary" size="lg" className="rounded-full shadow-lg px-6">
                <Star className="w-4 h-4" />
                My Votes ({myVoteSummaries.length})
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[82vh]">
              <DrawerHeader>
                <DrawerTitle>My Submitted Votes</DrawerTitle>
                <DrawerDescription>These are only your own ratings.</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 overflow-y-auto space-y-3">
                {myVoteSummaries.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground">You have not submitted any votes yet.</Card>
                ) : (
                  myVoteSummaries.map((vote) => (
                    <Card key={vote.voteId} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{vote.teamName}</h4>
                        <span className="text-sm font-semibold text-primary">{vote.totalScore} pts</span>
                      </div>
                      <div className="space-y-1.5">
                        {vote.criteriaScores.map((item) => (
                          <div key={`${vote.voteId}-${item.label}`} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium">{item.score}/5</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    );
  }

  if (waitingForReveal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[560px] rounded-2xl border bg-card p-8 text-center space-y-4"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Results are coming soon</h1>
          <p className="text-muted-foreground">
            Voting is now closed. The host will reveal each category shortly.
          </p>
          <p className="text-xs text-muted-foreground">{session.name}</p>
        </motion.div>
        <div className="mt-6">
          <Drawer open={myVotesOpen} onOpenChange={setMyVotesOpen}>
            <DrawerTrigger asChild>
              <Button variant="secondary" size="lg" className="rounded-full shadow-lg px-6">
                <Star className="w-4 h-4" />
                My Votes ({myVoteSummaries.length})
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[82vh]">
              <DrawerHeader>
                <DrawerTitle>My Submitted Votes</DrawerTitle>
                <DrawerDescription>These are only your own ratings.</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 overflow-y-auto space-y-3">
                {myVoteSummaries.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground">You have not submitted any votes yet.</Card>
                ) : (
                  myVoteSummaries.map((vote) => (
                    <Card key={vote.voteId} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{vote.teamName}</h4>
                        <span className="text-sm font-semibold text-primary">{vote.totalScore} pts</span>
                      </div>
                      <div className="space-y-1.5">
                        {vote.criteriaScores.map((item) => (
                          <div key={`${vote.voteId}-${item.label}`} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium">{item.score}/5</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-[1200px] mx-auto space-y-6">
        {error ? (
          <Card className="p-3 border-amber-300 bg-amber-50">
            <p className="text-xs text-amber-900">{error}</p>
          </Card>
        ) : null}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Reveal</p>
            <h1 className="text-2xl font-heading font-semibold">Results: {session.name}</h1>
            <p className="text-sm text-muted-foreground">
              {allRevealed
                ? "All categories are revealed."
                : "Showing the latest revealed category."}
            </p>
          </div>
        </div>

        {visibleCategories.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No categories have been revealed yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visibleCategories.map((category, categoryIndex) => {
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
                          <span className="text-sm font-semibold tabular-nums">{formatScore(category.scoreFor(winner))}</span>
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
        )}
      </div>
      <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <Drawer open={myVotesOpen} onOpenChange={setMyVotesOpen}>
            <DrawerTrigger asChild>
              <Button
                size="lg"
                className="rounded-full shadow-2xl px-6 bg-primary text-primary-foreground"
              >
                <Star className="w-4 h-4" />
                My Votes ({myVoteSummaries.length})
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[82vh]">
              <DrawerHeader>
                <DrawerTitle>My Submitted Votes</DrawerTitle>
                <DrawerDescription>These are only your own ratings.</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 overflow-y-auto space-y-3">
                {myVoteSummaries.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground">You have not submitted any votes yet.</Card>
                ) : (
                  myVoteSummaries.map((vote) => (
                    <Card key={vote.voteId} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{vote.teamName}</h4>
                        <span className="text-sm font-semibold text-primary">{vote.totalScore} pts</span>
                      </div>
                      <div className="space-y-1.5">
                        {vote.criteriaScores.map((item) => (
                          <div key={`${vote.voteId}-${item.label}`} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium">{item.score}/5</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  );
}
