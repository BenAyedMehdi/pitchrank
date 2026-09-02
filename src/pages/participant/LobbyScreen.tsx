import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Crown, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MyVotesDrawer } from "@/components/MyVotesDrawer";
import { getParticipant } from "@/lib/participantStore";
import { getParticipantRoute } from "@/lib/sessionRouting";
import { shouldRouteToVote } from "@/lib/voteRouting";
import { consumeLastVotedTeam } from "@/lib/voteFlash";
import { buildParticipantVoteSummaries } from "@/lib/participantVotes";
import { applyVoteScoresUpdate, canEditSubmittedVotes } from "@/lib/voteEditing";
import { buildCriteriaDisplayLabels } from "@/lib/results";
import { normalizeCriteriaLabels } from "@/lib/voting";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export default function LobbyScreen() {
  const navigate = useNavigate();
  const [participant] = useState(() => getParticipant());
  const [sessionName, setSessionName] = useState(participant?.sessionName || "");
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [criteriaLabelsRaw, setCriteriaLabelsRaw] = useState<string[] | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [myVotes, setMyVotes] = useState<Tables<"votes">[]>([]);
  const [myVotesOpen, setMyVotesOpen] = useState(false);
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
      const [sessionRes, teamsRes, votesRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("*")
          .eq("id", participant.sessionId)
          .single(),
        supabase.from("teams").select("*").eq("session_id", participant.sessionId).order("pitch_order"),
        supabase
          .from("votes")
          .select("*")
          .eq("session_id", participant.sessionId)
          .eq("participant_id", participant.id),
      ]);

      if (!sessionRes.data) return;

      setSessionName(sessionRes.data.name);
      setSessionStatus(sessionRes.data.status);
      setCriteriaLabelsRaw(sessionRes.data.criteria_labels);
      teamsRef.current = teamsRes.data || [];
      setTeams(teamsRes.data || []);
      setMyVotes(votesRes.data || []);

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

  const criteriaDisplayLabels = useMemo(
    () => buildCriteriaDisplayLabels(normalizeCriteriaLabels(criteriaLabelsRaw), myVotes),
    [criteriaLabelsRaw, myVotes],
  );

  const myVoteSummaries = useMemo(() => {
    if (!participant) return [];
    return buildParticipantVoteSummaries(myVotes, participant.id, teams, criteriaDisplayLabels);
  }, [criteriaDisplayLabels, myVotes, participant, teams]);

  const canEditVotes = canEditSubmittedVotes(sessionStatus);

  const handleSaveVote = async (voteId: string, criteriaScores: number[]) => {
    const { error } = await supabase
      .from("votes")
      .update({ criteria_scores: criteriaScores })
      .eq("id", voteId);

    if (error) {
      console.error("Failed to update vote:", error);
      toast.error(error.message || "Failed to update vote");
      return false;
    }

    setMyVotes((previous) => applyVoteScoresUpdate(previous, voteId, criteriaScores));
    toast.success("Vote updated");
    return true;
  };

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
          {participant.isUseCaseOwner ? (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              <Crown className="w-3.5 h-3.5" />
              Use case owner · 2x on your own project
            </p>
          ) : null}
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

        <MyVotesDrawer
          open={myVotesOpen}
          onOpenChange={setMyVotesOpen}
          summaries={myVoteSummaries}
          editable={canEditVotes}
          onSaveVote={handleSaveVote}
          trigger={
            <Button variant="secondary" size="lg" className="rounded-full shadow-lg px-6">
              <Star className="w-4 h-4" />
              My Votes ({myVoteSummaries.length})
            </Button>
          }
        />

        <p className="text-xs text-muted-foreground/60 mt-8">
          Sit tight — the host will start the session shortly.
        </p>
      </motion.div>
    </div>
  );
}
