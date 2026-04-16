import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Clock, Loader2 } from "lucide-react";
import { AdminSessionLayout } from "@/components/AdminSessionLayout";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";

// TODO: Add QR code display using session join URL for easy mobile scanning

interface ParticipantWithTeam {
  id: string;
  name: string;
  teamName: string;
  joined_at: string;
}

export default function AdminLobbyScreen() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [participants, setParticipants] = useState<ParticipantWithTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const [sessionRes, teamsRes, participantsRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", id!).single(),
        supabase.from("teams").select("*").eq("session_id", id!),
        supabase.from("participants").select("*, teams(name)").eq("session_id", id!).order("joined_at", { ascending: false }),
      ]);

      if (sessionRes.data) setSession(sessionRes.data);
      if (teamsRes.data) setTeams(teamsRes.data);
      if (participantsRes.data) {
        setParticipants(
          participantsRes.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            teamName: p.is_observer ? "Observer" : (p.teams?.name ?? "No team"),
            joined_at: p.joined_at,
          }))
        );
      }
      setLoading(false);
    }
    load();

    // Realtime subscription for new participants
    const channel = supabase
      .channel(`participants-lobby-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${id}`,
        },
        async (payload) => {
          const newP = payload.new as Tables<"participants">;
          // Fetch team name for the new participant
          let teamName = "Observer";
          if (newP.team_id) {
            const { data: team } = await supabase
              .from("teams")
              .select("name")
              .eq("id", newP.team_id)
              .single();
            teamName = team?.name ?? "No team";
          }
          setParticipants((prev) => [
            { id: newP.id, name: newP.name, teamName, joined_at: newP.joined_at },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const statusMap = (s: string | undefined) => {
    if (s === "setup") return "setup" as const;
    if (s === "active") return "active" as const;
    return "closed" as const;
  };

  if (loading) {
    return (
      <AdminSessionLayout containerClassName="max-w-[1200px]">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminSessionLayout>
    );
  }

  return (
    <AdminSessionLayout
      sessionName={session?.name}
      sessionCode={session?.join_code}
      status={statusMap(session?.status)}
      isLive={session?.status === "active"}
      containerClassName="max-w-[1200px]"
      contentClassName="py-6 lg:py-8"
    >
      <div className="space-y-6">
        {/* Join code display */}
        <div className="rounded-2xl border bg-card flex flex-col items-center gap-2 py-5 md:py-6">
          <JoinCodeDisplay code={session?.join_code || "------"} size="lg" showCopyButton />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Ask participants to open the app and enter this code
          </p>
        </div>

        {/* Participant count */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Participants joined: {participants.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Live updates enabled
          </span>
        </div>

        {/* Participant list */}
        {participants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No one has joined yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Share the code above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {participants.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between bg-card rounded-xl border px-4 py-3 min-h-[76px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">
                      {p.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.teamName}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(p.joined_at), { addSuffix: true })}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminSessionLayout>
  );
}
