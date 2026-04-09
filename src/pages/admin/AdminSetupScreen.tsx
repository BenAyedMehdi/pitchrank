import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trash2, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminNav } from "@/components/AdminNav";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { toast } from "sonner";

export default function AdminSetupScreen() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(["Team Alpha", "Team Beta", "Team Gamma"]);
  const [newTeam, setNewTeam] = useState("");
  const [status, setStatus] = useState<"setup" | "active">("setup");
  const isActive = status === "active";

  const addTeam = () => {
    if (newTeam.trim() && !isActive) {
      setTeams([...teams, newTeam.trim()]);
      setNewTeam("");
    }
  };

  const removeTeam = (index: number) => {
    if (!isActive) {
      setTeams(teams.filter((_, i) => i !== index));
    }
  };

  const handleActivate = () => {
    setStatus("active");
    toast.success("Session activated!");
  };

  return (
    <div className="min-h-screen px-4 pb-8">
      <div className="max-w-[480px] mx-auto">
        <AdminNav title="IT Hub Hackathon 2025" backTo="/admin/sessions" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mt-2"
        >
          <div className="flex items-center gap-2">
            <JoinCodeDisplay code="HACK24" />
            <SessionStatusBadge status={status} />
          </div>

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
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between bg-card rounded-xl border px-4 py-3"
                >
                  <span className="text-sm font-medium">{team}</span>
                  {!isActive && (
                    <button
                      onClick={() => removeTeam(i)}
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

          {/* Activate / Go to Lobby */}
          <div className="pt-2">
            {!isActive ? (
              <Button
                onClick={handleActivate}
                disabled={teams.length < 2}
                className="w-full h-12 text-base font-semibold bg-success hover:bg-success/90"
                size="lg"
              >
                Activate Session
              </Button>
            ) : (
              <Button
                onClick={() => navigate("/admin/sessions/1/lobby")}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                Go to Lobby
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
