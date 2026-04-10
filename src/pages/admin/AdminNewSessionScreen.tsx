import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RefreshCw, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminNav } from "@/components/AdminNav";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { buildCriteriaLabelsForStorage, getCriteriaInputDefaults, MIN_CRITERIA_COUNT } from "@/lib/voting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  return (
    <div className="min-h-screen px-4 pb-8">
      <div className="max-w-[480px] mx-auto">
        <AdminNav title="Create session" backTo="/admin/sessions" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mt-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Session name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Hub Hackathon 2025"
              className="h-12 bg-card"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Join code</label>
            <div className="flex items-center gap-3">
              <JoinCodeDisplay code={code} />
              <button
                onClick={() => setCode(generateCode())}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              A unique join code will be generated automatically. You can regenerate it before activating.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Voting criteria (min 2)</label>
            <div className="space-y-2">
              {criteriaInputs.map((label, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={label}
                    onChange={(e) => setCriteriaInput(index, e.target.value)}
                    placeholder={`Criteria ${index + 1}`}
                    className="h-11 bg-card"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    disabled={criteriaInputs.length <= MIN_CRITERIA_COUNT}
                    onClick={() => removeCriteriaInput(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" className="w-full h-10" onClick={addCriteriaInput}>
              <Plus className="w-4 h-4 mr-2" />
              Add criteria
            </Button>
            {criteriaCount < 2 && (
              <p className="text-xs text-muted-foreground">Add at least 2 criteria to create a session.</p>
            )}
          </div>

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || creating || criteriaCount < 2}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create session
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
