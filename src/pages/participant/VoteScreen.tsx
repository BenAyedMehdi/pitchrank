import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";
import { getSecondsRemaining } from "@/lib/timer";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export default function VoteScreen() {
  const navigate = useNavigate();
  const participant = getParticipant();

  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());

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

      setSession(sessionRes.data);
      setTeams(teamsRes.data || []);
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
          const updated = payload.new as Tables<"sessions">;
          const nextRoute = getParticipantRoute(updated);
          if (nextRoute !== "/vote") {
            navigate(nextRoute);
            return;
          }
          setSession(updated);
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
          <p className="text-sm font-medium">Rate this pitch (1-5)</p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border bg-background px-3 py-2">Technicality</div>
            <div className="rounded-lg border bg-background px-3 py-2">Pitch quality</div>
            <div className="rounded-lg border bg-background px-3 py-2">Functionality</div>
            <div className="rounded-lg border bg-background px-3 py-2">Innovation</div>
          </div>
          <p className="text-xs text-muted-foreground">Scoring inputs and submission are implemented in the next story.</p>
        </div>
      </motion.div>
    </div>
  );
}
