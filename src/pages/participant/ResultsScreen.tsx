import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Star, Trophy, Users } from "lucide-react";
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
  getAllCategoryKeys,
} from "@/lib/results";
import { normalizeCriteriaLabels } from "@/lib/voting";

export default function ResultsScreen() {
  const navigate = useNavigate();
  const [participant] = useState(() => getParticipant());
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [participants, setParticipants] = useState<Tables<"participants">[]>([]);
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

    const [teamsRes, participantsRes, votesRes] = await Promise.all([
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase.from("participants").select("*").eq("session_id", sessionId),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    if (teamsRes.error) {
      console.error("Failed to load teams in participant results:", teamsRes.error);
      setError("Failed to load full results data.");
      setTeams([]);
    } else {
      setTeams(teamsRes.data || []);
    }

    if (participantsRes.error) {
      console.error("Failed to load participants in participant results:", participantsRes.error);
      setParticipants([]);
    } else {
      setParticipants(participantsRes.data || []);
    }

    if (votesRes.error) {
      console.error("Failed to load votes in participant results:", votesRes.error);
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
  const allCategoryKeys = useMemo(
    () => getAllCategoryKeys(criteriaDisplayLabels.length),
    [criteriaDisplayLabels.length],
  );

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const membersByTeamId = useMemo(() => {
    const map = new Map<string, string[]>();
    participants.forEach((p) => {
      if (!p.team_id || p.is_observer) return;
      const list = map.get(p.team_id) ?? [];
      list.push(p.name);
      map.set(p.team_id, list);
    });
    return map;
  }, [participants]);

  const isRevealed = session?.status === "results_revealed";

  const winnerCards = useMemo(() => {
    if (!isRevealed || !session) return [];
    const stored = session.category_winners as Record<string, string> | null;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return [];
    return allCategoryKeys
      .map((key) => {
        const teamId = stored[key];
        if (!teamId) return null;
        const label = key === "overall"
          ? "Overall"
          : criteriaDisplayLabels[parseInt(key.replace("criterion-", ""), 10)] ?? key;
        return {
          key,
          label,
          teamId,
          teamName: teamById.get(teamId)?.name ?? "Unknown team",
          members: membersByTeamId.get(teamId) ?? [],
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [isRevealed, session, allCategoryKeys, criteriaDisplayLabels, teamById, membersByTeamId]);

  const myVoteSummaries = useMemo(() => {
    if (!participant) return [];
    return buildParticipantVoteSummaries(votes, participant.id, teams, criteriaDisplayLabels);
  }, [criteriaDisplayLabels, participant, teams, votes]);

  useEffect(() => {
    if (!session) return;
    if (!isRevealed) {
      hasShownRevealCountdownRef.current = false;
      setRevealCountdownSeconds(null);
      return;
    }
    if (hasShownRevealCountdownRef.current) return;
    hasShownRevealCountdownRef.current = true;
    setRevealCountdownSeconds(5);
  }, [isRevealed, session]);

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

  if (!isRevealed) {
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
            Winners starting in {revealCountdownSeconds}s
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
      <div className="max-w-[900px] mx-auto space-y-6">
        {error ? (
          <Card className="p-3 border-amber-300 bg-amber-50">
            <p className="text-xs text-amber-900">{error}</p>
          </Card>
        ) : null}

        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-card to-card p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-yellow-300/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Final Results</p>
              <h1 className="text-2xl font-heading font-bold">{session.name}</h1>
            </div>
          </div>
        </div>

        {winnerCards.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Winners have not been determined yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {winnerCards.map((card, index) => (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-md space-y-3 h-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">{card.label}</span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm">
                      <Trophy className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <h2 className="text-xl font-heading font-bold text-amber-900">{card.teamName}</h2>
                  {card.members.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700">
                        <Users className="h-3.5 w-3.5" />
                        <span>Team members</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {card.members.map((name) => (
                          <span
                            key={name}
                            className="rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-medium text-amber-800"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ))}
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
