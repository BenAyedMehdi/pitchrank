import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminNav } from "@/components/AdminNav";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
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
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);

    let joinCode = code;
    let retried = false;

    const tryInsert = async (c: string) => {
      const { data, error } = await supabase
        .from("sessions")
        .insert({ name: name.trim(), join_code: c })
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

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
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
