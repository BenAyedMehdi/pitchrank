import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";
import { shouldRouteToVote } from "@/lib/voteRouting";
import { consumeLastVotedTeam } from "@/lib/voteFlash";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export default function LobbyScreen() {
  const navigate = useNavigate();
  const [participant] = useState(() => getParticipant());
  const [sessionName, setSessionName] = useState(participant?.sessionName || "");
  const teamsRef = useRef<Tables<"teams">[]>([]);
  const [lastVotedTeamName] = useState<string | null>(() => consumeLastVotedTeam());

  useEffect(() => {
    if (!participant) {
      navigate("/");
      return;
    }

    const hasVotedForCurrentPitch = async (sessionRow: Tables<"sessions">) => {
      let currentTeam = teamsRef.current.find((team) => team.pitch_order === sessionRow.current_pitch_index);
      if (!currentTeam && sessionRow.current_pitch_index >= 0) {
        const { data } = await supabase
          .from("teams")
          .select("*")
          .eq("session_id", sessionRow.id)
          .eq("pitch_order", sessionRow.current_pitch_index)
          .maybeSingle();
        currentTeam = data ?? undefined;
      }
      if (!currentTeam) return false;

      const { data, error } = await supabase
        .from("votes")
        .select("id")
        .eq("session_id", sessionRow.id)
        .eq("participant_id", participant.id)
        .eq("team_id", currentTeam.id)
        .maybeSingle();

      if (error) {
        console.error("Failed to check vote status in lobby:", error);
        return false;
      }

      return Boolean(data);
    };

    const syncSession = async () => {
      const [sessionRes, teamsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("*")
          .eq("id", participant.sessionId)
          .single(),
        supabase.from("teams").select("*").eq("session_id", participant.sessionId).order("pitch_order"),
      ]);

      if (!sessionRes.data) return;

      setSessionName(sessionRes.data.name);
      teamsRef.current = teamsRes.data || [];

      const nextRoute = getParticipantRoute(sessionRes.data);
      const votedForCurrentPitch = await hasVotedForCurrentPitch(sessionRes.data);
      if (shouldRouteToVote(nextRoute, votedForCurrentPitch)) {
        navigate(nextRoute);
        return;
      }

      if (nextRoute === "/results") {
        navigate(nextRoute);
      }
    };

    void syncSession();

    // Realtime subscription on session state changes
    const channel = supabase
      .channel(`session-state-${participant.sessionId}`)
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
          setSessionName(updated.name);
          void syncSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, participant?.id, participant?.sessionId]);

  if (!participant) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] flex flex-col items-center gap-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Zap className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold">You're in, {participant.name}!</h1>
          <p className="text-muted-foreground">
            {lastVotedTeamName
              ? `You voted for ${lastVotedTeamName}. Wait until the admin starts the next voting session.`
              : "Waiting for the session to start…"}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse-dot" />
          {sessionName}
        </div>

        <p className="text-xs text-muted-foreground/60 mt-8">
          Sit tight — the host will start the session shortly.
        </p>
      </motion.div>
    </div>
  );
}
