import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, Loader2, Sparkles, Star, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  getAllCategoryKeys,
  type ResultsCategoryKey,
} from "@/lib/results";
import { normalizeCriteriaLabels } from "@/lib/voting";

const PODIUM_COLORS = ["#F59E0B", "#94A3B8", "#CD7F32"];
const PODIUM_COLUMN_HEIGHTS: Record<number, string> = {
  1: "h-24",
  2: "h-16",
  3: "h-12",
};

function getRevealedCategoryKeys(session: Tables<"sessions">, criteriaCount: number): ResultsCategoryKey[] {
  if (session.status === "results_revealed" && (session.results_revealed_categories?.length ?? 0) === 0) {
    return getAllCategoryKeys(criteriaCount);
  }

  return (session.results_revealed_categories || []) as ResultsCategoryKey[];
}

export default function ResultsScreen() {
  const navigate = useNavigate();
  const [participant] = useState(() => getParticipant());
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [votes, setVotes] = useState<Tables<"votes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [myVotesOpen, setMyVotesOpen] = useState(false);
  const [revealCountdownSeconds, setRevealCountdownSeconds] = useState<number | null>(null);
  const hasShownRevealCountdownRef = useRef(false);

  const loadData = async (
    sessionId: string,
    options?: { sessionOverride?: Tables<"sessions"> },
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

    setSession(nextSession);
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
    loadData(participant.sessionId).finally(() => setLoading(false));

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
          void loadData(participant.sessionId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, participant?.sessionId]);

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
    if (!allRevealed) return [];
    return categories.filter((category) => revealedCategoryKeySet.has(category.key));
  }, [allRevealed, categories, revealedCategoryKeySet]);
  const waitingForReveal = !allRevealed;
  const myVoteSummaries = useMemo(() => {
    if (!participant) return [];
    return buildParticipantVoteSummaries(votes, participant.id, teams, criteriaDisplayLabels);
  }, [criteriaDisplayLabels, participant, teams, votes]);

  useEffect(() => {
    if (!session) return;

    if (session.status !== "results_revealed") {
      hasShownRevealCountdownRef.current = false;
      setRevealCountdownSeconds(null);
      return;
    }

    if (!allRevealed || hasShownRevealCountdownRef.current) return;
    hasShownRevealCountdownRef.current = true;
    setRevealCountdownSeconds(5);
  }, [allRevealed, session]);

  useEffect(() => {
    if (revealCountdownSeconds === null) return;

    const timer = window.setTimeout(() => {
      if (revealCountdownSeconds <= 1) {
        setRevealCountdownSeconds(null);
        return;
      }
      setRevealCountdownSeconds((previous) => (previous ? previous - 1 : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [revealCountdownSeconds]);

  if (!participant) return null;

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
            We are waiting for the admin to reveal the results.
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

  if (revealCountdownSeconds !== null) {
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
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Results Reveal</p>
          <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold">
            Full rankings start in {revealCountdownSeconds}s
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <p className="text-sm">Get ready for the final board.</p>
          </div>
          <p className="text-5xl md:text-6xl font-heading font-bold tabular-nums text-primary">{revealCountdownSeconds}</p>
        </motion.div>
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
              Rankings are shown for each category without point totals.
            </p>
          </div>
        </div>

        {visibleCategories.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No categories have been revealed yet.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {visibleCategories.map((category, categoryIndex) => {
                const podiumWinners = category.winners.slice(0, 3);
                const podiumByRank = new Map(
                  podiumWinners.map((team, index) => [index + 1, team]),
                );

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
                      {podiumWinners.length > 0 ? (
                        <div className="rounded-xl border bg-card p-3">
                          <div className="grid grid-cols-3 gap-2 items-end">
                            {[2, 1, 3].map((rank) => {
                              const team = podiumByRank.get(rank);
                              const color = PODIUM_COLORS[rank - 1] ?? "hsl(var(--primary))";
                              const heightClass = PODIUM_COLUMN_HEIGHTS[rank] ?? "h-12";

                              if (!team) {
                                return (
                                  <div key={`${category.key}-podium-empty-${rank}`} className="text-center">
                                    <div className="h-8" />
                                    <div className="rounded-t-md border border-dashed bg-muted/20 h-10" />
                                  </div>
                                );
                              }

                              return (
                                <div key={team.teamId} className="text-center">
                                  <p className="text-xs font-medium truncate mb-1">{team.teamName}</p>
                                  <div
                                    className={`rounded-t-md border ${heightClass} flex items-center justify-center text-xs font-semibold`}
                                    style={{ backgroundColor: `${color}33`, borderColor: `${color}88` }}
                                  >
                                    #{rank}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {category.winners.map((winner, winnerIndex) => (
                        <div key={winner.teamId} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-foreground"
                              style={{ backgroundColor: `${PODIUM_COLORS[winnerIndex] ?? "hsl(var(--primary))"}33` }}
                            >
                              #{winnerIndex + 1}
                            </span>
                            <span className="font-medium truncate">{winner.teamName}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
                );
              })}
            </div>
          </>
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
