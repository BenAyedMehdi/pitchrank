import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Timer,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Users,
  Pause,
  Play,
  Plus,
  UserX,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AdminSessionLayout } from "@/components/AdminSessionLayout";
import { cn } from "@/lib/utils";
import { getSessionTimerRemaining, isTimerPaused } from "@/lib/timer";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

const STEPS = [
  {
    key: "start",
    label: "Start Pitch",
    icon: Timer,
    helper: "Signals participants that this team's pitch has begun. They can start filling in scores.",
  },
  {
    key: "timer",
    label: "Start Timer",
    icon: Play,
    helper: "Starts the 1-minute countdown after the team finishes pitching.",
  },
  {
    key: "close",
    label: "Close Voting",
    icon: Lock,
    helper: "Stops the current pitch and closes voting immediately.",
  },
  {
    key: "next",
    label: "Next Team ->",
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
  const [startingTimer, setStartingTimer] = useState(false);
  const [stoppingPitch, setStoppingPitch] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const loadData = async (sessionId: string) => {
    const [sessionRes, teamsRes, participantsRes, votesRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase.from("participants").select("*, teams(name)").eq("session_id", sessionId),
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
      setSelectedTeam((prev) => {
        if (prev >= 0 && prev <= maxIndex) return prev;
        return idx >= 0 && idx <= maxIndex ? idx : 0;
      });
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "participants", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes", filter: `session_id=eq.${id}` }, (payload) => {
        const insertedVote = payload.new as Tables<"votes">;
        setVotes((prev) => (prev.some((v) => v.id === insertedVote.id) ? prev : [...prev, insertedVote]));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const selectedTeamRow = teams[selectedTeam] ?? null;
  const activePitchIndex = session?.current_pitch_index ?? -1;
  const pitchSelected = session?.status === "active" && activePitchIndex >= 0;
  const timerPaused = session ? isTimerPaused(session) : false;
  const timerRemaining = session ? getSessionTimerRemaining(session, nowMs) : 0;
  const timerHasStarted =
    pitchSelected &&
    (session?.timer_started_at != null || session?.timer_paused_remaining_seconds != null);
  const timerRunning = timerHasStarted && !timerPaused && timerRemaining > 0;
  const currentPitchTeam = teams.find((team) => team.pitch_order === activePitchIndex) ?? null;
  const trackedTeam = selectedTeamRow ?? currentPitchTeam;

  const votedIds = useMemo(() => {
    if (!trackedTeam) return new Set<string>();
    const teamVotes = votes.filter((v) => v.team_id === trackedTeam.id);
    return new Set(teamVotes.map((v) => v.participant_id));
  }, [votes, trackedTeam]);

  const allVoterRows = useMemo(() => {
    return participants.map((p) => ({
      id: p.id,
      name: typeof p.name === "string" && p.name.trim().length > 0 ? p.name : "Unknown voter",
      team: p.is_observer
        ? "Observer"
        : typeof p.teams?.name === "string" && p.teams.name.trim().length > 0
          ? p.teams.name
          : "No team",
      isTeamMember: Boolean(trackedTeam && !p.is_observer && p.team_id === trackedTeam.id),
      voted: votedIds.has(p.id),
      isExcluded: Boolean(p.is_excluded),
    }));
  }, [participants, trackedTeam, votedIds]);

  const visibleVoters = useMemo(() => {
    const search = filter.trim().toLowerCase();
    const filtered = search
      ? allVoterRows.filter((r) => r.name.toLowerCase().includes(search) || r.team.toLowerCase().includes(search))
      : allVoterRows;
    return filtered.sort((a, b) => Number(a.voted) - Number(b.voted));
  }, [allVoterRows, filter]);

  const eligibleVoters = allVoterRows.filter((v) => !v.isTeamMember && !v.isExcluded);
  const votedCount = eligibleVoters.filter((v) => v.voted).length;
  const totalVoters = eligibleVoters.length;
  const percentage = totalVoters === 0 ? 0 : Math.round((votedCount / totalVoters) * 100);
  const teamMemberCount = allVoterRows.filter((v) => v.isTeamMember).length;
  const excludedCount = allVoterRows.filter((v) => !v.isTeamMember && v.isExcluded).length;

  const teamsWithStartedVoting = useMemo(() => {
    const ids = new Set(votes.map((vote) => vote.team_id));
    if (pitchSelected && currentPitchTeam?.id) ids.add(currentPitchTeam.id);
    return ids;
  }, [votes, pitchSelected, currentPitchTeam?.id]);

  const teamVoteStatus = useMemo(() => {
    const result = new Map<string, "all-voted" | "in-progress">();

    for (const teamId of teamsWithStartedVoting) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) continue;

      const teamVotedIds = new Set(votes.filter((v) => v.team_id === teamId).map((v) => v.participant_id));
      const eligible = participants.filter(
        (p) => !p.is_excluded && (p.is_observer || p.team_id !== team.id),
      );
      const allVoted = eligible.length > 0 && eligible.every((p) => teamVotedIds.has(p.id));
      result.set(teamId, allVoted ? "all-voted" : "in-progress");
    }

    return result;
  }, [teamsWithStartedVoting, teams, votes, participants]);

  const pitchesCompleted = session && session.current_pitch_index >= 0 ? session.current_pitch_index + 1 : 0;
  const activeStep = !pitchSelected ? 0 : !timerHasStarted ? 1 : 2;

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const handleStartPitch = async () => {
    if (!id || !selectedTeamRow) return;

    setStartingPitch(true);
    const { error: startError } = await supabase.rpc("start_pitch", {
      p_session_id: id,
      p_team_id: selectedTeamRow.id,
    });

    if (startError) {
      console.error("Failed to start pitch:", startError);
      toast.error(startError.message || "Failed to start pitch");
      setStartingPitch(false);
      return;
    }

    // Keep G6 behavior even if RPC implementation differs: pitch start must not auto-start timer.
    const { error: resetTimerError } = await supabase
      .from("sessions")
      .update({
        timer_started_at: null,
        timer_duration_seconds: session?.timer_default_seconds ?? 60,
        timer_paused_remaining_seconds: null,
      })
      .eq("id", id);

    if (resetTimerError) {
      console.error("Failed to reset timer after pitch start:", resetTimerError);
      toast.error(resetTimerError.message || "Failed to reset timer after pitch start");
      setStartingPitch(false);
      return;
    }

    await loadData(id);
    setNowMs(Date.now());
    setStartingPitch(false);
    toast.success(`Pitch started for ${selectedTeamRow.name}. Start timer when voting should begin.`);
  };

  const handleStartTimer = async () => {
    if (!id || !session || !pitchSelected || timerHasStarted) return;

    setStartingTimer(true);
    const { error } = await supabase
      .from("sessions")
      .update({
        timer_started_at: new Date().toISOString(),
        timer_duration_seconds: session.timer_default_seconds ?? 60,
        timer_paused_remaining_seconds: null,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to start timer:", error);
      toast.error(error.message || "Failed to start timer");
      setStartingTimer(false);
      return;
    }

    await loadData(id);
    setNowMs(Date.now());
    setStartingTimer(false);
    toast.success("1-minute voting timer started");
  };

  const handleStopVoting = async () => {
    if (!id || !pitchSelected) return;

    setStoppingPitch(true);
    const { error } = await supabase
      .from("sessions")
      .update({
        current_pitch_index: -1,
        timer_started_at: null,
        timer_paused_remaining_seconds: null,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to stop current pitch:", error);
      toast.error(error.message || "Failed to stop current pitch");
      setStoppingPitch(false);
      return;
    }

    await loadData(id);
    setNowMs(Date.now());
    setStoppingPitch(false);
    toast.success("Pitch stopped and voting closed");
  };

  const handlePauseTimer = async () => {
    if (!id || !session || !timerHasStarted || timerPaused || timerRemaining <= 0) return;

    const remaining = getSessionTimerRemaining(session, Date.now());
    const { error } = await supabase
      .from("sessions")
      .update({
        timer_started_at: null,
        timer_paused_remaining_seconds: remaining,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to pause timer:", error);
      toast.error(error.message || "Failed to pause timer");
      return;
    }

    await loadData(id);
    setNowMs(Date.now());
    toast.success("Timer paused");
  };

  const handleResumeTimer = async () => {
    if (!id || !session || !timerHasStarted || !timerPaused) return;

    const remaining = session.timer_paused_remaining_seconds ?? 0;
    const duration = session.timer_duration_seconds ?? 60;
    const elapsedSeconds = Math.max(0, duration - remaining);
    const resumedStartedAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString();

    const { error } = await supabase
      .from("sessions")
      .update({
        timer_started_at: resumedStartedAt,
        timer_paused_remaining_seconds: null,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to resume timer:", error);
      toast.error(error.message || "Failed to resume timer");
      return;
    }

    await loadData(id);
    setNowMs(Date.now());
    toast.success("Timer resumed");
  };

  const handleExtendTimer = async () => {
    if (!id || !session || !pitchSelected) return;

    const { error } = await supabase
      .from("sessions")
      .update({
        timer_duration_seconds: (session.timer_duration_seconds ?? 60) + 30,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to extend timer:", error);
      toast.error(error.message || "Failed to extend timer");
      return;
    }

    await loadData(id);
    setNowMs(Date.now());
    toast.success("Timer extended by 30 seconds");
  };

  const handleToggleExclusion = async (participantId: string, currentlyExcluded: boolean) => {
    const { error } = await supabase
      .from("participants")
      .update({ is_excluded: !currentlyExcluded })
      .eq("id", participantId);

    if (error) {
      console.error("Failed to toggle voter exclusion:", error);
      toast.error(error.message || "Failed to update voter status");
      return;
    }

    await loadData(id!);
    toast.success(currentlyExcluded ? "Voter included: their scores will count again." : "Voter excluded: their scores are omitted from all averages.");
  };

  const statusMap = (s: string | undefined) => {
    if (s === "setup") return "setup" as const;
    if (s === "active") return "active" as const;
    return "closed" as const;
  };

  if (loading) {
    return (
      <AdminSessionLayout containerClassName="max-w-[1100px]">
        <div className="py-10 text-center text-sm text-muted-foreground">Loading pitch data...</div>
      </AdminSessionLayout>
    );
  }

  if (!session) {
    return (
      <AdminSessionLayout>
        <Card className="space-y-2 p-6 text-center">
          <p className="text-sm font-medium">Unable to load session data.</p>
          <p className="text-xs text-muted-foreground">Please go back to sessions and reopen this page.</p>
        </Card>
      </AdminSessionLayout>
    );
  }

  return (
    <AdminSessionLayout
      sessionName={session.name}
      sessionCode={session.join_code}
      status={statusMap(session.status)}
      isLive={session.status === "active"}
      containerClassName="max-w-[1100px]"
      contentClassName="py-6 lg:py-8"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border bg-card px-4 py-5 md:px-6 md:py-6">
          <div className="space-y-1 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {pitchSelected
                ? `Pitch ${activePitchIndex + 1} of ${teams.length}`
                : `No pitch started yet${teams.length > 0 ? ` · ${teams.length} teams ready` : ""}`}
            </p>
            <h2 className="font-heading text-2xl font-bold md:text-3xl">
              {pitchSelected ? currentPitchTeam?.name : selectedTeamRow?.name ?? "No teams configured"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {!pitchSelected
                ? "Select a team and press Start Pitch"
                : !timerHasStarted
                  ? "Pitch in progress · Press Start Timer when team is done pitching"
                  : timerPaused
                    ? `Timer paused · ${timerRemaining}s remaining`
                    : timerRemaining > 0
                      ? `Timer running · ${timerRemaining}s remaining`
                      : "Timer finished · Close voting or continue manually"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {teams.map((team, i) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(i)}
                className={cn(
                  "relative shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  pitchSelected && i === activePitchIndex && "border-success bg-success/10 text-success",
                  i === selectedTeam
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {team.name}
                {pitchSelected && i === activePitchIndex ? " (pitching)" : ""}
                {teamVoteStatus.has(team.id)
                  ? teamVoteStatus.get(team.id) === "all-voted"
                    ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-background bg-success text-success-foreground">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                    )
                    : (
                      <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-background bg-yellow-500 text-white">
                        <Clock className="h-3 w-3" />
                      </span>
                    )
                  : null}
              </button>
            ))}
          </div>
          <p className="text-center text-[10px] text-muted-foreground">Only advance to a team once their pitch has started.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <Card className="h-fit space-y-3 p-4 md:p-5 lg:sticky lg:top-24 lg:col-span-4">
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
                        "h-11 w-full justify-start gap-2 text-sm",
                        isDone && "border-success/30 bg-success/10 text-success hover:bg-success/15",
                        isFuture && "opacity-40",
                      )}
                      disabled={
                        isFuture ||
                        (step.key === "start" &&
                          (!selectedTeamRow ||
                            startingPitch ||
                            (pitchSelected && currentPitchTeam?.id === selectedTeamRow.id))) ||
                        (step.key === "timer" && (!pitchSelected || timerHasStarted || startingTimer)) ||
                        (step.key === "close" && (!pitchSelected || stoppingPitch))
                      }
                      onClick={() => {
                        if (step.key === "start") {
                          void handleStartPitch();
                          return;
                        }
                        if (step.key === "timer") {
                          void handleStartTimer();
                          return;
                        }
                        if (step.key === "close") {
                          void handleStopVoting();
                          return;
                        }
                        toast.info(`${step.label} is not wired yet.`);
                      }}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                      {step.key === "start" && pitchSelected && currentPitchTeam?.id === selectedTeamRow?.id
                        ? "Pitch in progress"
                        : step.key === "timer" && startingTimer
                          ? "Starting timer..."
                          : step.key === "close" && timerHasStarted
                            ? `Close voting (${timerRemaining}s)`
                            : step.label}
                    </Button>
                    <p className="pl-1 text-[10px] text-muted-foreground">{step.helper}</p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t pt-2">
              <Button
                variant="outline"
                className="h-10 w-full justify-start gap-2 text-sm"
                disabled={!timerHasStarted || timerPaused || timerRemaining <= 0}
                onClick={() => void handlePauseTimer()}
              >
                <Pause className="h-4 w-4" />
                Pause timer
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full justify-start gap-2 text-sm"
                disabled={!timerHasStarted || !timerPaused}
                onClick={() => void handleResumeTimer()}
              >
                <Play className="h-4 w-4" />
                Resume timer
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full justify-start gap-2 text-sm"
                disabled={!timerHasStarted}
                onClick={() => void handleExtendTimer()}
              >
                <Plus className="h-4 w-4" />
                Extend timer (+30s)
              </Button>
            </div>
          </Card>

          <div className="space-y-5 lg:col-span-8">
            <Card className="space-y-4 p-4 md:p-5">
              <h3 className="font-heading text-sm font-semibold">Voter status{trackedTeam ? ` · ${trackedTeam.name}` : ""}</h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    Voted: {votedCount} / {totalVoters}
                  </span>
                  <span className="text-xs text-muted-foreground">Not yet: {totalVoters - votedCount}</span>
                </div>
                {teamMemberCount > 0 ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {teamMemberCount} team member{teamMemberCount > 1 ? "s" : ""} excluded from voting count
                  </div>
                ) : null}
                {excludedCount > 0 ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-destructive/70">
                    <UserX className="h-3 w-3" />
                    {excludedCount} voter{excludedCount > 1 ? "s" : ""} manually excluded: scores omitted from all averages
                  </div>
                ) : null}
                <Progress value={percentage} className="h-2" />
                <p className="text-right text-[10px] text-muted-foreground">{percentage}%</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by name..."
                  className="h-9 bg-background pl-9 text-xs"
                />
              </div>

              <div className="-mx-1 max-h-[420px] space-y-1.5 overflow-y-auto px-1">
                {!trackedTeam ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">Select a team to see voter status.</div>
                ) : null}

                {visibleVoters.map((voter, i) => (
                  <motion.div
                    key={voter.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/50",
                      voter.isExcluded && "opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-[10px] font-semibold text-primary">{voter.name?.[0] ?? "?"}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium leading-tight">{voter.name}</p>
                        <p className="text-[10px] text-muted-foreground">{voter.team}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {voter.isTeamMember ? (
                        <>
                          <span className="rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-900">
                            Team-member
                          </span>
                          <Clock className="h-4 w-4 text-yellow-700" />
                        </>
                      ) : voter.isExcluded ? (
                        <>
                          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            Excluded
                          </span>
                          <button
                            title="Re-include voter"
                            onClick={() => void handleToggleExclusion(voter.id, true)}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              voter.voted
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            {voter.voted ? "Voted" : "Pending"}
                          </span>
                          {voter.voted ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <button
                            title="Exclude voter"
                            onClick={() => void handleToggleExclusion(voter.id, false)}
                            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <button
                onClick={() => setStatsOpen(!statsOpen)}
                className="flex w-full items-center justify-between p-4 font-heading text-sm font-semibold transition-colors hover:bg-muted/30"
              >
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Session stats
                </span>
                {statsOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {statsOpen ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {[
                      { label: "Total votes cast", value: String(votes.length) },
                      {
                        label: "Avg votes / pitch",
                        value: String(teams.length === 0 ? 0 : Math.round(votes.length / teams.length)),
                      },
                      { label: "Pitches completed", value: `${pitchesCompleted} / ${teams.length}` },
                      { label: "Participation rate", value: `${percentage}%` },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="font-heading text-lg font-bold">{stat.value}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </AdminSessionLayout>
  );
}
