import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Lock, Loader2, ChevronUp, ChevronDown, X, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSessionLayout } from "@/components/AdminSessionLayout";
import {
  buildCriteriaLabelsForStorage,
  getCriteriaInputDefaults,
  MIN_CRITERIA_COUNT,
  normalizeCriteriaLabels,
} from "@/lib/voting";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export default function AdminSetupScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [newTeam, setNewTeam] = useState("");
  const [criteriaLabels, setCriteriaLabels] = useState<string[]>(getCriteriaInputDefaults());
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [reorderingTeam, setReorderingTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  const isActive = session?.status !== "setup";
  const criteriaFilledCount = criteriaLabels.filter((label) => label.trim().length > 0).length;
  const canSaveCriteria = criteriaFilledCount >= 2;

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [sessionRes, teamsRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", id!).single(),
        supabase.from("teams").select("*").eq("session_id", id!).order("pitch_order"),
      ]);
      if (sessionRes.error) {
        console.error("Failed to load session:", sessionRes.error);
        toast.error("Session not found");
        return;
      }
      setSession(sessionRes.data);
      const loaded = normalizeCriteriaLabels(sessionRes.data.criteria_labels);
      const filledToMin = loaded.length >= MIN_CRITERIA_COUNT
        ? loaded
        : [...loaded, ...Array(MIN_CRITERIA_COUNT - loaded.length).fill("")];
      setCriteriaLabels(filledToMin);
      setTeams(teamsRes.data || []);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleCriteriaChange = (index: number, value: string) => {
    setCriteriaLabels((prev) => prev.map((label, i) => (i === index ? value : label)));
  };

  const addCriteriaInput = () => {
    if (isActive) return;
    setCriteriaLabels((prev) => [...prev, ""]);
  };

  const removeCriteriaInput = (index: number) => {
    if (isActive || criteriaLabels.length <= MIN_CRITERIA_COUNT) return;
    setCriteriaLabels((prev) => prev.filter((_, i) => i !== index));
  };

  const saveCriteria = async () => {
    if (!id || isActive) return;
    let normalized: string[];
    try {
      normalized = buildCriteriaLabelsForStorage(criteriaLabels);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "At least 2 criteria are required");
      return;
    }

    setSavingCriteria(true);
    const { error } = await supabase
      .from("sessions")
      .update({ criteria_labels: normalized })
      .eq("id", id);

    if (error) {
      console.error("Failed to save criteria labels:", error);
      toast.error("Failed to save criteria");
      setSavingCriteria(false);
      return;
    }

    setCriteriaLabels(normalized);
    setSession((prev) => (prev ? { ...prev, criteria_labels: normalized } : prev));
    setSavingCriteria(false);
    toast.success("Criteria saved");
  };

  const addTeam = async () => {
    if (!newTeam.trim() || isActive || !id) return;
    const { data, error } = await supabase
      .from("teams")
      .insert({ session_id: id, name: newTeam.trim(), pitch_order: teams.length })
      .select()
      .single();
    if (error) {
      console.error("Failed to add team:", error);
      toast.error("Failed to add team");
      return;
    }
    setTeams([...teams, data]);
    setNewTeam("");
  };

  const removeTeam = async (teamId: string) => {
    if (isActive) return;
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) {
      console.error("Failed to delete team:", error);
      toast.error("Failed to delete team");
      return;
    }
    // Re-index remaining teams and persist the new pitch_order values
    const remaining = teams.filter((t) => t.id !== teamId).map((t, i) => ({ ...t, pitch_order: i }));
    setTeams(remaining);
    if (remaining.length > 0) {
      const upserts = remaining.map((t) => ({ id: t.id, session_id: t.session_id, name: t.name, pitch_order: t.pitch_order }));
      const { error: upsertError } = await supabase.from("teams").upsert(upserts);
      if (upsertError) {
        console.error("Failed to reindex team order after delete:", upsertError);
      }
    }
  };

  const moveTeam = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= teams.length) return;

    const updated = [...teams];
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    const reindexed = updated.map((t, i) => ({ ...t, pitch_order: i }));
    setTeams(reindexed);
    setReorderingTeam(reindexed[swapIndex].id);

    // Persist new order to DB
    const upserts = reindexed.map((t) => ({ id: t.id, session_id: t.session_id, name: t.name, pitch_order: t.pitch_order }));
    const { error } = await supabase.from("teams").upsert(upserts);
    if (error) {
      console.error("Failed to reorder teams:", error);
      toast.error("Failed to save team order");
    }
    setReorderingTeam(null);
  };

  const handleActivate = async () => {
    if (!id) return;
    let normalized: string[];
    try {
      normalized = buildCriteriaLabelsForStorage(criteriaLabels);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "At least 2 criteria are required");
      return;
    }
    setActivating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ status: "active", criteria_labels: normalized })
      .eq("id", id);
    if (error) {
      console.error("Failed to activate:", error);
      toast.error("Failed to activate session");
      setActivating(false);
      return;
    }
    setSession((prev) => (prev ? { ...prev, status: "active", criteria_labels: normalized } : prev));
    setActivating(false);
    toast.success("Session activated!");
  };

  if (loading) {
    return (
      <AdminSessionLayout containerClassName="max-w-[1100px]">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminSessionLayout>
    );
  }

  const statusMap = (s: string | undefined) => {
    if (s === "setup") return "setup" as const;
    if (s === "active") return "active" as const;
    return "closed" as const;
  };

  return (
    <AdminSessionLayout
      sessionName={session?.name}
      sessionCode={session?.join_code}
      status={statusMap(session?.status)}
      containerClassName="max-w-[1100px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Desktop: side-by-side columns; mobile: stacked */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* ── Teams column ── */}
          <div className="bg-card border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">Teams</h2>
              {isActive ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{teams.length} added</span>
              )}
            </div>

            {isActive && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Session is active — teams are locked.
              </p>
            )}

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {teams.map((team, i) => (
                  <motion.div
                    key={team.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2 bg-background rounded-xl border px-3 py-2.5"
                  >
                    {/* Pitch order badge */}
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-muted-foreground text-xs font-semibold shrink-0">
                      {i + 1}
                    </span>

                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{team.name}</span>

                    {!isActive && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* Up / Down reorder buttons */}
                        <button
                          onClick={() => moveTeam(i, "up")}
                          disabled={i === 0 || reorderingTeam !== null}
                          title="Move up"
                          className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
                            i === 0
                              ? "text-muted-foreground/30 cursor-not-allowed"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveTeam(i, "down")}
                          disabled={i === teams.length - 1 || reorderingTeam !== null}
                          title="Move down"
                          className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
                            i === teams.length - 1
                              ? "text-muted-foreground/30 cursor-not-allowed"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => removeTeam(team.id)}
                          title="Remove team"
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {teams.length === 0 && !isActive && (
                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl">
                  No teams yet — add your first team below.
                </p>
              )}
            </div>

            {!isActive && (
              <>
                <div className="flex gap-2">
                  <Input
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    placeholder="Team name"
                    className="h-11 bg-background"
                    onKeyDown={(e) => e.key === "Enter" && addTeam()}
                  />
                  <Button onClick={addTeam} disabled={!newTeam.trim()} size="sm" className="h-11 px-4 shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {teams.length < 2 && (
                  <p className="text-xs text-muted-foreground">
                    Add at least 2 teams to activate the session.
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── Criteria column ── */}
          <div className="bg-card border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">Voting criteria</h2>
              {isActive ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              ) : (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  criteriaFilledCount >= 2
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                )}>
                  {criteriaFilledCount} / min 2
                </span>
              )}
            </div>

            <div className="space-y-2">
              {criteriaLabels.map((label, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground shrink-0 text-xs font-semibold">
                    {index + 1}
                  </span>
                  <Input
                    value={label}
                    onChange={(e) => handleCriteriaChange(index, e.target.value)}
                    placeholder={`e.g. Innovation`}
                    className="h-10 bg-background flex-1"
                    disabled={isActive}
                  />
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => removeCriteriaInput(index)}
                      disabled={criteriaLabels.length <= MIN_CRITERIA_COUNT}
                      title="Remove criteria"
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0",
                        criteriaLabels.length <= MIN_CRITERIA_COUNT
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      )}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isActive && (
              <>
                <button
                  type="button"
                  onClick={addCriteriaInput}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border hover:border-primary/60 hover:bg-primary/5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add criteria
                </button>

                <Button
                  onClick={saveCriteria}
                  disabled={savingCriteria || !canSaveCriteria}
                  variant="outline"
                  className="w-full h-11"
                >
                  {savingCriteria && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Criteria
                </Button>

                {criteriaFilledCount < 2 && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hash className="w-3 h-3" />
                    Add at least 2 criteria.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Activate / Go to Lobby ── */}
        <div className="pt-1">
          {!isActive ? (
            <Button
              onClick={handleActivate}
              disabled={teams.length < 2 || activating || criteriaFilledCount < 2}
              className="w-full h-12 text-base font-semibold bg-success hover:bg-success/90"
              size="lg"
            >
              {activating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Activate Session
            </Button>
          ) : (
            <Button
              onClick={() => navigate(`/admin/sessions/${id}/lobby`)}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              Go to Lobby
            </Button>
          )}
        </div>
      </motion.div>
    </AdminSessionLayout>
  );
}
