import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trash2, Plus, Lock, Loader2 } from "lucide-react";
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

export default function AdminSetupScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [newTeam, setNewTeam] = useState("");
  const [criteriaLabels, setCriteriaLabels] = useState<string[]>(getCriteriaInputDefaults());
  const [savingCriteria, setSavingCriteria] = useState(false);
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
    setTeams(teams.filter((t) => t.id !== teamId));
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
      <AdminSessionLayout>
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
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Teams section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold">Teams</h2>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>

          {isActive && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Session is active — teams are locked.
            </p>
          )}

          <div className="space-y-2">
            {teams.map((team, i) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between bg-card rounded-xl border px-4 py-3"
              >
                <span className="text-sm font-medium">{team.name}</span>
                {!isActive && (
                  <button
                    onClick={() => removeTeam(team.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>

          {!isActive && (
            <div className="flex gap-2">
              <Input
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                placeholder="Team name"
                className="h-11 bg-card"
                onKeyDown={(e) => e.key === "Enter" && addTeam()}
              />
              <Button onClick={addTeam} disabled={!newTeam.trim()} size="sm" className="h-11 px-4">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}

          {teams.length < 2 && !isActive && (
            <p className="text-xs text-muted-foreground">
              Add at least 2 teams to activate the session.
            </p>
          )}
        </div>

        {/* Criteria section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold">Voting criteria</h2>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>

          {criteriaLabels.map((label, index) => (
            <div key={index} className="space-y-1">
              <label className="text-xs text-muted-foreground">Criteria {index + 1}</label>
              <div className="flex gap-2">
                <Input
                  value={label}
                  onChange={(e) => handleCriteriaChange(index, e.target.value)}
                  placeholder={`Criteria ${index + 1}`}
                  className="h-11 bg-card"
                  disabled={isActive}
                />
                {!isActive && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => removeCriteriaInput(index)}
                    disabled={criteriaLabels.length <= MIN_CRITERIA_COUNT}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {!isActive && (
            <>
              <Button type="button" variant="outline" className="w-full h-10" onClick={addCriteriaInput}>
                <Plus className="w-4 h-4 mr-2" />
                Add criteria
              </Button>
              <Button
                onClick={saveCriteria}
                disabled={savingCriteria || !canSaveCriteria}
                variant="outline"
                className="w-full h-11"
              >
                {savingCriteria && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Criteria
              </Button>
            </>
          )}
          {!isActive && criteriaFilledCount < 2 && (
            <p className="text-xs text-muted-foreground">Add at least 2 criteria.</p>
          )}
        </div>

        {/* Activate / Go to Lobby */}
        <div className="pt-2">
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
