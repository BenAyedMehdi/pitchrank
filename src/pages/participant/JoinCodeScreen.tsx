import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { clearParticipant, getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";

interface PreviousSession {
  sessionName: string;
}

export default function JoinCodeScreen() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [previousSession, setPreviousSession] = useState<PreviousSession | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const restoreSession = async () => {
      const participant = getParticipant();
      if (!participant) {
        setRestoring(false);
        return;
      }

      const [sessionRes, participantRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", participant.sessionId).maybeSingle(),
        supabase
          .from("participants")
          .select("id")
          .eq("id", participant.id)
          .eq("session_id", participant.sessionId)
          .maybeSingle(),
      ]);

      if (sessionRes.error || participantRes.error || !sessionRes.data || !participantRes.data) {
        clearParticipant();
        setRestoring(false);
        return;
      }

      // If the session is fully revealed (completed), don't auto-redirect.
      // Show the join form so the user can enter a new code, but keep a
      // non-intrusive link back to the previous results.
      if (sessionRes.data.status === "results_revealed") {
        setPreviousSession({ sessionName: sessionRes.data.name ?? "Previous session" });
        setRestoring(false);
        return;
      }

      const nextRoute = getParticipantRoute(sessionRes.data);
      navigate(nextRoute, { replace: true });
    };

    void restoreSession().finally(() => setRestoring(false));
  }, [navigate]);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setError("");
    setLoading(true);

    const { data, error: err } = await supabase
      .from("sessions")
      .select("*")
      .ilike("join_code", trimmed)
      .single();

    setLoading(false);

    if (err || !data) {
      console.error("Session lookup failed:", err);
      setError("Session not found. Check the code and try again.");
      return;
    }

    if (data.status === "setup") {
      setError("Session hasn't started yet. Ask the organiser to activate it.");
      return;
    }

    // Clear any stale participant data from a previous session before joining a new one
    clearParticipant();
    navigate(`/join/${data.join_code}`);
  };

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] flex flex-col items-center gap-8"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-bold">PitchRank</span>
        </div>

        {previousSession && (
          <div className="w-full rounded-xl border bg-card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Trophy className="w-4 h-4 shrink-0 text-amber-500" />
              <p className="text-sm text-muted-foreground truncate">
                Previous session: <span className="font-medium text-foreground">{previousSession.sessionName}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs gap-1 text-primary"
              onClick={() => navigate("/results")}
            >
              View results
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-bold">Enter session code</h1>
          <p className="text-muted-foreground text-sm">Ask your host for the code to join the session</p>
        </div>

        <div className="w-full space-y-4">
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 6)); setError(""); }}
            placeholder="ABC123"
            className="text-center text-2xl font-heading font-bold tracking-[0.2em] h-14 bg-card"
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button
            onClick={handleJoin}
            disabled={code.trim().length === 0 || loading}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {loading ? "Checking…" : "Join Session"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
