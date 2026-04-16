import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, CheckCircle2, Download, Loader2, Save, Trophy, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { AdminSessionLayout } from "@/components/AdminSessionLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildCriteriaDisplayLabels,
  buildResultsCategories,
  buildTeamResults,
  formatScore,
  getAllCategoryKeys,
  sortTeamResultsByOverall,
  type TeamResult,
  type ResultsCategoryKey,
} from "@/lib/results";
import { buildCategoryCsvExports } from "@/lib/resultsExport";
import { normalizeCriteriaLabels } from "@/lib/voting";
import { cn } from "@/lib/utils";
import { buildPublicResultsUrl } from "@/lib/resultsLink";
import { toast } from "sonner";

const PODIUM_COLORS = ["#F59E0B", "#94A3B8", "#CD7F32"];

function statusMap(status: string | undefined): "setup" | "active" | "closed" {
  if (status === "setup") return "setup";
  if (status === "active") return "active";
  return "closed";
}

export default function AdminResultsScreen() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [participants, setParticipants] = useState<Tables<"participants">[]>([]);
  const [votes, setVotes] = useState<Tables<"votes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revealingAll, setRevealingAll] = useState(false);
  const [closingAllVoting, setClosingAllVoting] = useState(false);
  const [reopeningSession, setReopeningSession] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [savingWinners, setSavingWinners] = useState(false);
  const [selectedTeamByCategory, setSelectedTeamByCategory] = useState<Record<string, string>>({});
  const [selectedWinnerByCategory, setSelectedWinnerByCategory] = useState<Record<string, string | null>>({});
  const hasHydratedWinnersRef = useRef(false);

  const loadData = async (sessionId: string) => {
    const [sessionRes, teamsRes, participantsRes, votesRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase.from("participants").select("*").eq("session_id", sessionId),
      supabase.from("votes").select("*").eq("session_id", sessionId),
    ]);

    if (sessionRes.error) throw sessionRes.error;
    if (teamsRes.error) throw teamsRes.error;
    if (participantsRes.error) throw participantsRes.error;
    if (votesRes.error) throw votesRes.error;

    setSession(sessionRes.data);
    setTeams(teamsRes.data || []);
    setParticipants(participantsRes.data || []);
    setVotes(votesRes.data || []);
    setError("");
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    loadData(id)
      .catch((loadError) => {
        console.error("Failed to load results:", loadError);
        setError("Failed to load results");
      })
      .finally(() => setLoading(false));

    const channel = supabase
      .channel(`admin-results-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const criteriaLabels = useMemo(() => normalizeCriteriaLabels(session?.criteria_labels), [session?.criteria_labels]);
  const criteriaDisplayLabels = useMemo(
    () => buildCriteriaDisplayLabels(criteriaLabels, votes),
    [criteriaLabels, votes],
  );
  const teamResults = useMemo(
    () => buildTeamResults(teams, votes, criteriaDisplayLabels),
    [criteriaDisplayLabels, teams, votes],
  );
  const sortedResults = useMemo(() => sortTeamResultsByOverall(teamResults), [teamResults]);
  const categories = useMemo(
    () => buildResultsCategories(teamResults, criteriaDisplayLabels),
    [criteriaDisplayLabels, teamResults],
  );
  const participantNameById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant.name])),
    [participants],
  );
  const membersByTeamId = useMemo(() => {
    const map = new Map<string, string[]>();
    participants.forEach((p) => {
      if (!p.team_id || p.is_observer) return;
      const list = map.get(p.team_id) ?? [];
      list.push(p.name);
      map.set(p.team_id, list);
    });
    return map;
  }, [participants]);

  const revealedCategoryKeys = session?.results_revealed_categories || [];
  const revealedCategoryKeySet = useMemo(() => new Set(revealedCategoryKeys), [revealedCategoryKeys]);
  const allCategoryKeys = useMemo(
    () => getAllCategoryKeys(criteriaDisplayLabels.length),
    [criteriaDisplayLabels.length],
  );
  const revealAllPressed = useMemo(
    () => allCategoryKeys.length > 0 && allCategoryKeys.every((key) => revealedCategoryKeySet.has(key)),
    [allCategoryKeys, revealedCategoryKeySet],
  );
  const canRevealResults = session?.status === "voting_closed" || session?.status === "results_revealed";
  const showCloseVotingButton = session?.status === "active";
  const showReopenSessionButton = session?.status === "voting_closed" || session?.status === "results_revealed";
  const manualWinnersReady = useMemo(
    () => categories.length > 0 && categories.every((category) => Boolean(selectedWinnerByCategory[category.key])),
    [categories, selectedWinnerByCategory],
  );
  const publicResultsUrl = useMemo(() => {
    if (!id || typeof window === "undefined") return "";
    return buildPublicResultsUrl(window.location.origin, id);
  }, [id]);

  useEffect(() => {
    if (categories.length === 0) return;

    setSelectedWinnerByCategory((prev) => {
      const validTeamIds = new Set(teams.map((team) => team.id));
      const next: Record<string, string | null> = {};

      categories.forEach((category) => {
        const previous = prev[category.key];
        next[category.key] = previous && validTeamIds.has(previous) ? previous : null;
      });

      return next;
    });
  }, [categories, teams]);

  // Hydrate winner selection from DB once on initial load
  useEffect(() => {
    if (!session || hasHydratedWinnersRef.current) return;
    hasHydratedWinnersRef.current = true;
    const stored = session.category_winners as Record<string, string> | null;
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      setSelectedWinnerByCategory((prev) => ({ ...prev, ...stored }));
    }
  }, [session]);

  const winnerCategoryByTeamId = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      const winnerTeamId = selectedWinnerByCategory[category.key];
      if (!winnerTeamId || map.has(winnerTeamId)) return;
      map.set(winnerTeamId, category.label);
    });
    return map;
  }, [categories, selectedWinnerByCategory]);

  const buildWinnersPayload = () => {
    const payload: Record<string, string> = {};
    Object.entries(selectedWinnerByCategory).forEach(([key, teamId]) => {
      if (teamId) payload[key] = teamId;
    });
    return payload;
  };

  const saveWinners = async () => {
    if (!id) return;
    setSavingWinners(true);
    const { error: saveError } = await supabase
      .from("sessions")
      .update({ category_winners: buildWinnersPayload() })
      .eq("id", id);
    setSavingWinners(false);
    if (saveError) {
      console.error("Failed to save winners:", saveError);
      toast.error(saveError.message || "Failed to save winners");
      return;
    }
    toast.success("Winners saved");
  };

  const closeEveryVoting = async () => {
    if (!id) return;

    setClosingAllVoting(true);
    const { error: closeError } = await supabase
      .from("sessions")
      .update({
        status: "voting_closed",
        current_pitch_index: -1,
        timer_started_at: null,
        timer_paused_remaining_seconds: null,
        results_revealed_categories: [],
      })
      .eq("id", id);

    setClosingAllVoting(false);

    if (closeError) {
      console.error("Failed to close all voting:", closeError);
      toast.error(closeError.message || "Failed to close all voting");
      return;
    }

    setSession((prev) => (
      prev
        ? {
            ...prev,
            status: "voting_closed",
            current_pitch_index: -1,
            timer_started_at: null,
            timer_paused_remaining_seconds: null,
            results_revealed_categories: [],
          }
        : prev
    ));
    void loadData(id);
    toast.success("All voting closed. You can now reveal results.");
  };

  const reopenSession = async () => {
    if (!id) return;

    setReopeningSession(true);
    const { error: reopenError } = await supabase
      .from("sessions")
      .update({
        status: "active",
      })
      .eq("id", id);

    setReopeningSession(false);

    if (reopenError) {
      console.error("Failed to reopen session:", reopenError);
      toast.error(reopenError.message || "Failed to reopen session");
      return;
    }

    setSession((prev) => (prev ? { ...prev, status: "active" } : prev));
    void loadData(id);
    toast.success("Session reopened.");
  };

  const triggerCsvDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    if (!session || categories.length === 0) {
      toast.info("No results available to export yet.");
      return;
    }

    setExportingCsv(true);
    try {
      const exports = buildCategoryCsvExports({
        sessionName: session.name,
        categories,
        teamResults,
        votes,
        participantNameById,
      });

      exports.forEach((file, index) => {
        window.setTimeout(() => {
          triggerCsvDownload(file.filename, file.content);
        }, index * 150);
      });

      toast.success(`Exported ${exports.length} category CSV file${exports.length > 1 ? "s" : ""}.`);
    } catch (exportError) {
      console.error("Failed to export CSV:", exportError);
      toast.error("Failed to export CSV");
    } finally {
      setExportingCsv(false);
    }
  };

  const revealAllCategories = async () => {
    if (!id || !session) return;

    setRevealingAll(true);
    const winnersPayload = buildWinnersPayload();
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "results_revealed",
        results_revealed_categories: allCategoryKeys,
        category_winners: winnersPayload,
      })
      .eq("id", id);

    setRevealingAll(false);

    if (updateError) {
      console.error("Failed to reveal all categories:", updateError);
      toast.error(updateError.message || "Failed to reveal all categories");
      return;
    }

    setSession((prev) => (
      prev
        ? {
            ...prev,
            status: "results_revealed",
            results_revealed_categories: allCategoryKeys,
            category_winners: winnersPayload,
          }
        : prev
    ));
    void loadData(id);
    toast.success("All categories revealed to participants");
  };

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  if (loading) {
    return (
      <AdminSessionLayout containerClassName="max-w-[1200px]">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminSessionLayout>
    );
  }

  if (!session) {
    return (
      <AdminSessionLayout>
        <Card className="p-6 text-center space-y-2">
          <p className="text-sm font-medium">Unable to load session results.</p>
          <p className="text-xs text-muted-foreground">Please go back to sessions and reopen this page.</p>
        </Card>
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
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Results Board</p>
            <h2 className="text-2xl font-heading font-semibold">Category Rankings</h2>
            <p className="text-sm text-muted-foreground">
              Select one winner per category, then reveal the results to everyone in the room.
            </p>
          </div>
        </div>

        <Card className="p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-heading text-base font-semibold">Shareable Results Link</h3>
              <p className="text-xs text-muted-foreground">Anyone can open this URL without auth or session.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                onClick={() => void exportCsv()}
                disabled={exportingCsv || categories.length === 0}
              >
                <Download className="w-4 h-4" />
                {exportingCsv ? "Exporting..." : "Export CSV"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!publicResultsUrl) return;
                  window.open(publicResultsUrl, "_blank", "noopener,noreferrer");
                }}
              >
                Open
              </Button>
              <Button
                onClick={async () => {
                  if (!publicResultsUrl) return;
                  try {
                    await navigator.clipboard.writeText(publicResultsUrl);
                    toast.success("Public results URL copied");
                  } catch (copyError) {
                    console.error("Failed to copy public results URL:", copyError);
                    toast.error("Failed to copy URL");
                  }
                }}
              >
                Copy URL
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs font-mono break-all">
            {publicResultsUrl || "Unavailable"}
          </div>
        </Card>

        <Card className="p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-heading text-base font-semibold">Reveal Results</h3>
              <p className="text-xs text-muted-foreground">
                First close all voting, then reveal all category rankings at once.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {showCloseVotingButton ? (
                <Button
                  variant="destructive"
                  onClick={() => void closeEveryVoting()}
                  disabled={closingAllVoting}
                >
                  {closingAllVoting ? "Closing..." : "Close every voting"}
                </Button>
              ) : null}
              {showReopenSessionButton ? (
                <Button
                  variant="outline"
                  onClick={() => void reopenSession()}
                  disabled={reopeningSession}
                >
                  {reopeningSession ? "Reopening..." : "Reopen session"}
                </Button>
              ) : null}
              {revealAllPressed ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Revealed
                </span>
              ) : null}
              <Button
                onClick={() => void revealAllCategories()}
                disabled={revealingAll || !canRevealResults || !manualWinnersReady}
              >
                {revealingAll ? "Revealing..." : "Reveal All Results"}
              </Button>
            </div>
          </div>
          {!canRevealResults ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Close every voting first to enable reveal actions.
            </div>
          ) : null}
          {!manualWinnersReady ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Select one winner for every category before revealing all results.
            </div>
          ) : null}
        </Card>

        {teams.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No teams available for this session yet.</p>
          </Card>
        ) : votes.length === 0 ? (
          <Card className="p-8 text-center space-y-2">
            <p className="text-sm font-medium">No votes submitted yet.</p>
            <p className="text-xs text-muted-foreground">Start pitches and collect votes to see rankings.</p>
          </Card>
        ) : (
          <>
            {/* Winner Selection */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-card to-card p-5">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/30 blur-3xl" />
              <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-yellow-300/20 blur-2xl" />
              <div className="relative mb-5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold">Crown the Winners</h3>
                    <p className="text-xs text-muted-foreground">
                      Click a team to select them as the winner for each category. Teams already crowned elsewhere are flagged.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => void saveWinners()}
                  disabled={savingWinners || !manualWinnersReady}
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                >
                  <Save className="h-4 w-4" />
                  {savingWinners ? "Saving..." : "Save Winners"}
                </Button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {categories.map((category) => {
                  const selectedWinnerId = selectedWinnerByCategory[category.key] ?? null;
                  const rankedTeams = [...teamResults].sort((a, b) => {
                    const scoreDiff = category.scoreFor(b) - category.scoreFor(a);
                    if (scoreDiff !== 0) return scoreDiff;
                    return a.teamName.localeCompare(b.teamName);
                  });

                  return (
                    <div
                      key={`winner-${category.key}`}
                      className={cn(
                        "rounded-xl border-2 p-4 space-y-3 transition-colors",
                        selectedWinnerId
                          ? "border-amber-300 bg-white/80"
                          : "border-border bg-card/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{category.label}</h4>
                        </div>
                        {selectedWinnerId ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            <Trophy className="h-3 w-3" />
                            Winner selected
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pick a winner</span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {rankedTeams.map((team, rankIndex) => {
                          const isSelected = selectedWinnerId === team.teamId;
                          const winnerCategory = winnerCategoryByTeamId.get(team.teamId);
                          const alreadyWonElsewhere = Boolean(winnerCategory && winnerCategory !== category.label);

                          return (
                            <button
                              key={`${category.key}-team-${team.teamId}`}
                              type="button"
                              onClick={() =>
                                setSelectedWinnerByCategory((prev) => ({
                                  ...prev,
                                  [category.key]: isSelected ? null : team.teamId,
                                }))
                              }
                              className={cn(
                                "w-full rounded-lg border px-3 py-2.5 text-left transition-all",
                                isSelected
                                  ? "border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-md ring-1 ring-amber-300"
                                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/30",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  {isSelected ? (
                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm">
                                      <Trophy className="h-3.5 w-3.5" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                      #{rankIndex + 1}
                                    </span>
                                  )}
                                  <div className="min-w-0">
                                    <p
                                      className={cn(
                                        "truncate text-sm font-medium",
                                        isSelected && "font-semibold text-amber-900",
                                      )}
                                    >
                                      {team.teamName}
                                    </p>
                                    {alreadyWonElsewhere ? (
                                      <span className="mt-0.5 inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700">
                                        Already won {winnerCategory}
                                      </span>
                                    ) : null}
                                    {isSelected ? (
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {(membersByTeamId.get(team.teamId) ?? []).length > 0 ? (
                                          <>
                                            <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-700">
                                              <Users className="h-3 w-3" />
                                            </span>
                                            {(membersByTeamId.get(team.teamId) ?? []).map((name) => (
                                              <span key={name} className="rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                                                {name}
                                              </span>
                                            ))}
                                          </>
                                        ) : (
                                          <span className="text-[11px] text-amber-600 italic">No members registered</span>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "shrink-0 tabular-nums text-sm font-semibold",
                                    isSelected ? "text-amber-800" : "text-foreground",
                                  )}
                                >
                                  {formatScore(category.scoreFor(team))}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Card className="p-4 md:p-5">
              <Accordion type="single" collapsible defaultValue="original-points">
                <AccordionItem value="original-points" className="border-none">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <div className="text-left">
                      <h3 className="font-heading text-base font-semibold">Original Points</h3>
                      <p className="text-xs text-muted-foreground">
                        Top 5 teams per category based on average points only (no manual picking).
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {categories.map((category, categoryIndex) => {
                const originalTopTeams = category.winners;
                const chartData = originalTopTeams.map((winner, winnerIndex) => ({
                  rank: winnerIndex + 1,
                  team: winner.teamName,
                  score: Number(category.scoreFor(winner).toFixed(2)),
                }));
                const selectedTeamId =
                  selectedTeamByCategory[category.key] ??
                  originalTopTeams[0]?.teamId ??
                  teams[0]?.id ??
                  "";
                const selectedTeamName =
                  teams.find((team) => team.id === selectedTeamId)?.name ??
                  "No team selected";
                const selectedTeamVotes = votes
                  .filter((vote) => vote.team_id === selectedTeamId)
                  .map((vote) => {
                    const categoryScore = category.key === "overall"
                      ? (
                        vote.criteria_scores.length === 0
                          ? 0
                          : vote.criteria_scores.reduce((sum, score) => sum + score, 0) / vote.criteria_scores.length
                      )
                      : vote.criteria_scores[Number(category.key.replace("criterion-", ""))] ?? 0;
                    return {
                      voteId: vote.id,
                      voterName: participantNameById.get(vote.participant_id) ?? "Unknown voter",
                      categoryScore,
                    };
                  })
                  .sort((a, b) => a.voterName.localeCompare(b.voterName));

                return (
                  <motion.div
                    key={category.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: categoryIndex * 0.06 }}
                  >
                    <Card className="p-4 space-y-4 h-full">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
                          <h3 className="text-lg font-semibold">{category.label}</h3>
                        </div>
                        <Award className="w-5 h-5 text-primary" />
                      </div>

                      <div className="space-y-2">
                        {originalTopTeams.map((winner, winnerIndex) => (
                          <div key={winner.teamId} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-foreground"
                                style={{ backgroundColor: `${PODIUM_COLORS[winnerIndex]}33` }}
                              >
                                #{winnerIndex + 1}
                              </span>
                              <span className="font-medium truncate">{winner.teamName}</span>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">
                              {formatScore(category.scoreFor(winner))}
                            </span>
                          </div>
                        ))}
                        {originalTopTeams.length === 0 ? (
                          <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground text-center">
                            No ranked teams available yet.
                          </div>
                        ) : null}
                      </div>

                      <ChartContainer
                        config={{ score: { label: "Score", color: "hsl(var(--primary))" } }}
                        className="h-[220px] w-full aspect-auto"
                      >
                        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
                          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, category.maxScore]} tickMargin={8} />
                          <YAxis type="category" dataKey="team" width={120} tickLine={false} axisLine={false} />
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent formatter={(value) => formatScore(Number(value))} />}
                          />
                          <Bar dataKey="score" radius={6}>
                            {chartData.map((entry, index) => (
                              <Cell key={`${entry.team}-${index}`} fill={PODIUM_COLORS[index] ?? "hsl(var(--primary))"} />
                            ))}
                            <LabelList
                              dataKey="score"
                              position="right"
                              className="fill-foreground text-xs font-medium"
                              formatter={(value: number) => formatScore(value)}
                            />
                          </Bar>
                        </BarChart>
                      </ChartContainer>

                      <Accordion type="single" collapsible className="border rounded-xl px-3">
                        <AccordionItem value={`voter-breakdown-${category.key}`} className="border-none">
                          <AccordionTrigger className="py-3 text-sm no-underline hover:no-underline">
                            Who voted for which team
                          </AccordionTrigger>
                          <AccordionContent className="pt-1 pb-3 space-y-3">
                            <div className="overflow-x-auto -mx-1 px-1">
                              <div className="inline-flex gap-2 min-w-full">
                                {teams.map((team) => {
                                  const active = selectedTeamId === team.id;
                                  return (
                                    <button
                                      key={`${category.key}-${team.id}`}
                                      onClick={() =>
                                        setSelectedTeamByCategory((prev) => ({ ...prev, [category.key]: team.id }))
                                      }
                                      className={cn(
                                        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                        active
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                                      )}
                                    >
                                      {team.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Voters for <span className="text-foreground">{selectedTeamName}</span>
                              </p>
                              {selectedTeamVotes.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No votes submitted for this team yet.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {selectedTeamVotes.map((row) => (
                                    <div key={row.voteId} className="flex items-center justify-between text-sm">
                                      <span>{row.voterName}</span>
                                      <span className="font-semibold tabular-nums">{formatScore(row.categoryScore)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </Card>
                  </motion.div>
                );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Full Team Scores
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Team</TableHead>
                    <TableHead className="text-right">Overall</TableHead>
                    {criteriaDisplayLabels.map((label) => (
                      <TableHead key={label} className="text-right whitespace-nowrap">
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Votes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result) => (
                    <TableRow key={result.teamId}>
                      <TableCell className="font-medium">{result.teamName}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatScore(result.overall)}</TableCell>
                      {result.criterionAverages.map((score, index) => (
                        <TableCell key={`${result.teamId}-${index}`} className="text-right tabular-nums">
                          {formatScore(score)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">{result.voteCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </AdminSessionLayout>
  );
}
