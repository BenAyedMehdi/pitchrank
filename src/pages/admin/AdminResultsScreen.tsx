import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, CheckCircle2, Download, Loader2, Move, Trophy } from "lucide-react";
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
const MANUAL_RANKING_SLOT_COUNT = 3;

type DraggedTeamPayload = {
  teamId: string;
  sourceCategoryKey: ResultsCategoryKey;
  sourceSlotIndex: number | null;
};

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
  const [selectedTeamByCategory, setSelectedTeamByCategory] = useState<Record<string, string>>({});
  const [manualRankingByCategory, setManualRankingByCategory] = useState<Record<string, (string | null)[]>>({});
  const [draggedTeam, setDraggedTeam] = useState<DraggedTeamPayload | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);

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
    () => categories.length > 0 && categories.every((category) => Boolean(manualRankingByCategory[category.key]?.[0])),
    [categories, manualRankingByCategory],
  );
  const publicResultsUrl = useMemo(() => {
    if (!id || typeof window === "undefined") return "";
    return buildPublicResultsUrl(window.location.origin, id);
  }, [id]);

  useEffect(() => {
    if (categories.length === 0) return;

    setManualRankingByCategory((prev) => {
      const validTeamIds = new Set(teams.map((team) => team.id));
      const next: Record<string, (string | null)[]> = {};

      categories.forEach((category) => {
        const previous = prev[category.key] || [];
        const normalizedPrevious = Array.from({ length: MANUAL_RANKING_SLOT_COUNT }, (_, index) => {
          const teamId = previous[index];
          return teamId && validTeamIds.has(teamId) ? teamId : null;
        });
        next[category.key] = normalizedPrevious;
      });

      return next;
    });
  }, [categories, teams]);

  const teamResultById = useMemo(
    () => new Map(teamResults.map((result) => [result.teamId, result])),
    [teamResults],
  );
  const teamNameById = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams],
  );
  const winnerCategoryByTeamId = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      const winnerTeamId = manualRankingByCategory[category.key]?.[0];
      if (!winnerTeamId || map.has(winnerTeamId)) return;
      map.set(winnerTeamId, category.label);
    });
    return map;
  }, [categories, manualRankingByCategory]);

  const updateRankingSlot = (
    categoryKey: ResultsCategoryKey,
    slotIndex: number,
    incomingTeamId: string,
    sourceSlotIndex: number | null,
    sourceCategoryKey: ResultsCategoryKey,
  ) => {
    setManualRankingByCategory((prev) => {
      const next = { ...prev };
      const target = [...(next[categoryKey] || Array.from({ length: MANUAL_RANKING_SLOT_COUNT }, () => null))];
      const destinationExisting = target[slotIndex];
      const existingIndex = target.findIndex((teamId) => teamId === incomingTeamId);

      if (existingIndex !== -1) {
        target[existingIndex] = null;
      }

      if (sourceSlotIndex !== null) {
        if (sourceCategoryKey === categoryKey) {
          if (sourceSlotIndex !== slotIndex) {
            target[sourceSlotIndex] = destinationExisting ?? null;
          }
        } else {
          const source = [...(next[sourceCategoryKey] || Array.from({ length: MANUAL_RANKING_SLOT_COUNT }, () => null))];
          if (source[sourceSlotIndex] === incomingTeamId) {
            source[sourceSlotIndex] = null;
            next[sourceCategoryKey] = source;
          }
        }
      }

      target[slotIndex] = incomingTeamId;
      next[categoryKey] = target;
      return next;
    });
  };

  const clearRankingSlot = (categoryKey: ResultsCategoryKey, slotIndex: number) => {
    setManualRankingByCategory((prev) => {
      const current = [...(prev[categoryKey] || Array.from({ length: MANUAL_RANKING_SLOT_COUNT }, () => null))];
      current[slotIndex] = null;
      return { ...prev, [categoryKey]: current };
    });
  };

  const getSelectedTeamsForCategory = (categoryKey: ResultsCategoryKey): TeamResult[] => {
    const pickedTeamIds = manualRankingByCategory[categoryKey] || [];
    return pickedTeamIds
      .map((teamId) => (teamId ? teamResultById.get(teamId) || null : null))
      .filter((result): result is TeamResult => result !== null);
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
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "results_revealed",
        results_revealed_categories: allCategoryKeys,
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
              Drag teams into rank slots and compare them across overall score and every voting criterion.
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
              Select at least one winner (#1 slot) for every category before revealing all results.
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
            <Card className="p-4 md:p-5">
              <Accordion type="single" collapsible defaultValue="manual-winner-assignment">
                <AccordionItem value="manual-winner-assignment" className="border-none">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <div className="text-left">
                      <h3 className="font-heading text-base font-semibold">Manual Winner Assignment</h3>
                      <p className="text-xs text-muted-foreground">
                        Drag teams into the 3 ranking slots for each category. Teams already selected as #1 in another
                        category are marked.
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {categories.map((category) => {
                  const pickedTeamIds = manualRankingByCategory[category.key] || Array.from({ length: MANUAL_RANKING_SLOT_COUNT }, () => null);
                  const rankedCandidates = [...teamResults].sort((a, b) => {
                    const scoreDiff = category.scoreFor(b) - category.scoreFor(a);
                    if (scoreDiff !== 0) return scoreDiff;
                    return a.teamName.localeCompare(b.teamName);
                  });
                  const originalRankByTeamId = new Map(rankedCandidates.map((team, index) => [team.teamId, index + 1]));
                  const pickedTeamIdSet = new Set(
                    pickedTeamIds.filter((teamId): teamId is string => Boolean(teamId)),
                  );
                  const availableCandidates = rankedCandidates.filter((candidate) => !pickedTeamIdSet.has(candidate.teamId));

                  return (
                    <div key={`manual-${category.key}`} className="rounded-xl border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{category.label}</h4>
                        <span className="text-xs text-muted-foreground">3 slots</span>
                      </div>

                      <div className="space-y-2">
                        {Array.from({ length: MANUAL_RANKING_SLOT_COUNT }, (_, slotIndex) => {
                          const teamId = pickedTeamIds[slotIndex];
                          const teamName = teamId ? teamNameById.get(teamId) || "Unknown team" : null;
                          const teamResult = teamId ? teamResultById.get(teamId) || null : null;
                          const winnerCategory = teamId ? winnerCategoryByTeamId.get(teamId) : null;
                          const winnerAssignedElsewhere = slotIndex === 0 && winnerCategory && winnerCategory !== category.label;

                          return (
                            <div
                              key={`${category.key}-slot-${slotIndex}`}
                              onDragOver={(event) => {
                                event.preventDefault();
                              }}
                              onDrop={() => {
                                if (!draggedTeam) return;
                                updateRankingSlot(
                                  category.key,
                                  slotIndex,
                                  draggedTeam.teamId,
                                  draggedTeam.sourceSlotIndex,
                                  draggedTeam.sourceCategoryKey,
                                );
                                setDraggedTeam(null);
                                setDragOverSlotKey(null);
                              }}
                              className={cn(
                                "rounded-lg border border-dashed p-2.5 min-h-12 flex items-center justify-between gap-2 transition-colors",
                                teamId ? "border-border bg-card" : "border-muted-foreground/35 bg-muted/20",
                                dragOverSlotKey === `${category.key}-${slotIndex}` && "border-primary bg-primary/5",
                              )}
                              onDragEnter={() => setDragOverSlotKey(`${category.key}-${slotIndex}`)}
                              onDragLeave={() => setDragOverSlotKey((current) => (
                                current === `${category.key}-${slotIndex}` ? null : current
                              ))}
                            >
                              <div className="min-w-0 flex-1">
                                {teamName ? (
                                  <div
                                    draggable
                                    onDragStart={(event) => {
                                      event.dataTransfer.effectAllowed = "move";
                                      setDraggedTeam({
                                        teamId: teamId!,
                                        sourceCategoryKey: category.key,
                                        sourceSlotIndex: slotIndex,
                                      });
                                    }}
                                    onDragEnd={() => {
                                      setDraggedTeam(null);
                                      setDragOverSlotKey(null);
                                    }}
                                    className={cn(
                                      "w-full rounded-md border bg-background px-2.5 py-2 cursor-grab active:cursor-grabbing",
                                      draggedTeam?.teamId === teamId && "opacity-50",
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex items-start gap-2.5">
                                        <span
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-foreground shrink-0 mt-0.5"
                                          style={{ backgroundColor: `${PODIUM_COLORS[slotIndex] ?? "hsl(var(--primary))"}33` }}
                                        >
                                          #{slotIndex + 1}
                                        </span>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate">{teamName}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Score: {formatScore(teamResult ? category.scoreFor(teamResult) : 0)}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground">
                                            Original rank by average: #{originalRankByTeamId.get(teamId!) ?? "-"}
                                          </p>
                                          {winnerAssignedElsewhere ? (
                                            <p className="text-[11px] text-amber-700">
                                              Already selected as winner in {winnerCategory}
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold tabular-nums">
                                          {formatScore(teamResult ? category.scoreFor(teamResult) : 0)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          <Move className="w-4 h-4 text-muted-foreground shrink-0" />
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-md bg-muted/20 px-2.5 py-2">
                                    <p className="text-xs text-muted-foreground">#{slotIndex + 1}</p>
                                    <p className="text-xs text-muted-foreground">Drop team here</p>
                                  </div>
                                )}
                              </div>
                              {teamId ? (
                                <div className="flex items-center gap-1.5 shrink-0 self-start">
                                  <button
                                    type="button"
                                    onClick={() => clearRankingSlot(category.key, slotIndex)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-xs"
                                  >
                                    x
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Candidates</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {availableCandidates.map((candidate) => {
                            const winnerCategory = winnerCategoryByTeamId.get(candidate.teamId);
                            const winnerAssignedElsewhere = winnerCategory && winnerCategory !== category.label;
                            return (
                              <div
                                key={`${category.key}-candidate-${candidate.teamId}`}
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = "move";
                                  setDraggedTeam({
                                    teamId: candidate.teamId,
                                    sourceCategoryKey: category.key,
                                    sourceSlotIndex: null,
                                  });
                                }}
                                onDragEnd={() => {
                                  setDraggedTeam(null);
                                  setDragOverSlotKey(null);
                                }}
                                className={cn(
                                  "rounded-lg border bg-background px-3 py-2 cursor-grab active:cursor-grabbing",
                                  draggedTeam?.teamId === candidate.teamId && "opacity-50",
                                  winnerAssignedElsewhere && "border-amber-300 text-amber-800",
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{candidate.teamName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Score: {formatScore(category.scoreFor(candidate))}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Original rank by average: #{originalRankByTeamId.get(candidate.teamId)}
                                    </p>
                                    {winnerAssignedElsewhere ? (
                                      <p className="text-[11px] text-amber-700">
                                        Winner in {winnerCategory}
                                      </p>
                                    ) : null}
                                  </div>
                                  <Move className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                </div>
                              </div>
                            );
                          })}
                          {availableCandidates.length === 0 ? (
                            <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                              All teams are already placed in slots.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>

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
