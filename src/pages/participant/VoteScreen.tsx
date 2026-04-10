import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";
import { getSecondsRemaining } from "@/lib/timer";
import { shouldRouteToVote } from "@/lib/voteRouting";
import { setLastVotedTeam } from "@/lib/voteFlash";
import {
  isCompleteVote,
  mapScoresToCriteriaScores,
  normalizeCriteriaLabels,
} from "@/lib/voting";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export default function VoteScreen() {
  const navigate = useNavigate();
  const participant = getParticipant();

  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const teamsRef = useRef<Tables<"teams">[]>([]);
  const [scores, setScores] = useState<Array<number | null>>([]);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const hasVotedForTeam = async (sessionId: string, participantId: string, teamId: string) => {
    const { data, error } = await supabase
      .from("votes")
      .select("id")
      .eq("session_id", sessionId)
      .eq("participant_id", participantId)
      .eq("team_id", teamId)
      .maybeSingle();

    if (error) {
      console.error("Failed to check existing vote:", error);
      return false;
    }

    return Boolean(data);
  };

  useEffect(() => {
    if (!participant) {
      navigate("/");
      return;
    }

    const loadSession = async () => {
      const [sessionRes, teamsRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", participant.sessionId).single(),
        supabase.from("teams").select("*").eq("session_id", participant.sessionId).order("pitch_order"),
      ]);

      if (sessionRes.error || !sessionRes.data) {
        navigate("/lobby");
        return;
      }

      const nextRoute = getParticipantRoute(sessionRes.data);
      if (nextRoute !== "/vote") {
        navigate(nextRoute);
        return;
      }

      const currentPitchTeam = (teamsRes.data || []).find(
        (team) => team.pitch_order === sessionRes.data.current_pitch_index,
      );
      if (currentPitchTeam) {
        const alreadyVotedForPitch = await hasVotedForTeam(
          sessionRes.data.id,
          participant.id,
          currentPitchTeam.id,
        );
        setAlreadyVoted(alreadyVotedForPitch);
        if (!shouldRouteToVote(nextRoute, alreadyVotedForPitch)) {
          navigate("/lobby");
          return;
        }
      } else {
        setAlreadyVoted(false);
      }

      setSession(sessionRes.data);
      setTeams(teamsRes.data || []);
      teamsRef.current = teamsRes.data || [];
    };

    void loadSession();

    const channel = supabase
      .channel(`participant-vote-${participant.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${participant.sessionId}`,
        },
        (payload) => {
          if (!participant) return;
          const updated = payload.new as Tables<"sessions">;
          const nextRoute = getParticipantRoute(updated);
          if (nextRoute !== "/vote") {
            navigate(nextRoute);
            return;
          }
          const handle = async () => {
            const teamId = teamsRef.current.find((team) => team.pitch_order === updated.current_pitch_index)?.id;
            if (!teamId) {
              setSession(updated);
              return;
            }

            const alreadyVotedForPitch = await hasVotedForTeam(updated.id, participant.id, teamId);
            setAlreadyVoted(alreadyVotedForPitch);
            if (!shouldRouteToVote(nextRoute, alreadyVotedForPitch)) {
              navigate("/lobby");
              return;
            }

            setSession(updated);
          };

          void handle();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, participant]);

  const currentPitch = useMemo(() => {
    if (!session || teams.length === 0 || session.current_pitch_index < 0) return null;
    return teams.find((team) => team.pitch_order === session.current_pitch_index) || null;
  }, [session, teams]);
  const criteriaLabels = normalizeCriteriaLabels(session?.criteria_labels);
  const criteriaDisplayLabels = criteriaLabels.map((label, index) => (label.length > 0 ? label : `Criteria ${index + 1}`));
  const isOwnTeamPitch = !!participant && !!currentPitch && !participant.isObserver && participant.teamId === currentPitch.id;
  const canSubmit = isCompleteVote(scores, criteriaLabels.length) && !alreadyVoted && !isOwnTeamPitch && !submitting;
  const timerRemaining = getSecondsRemaining(session?.timer_started_at ?? null, nowMs);
  const timerRunning = timerRemaining > 0;

  useEffect(() => {
    if (!timerRunning) return;

    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!session) return;

    const nextRoute = getParticipantRoute(session, nowMs);
    if (nextRoute !== "/vote") {
      navigate(nextRoute);
    }
  }, [navigate, nowMs, session]);

  useEffect(() => {
    setScores(Array(criteriaLabels.length).fill(null));
  }, [session?.id, session?.current_pitch_index, criteriaLabels.length]);

  const setScore = (criteriaIndex: number, value: number) => {
    setScores((prev) => prev.map((score, i) => (i === criteriaIndex ? value : score)));
  };

  const submitVote = async () => {
    if (!participant || !session || !currentPitch || !canSubmit) return;

    setSubmitting(true);
    const criteriaScores = mapScoresToCriteriaScores(scores);
    const { error } = await supabase.from("votes").insert({
      session_id: session.id,
      participant_id: participant.id,
      team_id: currentPitch.id,
      criteria_scores: criteriaScores,
    });

    if (error) {
      console.error("Failed to submit vote:", error);
      toast.error(error.message || "Failed to submit vote");
      setSubmitting(false);
      return;
    }

    setAlreadyVoted(true);
    setSubmitting(false);
    toast.success("Vote submitted");
    setLastVotedTeam(currentPitch.name);
    navigate("/lobby");
  };

  if (!participant) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[520px] space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="font-heading text-3xl font-bold">Voting is open</h1>
          <p className="text-muted-foreground">
            {currentPitch ? `Now pitching: ${currentPitch.name}` : "Pitch in progress"}
          </p>
          {timerRunning ? (
            <p className="text-sm font-semibold text-primary">Time left: {timerRemaining}s</p>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting for host to start 1-minute timer</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-4">
          {isOwnTeamPitch ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Your team is pitching now. Sit back and enjoy.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Rate this pitch (1-5)</p>
              <div className="space-y-4">
                {criteriaDisplayLabels.map((label, criteriaIndex) => (
                  <div key={`${label}-${criteriaIndex}`} className="space-y-2">
                    <p className="text-sm font-medium">{label}</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          onClick={() => setScore(criteriaIndex, value)}
                          className={cn(
                            "w-9 h-9 rounded-md border text-sm font-semibold transition-colors",
                            scores[criteriaIndex] === value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                          )}
                          disabled={alreadyVoted || submitting}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={submitVote}
                disabled={!canSubmit}
                className="w-full h-11"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {alreadyVoted ? "Vote already submitted" : "Submit vote"}
              </Button>

              {!alreadyVoted && !isCompleteVote(scores, criteriaLabels.length) ? (
                <p className="text-xs text-muted-foreground">Please rate every criteria before submitting.</p>
              ) : null}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
