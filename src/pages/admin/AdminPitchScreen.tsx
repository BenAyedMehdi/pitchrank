import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Timer, Lock, ArrowRight, CheckCircle2, Clock, Search, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AdminSessionLayout } from "@/components/AdminSessionLayout";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

// Steps for the pitch flow
const STEPS = [
  {
    key: "start",
    label: "Start Pitch",
    icon: Timer,
    helper: "Signals participants that this team's pitch has begun.",
  },
  {
    key: "timer",
    label: "Trigger 1-min Timer",
    icon: Timer,
    helper: "Starts a 60-second countdown on every voter's screen.",
  },
  {
    key: "close",
    label: "Close Voting",
    icon: Lock,
    helper: "Locks the voting form — no more votes for this team.",
  },
  {
    key: "next",
    label: "Next Team →",
    icon: ArrowRight,
    helper: "Advances to the next team and resets the voting flow.",
  },
] as const;

export default function AdminPitchScreen() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [participants, setParticipants] = useState<(Tables<"participants"> & { teams: { name: string } | null })[]>([]);
  const [votes, setVotes] = useState<Tables<"votes">[]>([]);
  const [selectedTeam, setSelectedTeam] = useState(0);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [startingPitch, setStartingPitch] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const loadData = async (sessionId: string) => {
    const [sessionRes, teamsRes, participantsRes, votesRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase
        .from("participants")
        .select("*, teams(name)")
        .eq("session_id", sessionId),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    if (sessionRes.error) throw sessionRes.error;
    if (teamsRes.error) throw teamsRes.error;
    if (participantsRes.error) throw participantsRes.error;
    if (votesRes.error) throw votesRes.error;

    setSession(sessionRes.data);
    setTeams(teamsRes.data || []);
    setParticipants((participantsRes.data || []) as (Tables<"participants"> & { teams: { name: string } | null })[]);
    setVotes(votesRes.data || []);

    if ((teamsRes.data || []).length > 0) {
      const idx = sessionRes.data.current_pitch_index;
      const maxIndex = (teamsRes.data || []).length - 1;
      setSelectedTeam(idx >= 0 && idx <= maxIndex ? idx : 0);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadData(id)
      .catch((error) => {
        console.error("Failed to load pitch data:", error);
        toast.error("Failed to load pitch data");
      })
      .finally(() => setLoading(false));

    const channel = supabase
      .channel(`admin-pitch-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const selectedTeamRow = teams[selectedTeam] ?? null;

  const eligibleVoters = useMemo(() => {
    if (!selectedTeamRow) return [];
    return participants.filter((p) => p.is_observer || p.team_id !== selectedTeamRow.id);
  }, [participants, selectedTeamRow]);

  const votedIds = useMemo(() => {
    if (!selectedTeamRow) return new Set<string>();
    const teamVotes = votes.filter((v) => v.team_id === selectedTeamRow.id);
    return new Set(teamVotes.map((v) => v.participant_id));
  }, [votes, selectedTeamRow]);

  const visibleVoters = useMemo(() => {
    const search = filter.trim().toLowerCase();
    const rows = eligibleVoters.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.is_observer ? "Observer" : (p.teams?.name ?? "No team"),
      voted: votedIds.has(p.id),
    }));
    const filtered = search
      ? rows.filter((r) => r.name.toLowerCase().includes(search) || r.team.toLowerCase().includes(search))
      : rows;
    return filtered.sort((a, b) => Number(a.voted) - Number(b.voted));
  }, [eligibleVoters, filter, votedIds]);

  const votedCount = visibleVoters.filter((v) => v.voted).length;
  const totalVoters = visibleVoters.length;
  const percentage = totalVoters === 0 ? 0 : Math.round((votedCount / totalVoters) * 100);

  const pitchesCompleted = session && session.current_pitch_index >= 0 ? session.current_pitch_index + 1 : 0;
  const activeStep = session?.status === "active" && session.current_pitch_index >= 0 ? 1 : 0;

  const handleStartPitch = async () => {
    if (!id || !selectedTeamRow) return;
    setStartingPitch(true);
    const { error } = await supabase.rpc("start_pitch", {
      p_session_id: id,
      p_team_id: selectedTeamRow.id,
    });
    if (error) {
      console.error("Failed to start pitch:", error);
      toast.error(error.message || "Failed to start pitch");
      setStartingPitch(false);
      return;
    }
    await loadData(id);
    setStartingPitch(false);
    toast.success(`Pitch started for ${selectedTeamRow.name}`);
  };

  const statusMap = (s: string | undefined) => {
    if (s === "setup") return "setup" as const;
    if (s === "active") return "active" as const;
    return "closed" as const;
  };

  if (loading) {
    return (
      <AdminSessionLayout>
        <div className="py-10 text-sm text-muted-foreground text-center">Loading pitch data...</div>
      </AdminSessionLayout>
    );
  }

  return (
    <AdminSessionLayout
      sessionName={session?.name}
      sessionCode={session?.join_code}
      status={statusMap(session?.status)}
      isLive={session?.status === "active"}
    >
      <div className="space-y-5">
        {/* Section 1 — Current Pitch Status */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Pitch {teams.length === 0 ? 0 : selectedTeam + 1} of {teams.length}
          </p>
          <h2 className="font-heading text-2xl font-bold">{selectedTeamRow?.name ?? "No teams configured"}</h2>
        </div>

        {/* Section 5 — Team Selector (horizontal pills) */}
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {teams.map((team, i) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(i)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  i === selectedTeam
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
                )}
              >
                {team.name}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Only advance to a team once their pitch has started.
          </p>
        </div>

        {/* Section 2 — Action Buttons */}
        <Card className="p-4 space-y-3">
          <h3 className="font-heading text-sm font-semibold">Pitch flow</h3>
          <div className="space-y-2">
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isDone = i < activeStep;
              const isFuture = i > activeStep;

              return (
                <div key={step.key} className="space-y-0.5">
                  <Button
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "w-full h-11 justify-start gap-2 text-sm",
                      isDone && "bg-success/10 border-success/30 text-success hover:bg-success/15",
                      isFuture && "opacity-40"
                    )}
                    disabled={isFuture || (step.key === "start" && (!selectedTeamRow || startingPitch))}
                    onClick={() => {
                      if (step.key === "start") {
                        void handleStartPitch();
                        return;
                      }
                      toast.info(`${step.label} is not wired yet.`);
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                    {step.label}
                  </Button>
                  <p className="text-[10px] text-muted-foreground pl-1">{step.helper}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Section 3 — Voter Tracking */}
        <Card className="p-4 space-y-4">
          <h3 className="font-heading text-sm font-semibold">Voter status</h3>

          {/* Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Voted: {votedCount} / {totalVoters}
              </span>
              <span className="text-muted-foreground text-xs">
                Not yet: {totalVoters - votedCount}
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
            <p className="text-[10px] text-muted-foreground text-right">{percentage}%</p>
          </div>

          {/* Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name..."
              className="h-9 pl-9 text-xs bg-background"
            />
          </div>

          {/* Voter list */}
          <div className="max-h-[300px] overflow-y-auto space-y-1.5 -mx-1 px-1">
            {visibleVoters.map((voter, i) => (
              <motion.div
                key={voter.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-primary">
                      {voter.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium leading-tight">{voter.name}</p>
                    <p className="text-[10px] text-muted-foreground">{voter.team}</p>
                  </div>
                </div>
                {voter.voted ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Section 4 — Session Stats (collapsible) */}
        <Card className="overflow-hidden">
          <button
            onClick={() => setStatsOpen(!statsOpen)}
            className="w-full flex items-center justify-between p-4 text-sm font-semibold font-heading hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Session stats
            </span>
            {statsOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {statsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="px-4 pb-4"
            >
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total votes cast", value: String(votes.length) },
                  {
                    label: "Avg votes / pitch",
                    value: String(teams.length === 0 ? 0 : Math.round(votes.length / teams.length)),
                  },
                  { label: "Pitches completed", value: `${pitchesCompleted} / ${teams.length}` },
                  { label: "Participation rate", value: `${percentage}%` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-muted/50 rounded-lg p-3 text-center"
                  >
                    <p className="text-lg font-heading font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </Card>
      </div>
    </AdminSessionLayout>
  );
}
