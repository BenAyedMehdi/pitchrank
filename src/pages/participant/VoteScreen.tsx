import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";
import { getSessionTimerRemaining, isTimerPaused } from "@/lib/timer";
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
  const [participant] = useState(() => getParticipant());

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
          void loadSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, participant?.id, participant?.sessionId]);

  const currentPitch = useMemo(() => {
    if (!session || teams.length === 0 || session.current_pitch_index < 0) return null;
    return teams.find((team) => team.pitch_order === session.current_pitch_index) || null;
  }, [session, teams]);
  const criteriaLabels = normalizeCriteriaLabels(session?.criteria_labels);
  const criteriaDisplayLabels = criteriaLabels.map((label, index) => (label.length > 0 ? label : `Criteria ${index + 1}`));
  const isOwnTeamPitch = !!participant && !!currentPitch && !participant.isObserver && participant.teamId === currentPitch.id;
  const canSubmit = isCompleteVote(scores, criteriaLabels.length) && !alreadyVoted && !isOwnTeamPitch && !submitting;
  const timerRemaining = session ? getSessionTimerRemaining(session, nowMs) : 0;
  const timerRunning = timerRemaining > 0;
  const timerPaused = session ? isTimerPaused(session) : false;

  useEffect(() => {
    if (!timerRunning || timerPaused) return;

    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [timerRunning, timerPaused]);

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
  if (!session || !currentPitch) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[520px] rounded-2xl border bg-card p-6 text-center"
        >
          <p className="text-sm text-muted-foreground">Preparing voting screen...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[560px] space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="font-heading text-3xl font-bold">Voting is open</h1>
          <p className="text-muted-foreground">
            {currentPitch ? `Now pitching: ${currentPitch.name}` : "Pitch in progress"}
          </p>
          {timerRunning ? (
            <p className="text-sm font-semibold text-primary">
              {timerPaused ? `Timer paused at ${timerRemaining}s` : `Time left: ${timerRemaining}s`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting for host to start 1-minute timer</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 md:p-6 space-y-5 shadow-sm">
          {isOwnTeamPitch ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Your team is pitching now. Sit back and enjoy.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-center">Rate this pitch (1-5)</p>
              {!isOwnTeamPitch && criteriaDisplayLabels.length === 0 ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4].map((j) => (
                          <div key={j} className="w-9 h-9 rounded-md border border-border bg-muted animate-pulse" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="space-y-4 md:space-y-5">
                {criteriaDisplayLabels.map((label, criteriaIndex) => (
                  <div
                    key={`${label}-${criteriaIndex}`}
                    className="space-y-3 rounded-xl border bg-background/60 px-3 py-3 md:px-4 md:py-4"
                  >
                    <p className="text-sm font-semibold text-center">{label}</p>
                    <div className="grid grid-cols-5 gap-2 max-w-[320px] mx-auto">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          onClick={() => setScore(criteriaIndex, value)}
                          className={cn(
                            "h-10 md:h-11 rounded-lg border text-sm md:text-base font-semibold transition-all",
                            scores[criteriaIndex] === value
                              ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
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
                disabled={!canSubmit || criteriaDisplayLabels.length === 0}
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
