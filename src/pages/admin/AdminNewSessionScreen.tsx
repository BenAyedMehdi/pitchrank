import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RefreshCw, Loader2, Plus, X, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminNav } from "@/components/AdminNav";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { buildCriteriaLabelsForStorage, getCriteriaInputDefaults, MIN_CRITERIA_COUNT } from "@/lib/voting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function AdminNewSessionScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState(generateCode());
  const [criteriaInputs, setCriteriaInputs] = useState<string[]>(getCriteriaInputDefaults());
  const [creating, setCreating] = useState(false);
  const criteriaCount = criteriaInputs.filter((label) => label.trim().length > 0).length;

  const setCriteriaInput = (index: number, value: string) => {
    setCriteriaInputs((prev) => prev.map((label, i) => (i === index ? value : label)));
  };

  const addCriteriaInput = () => {
    setCriteriaInputs((prev) => [...prev, ""]);
  };

  const removeCriteriaInput = (index: number) => {
    if (criteriaInputs.length <= MIN_CRITERIA_COUNT) return;
    setCriteriaInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    let criteriaLabels: string[];
    try {
      criteriaLabels = buildCriteriaLabelsForStorage(criteriaInputs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "At least 2 criteria are required");
      return;
    }

    setCreating(true);

    let joinCode = code;
    let retried = false;

    const tryInsert = async (c: string) => {
      const { data, error } = await supabase
        .from("sessions")
        .insert({ name: name.trim(), join_code: c, criteria_labels: criteriaLabels })
        .select()
        .single();
      return { data, error };
    };

    let result = await tryInsert(joinCode);

    // Retry once on duplicate join code
    if (result.error && result.error.code === "23505" && !retried) {
      joinCode = generateCode();
      setCode(joinCode);
      retried = true;
      result = await tryInsert(joinCode);
    }

    if (result.error) {
      console.error("Failed to create session:", result.error);
      toast.error("Failed to create session");
      setCreating(false);
      return;
    }

    toast.success("Session created!");
    navigate(`/admin/sessions/${result.data.id}/setup`);
  };

  const createButton = (
    <Button
      onClick={handleCreate}
      disabled={!name.trim() || creating || criteriaCount < 2}
      className="w-full h-12 text-base font-semibold"
      size="lg"
    >
      {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      Create session
    </Button>
  );

  return (
    <div className="min-h-screen pb-10">
      <div className="max-w-[480px] md:max-w-4xl lg:max-w-5xl mx-auto px-4">
        <AdminNav title="Create session" backTo="/admin/sessions" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          {/* Desktop: two-column grid; mobile: single column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">

            {/* ── Left column: Session identity ── */}
            <div className="space-y-5">
              <div className="bg-card border rounded-2xl p-5 space-y-5">
                <h2 className="font-heading font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  Session details
                </h2>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Session name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. IT Hub Hackathon 2025"
                    className="h-12 bg-background"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Join code</label>
                  <div className="flex items-center gap-3">
                    <JoinCodeDisplay code={code} />
                    <button
                      onClick={() => setCode(generateCode())}
                      title="Regenerate code"
                      className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Participants use this code to join. You can regenerate it before activating.
                  </p>
                </div>
              </div>

              {/* Create button pinned below session details on desktop */}
              <div className="hidden md:block">{createButton}</div>
            </div>

            {/* ── Right column: Voting criteria ── */}
            <div className="bg-card border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  Voting criteria
                </h2>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  criteriaCount >= 2
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                )}>
                  {criteriaCount} / min 2
                </span>
              </div>

              <div className="space-y-2">
                {criteriaInputs.map((label, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="flex items-center gap-2 group"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground shrink-0 text-xs font-semibold">
                      {index + 1}
                    </span>
                    <Input
                      value={label}
                      onChange={(e) => setCriteriaInput(index, e.target.value)}
                      placeholder={`e.g. Innovation`}
                      className="h-10 bg-background flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeCriteriaInput(index)}
                      disabled={criteriaInputs.length <= MIN_CRITERIA_COUNT}
                      title="Remove criteria"
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0",
                        criteriaInputs.length <= MIN_CRITERIA_COUNT
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      )}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>

              <button
                type="button"
                onClick={addCriteriaInput}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border hover:border-primary/60 hover:bg-primary/5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add criteria
              </button>

              {criteriaCount < 2 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hash className="w-3 h-3" />
                  Add at least 2 criteria to create a session.
                </p>
              )}
            </div>
          </div>

          {/* Mobile-only create button at the bottom */}
          <div className="mt-6 md:hidden">{createButton}</div>
        </motion.div>
      </div>
    </div>
  );
}
