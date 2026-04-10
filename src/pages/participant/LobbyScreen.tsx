import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export default function LobbyScreen() {
  const navigate = useNavigate();
  const participant = getParticipant();
  const [sessionName, setSessionName] = useState(participant?.sessionName || "");

  useEffect(() => {
    if (!participant) {
      navigate("/");
      return;
    }

    const syncSession = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", participant.sessionId)
        .single();

      if (!data) return;

      setSessionName(data.name);

      const nextRoute = getParticipantRoute(data);
      if (nextRoute !== "/lobby") {
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
          const updated = payload.new as Tables<"sessions">;
          setSessionName(updated.name);

          const nextRoute = getParticipantRoute(updated);
          if (nextRoute !== "/lobby") {
            navigate(nextRoute);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, participant]);

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
          <p className="text-muted-foreground">Waiting for the session to start…</p>
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
