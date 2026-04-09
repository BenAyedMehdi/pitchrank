import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";

const MOCK_TEAMS = [
  { id: "1", name: "Team Alpha" },
  { id: "2", name: "Team Beta" },
  { id: "3", name: "Team Gamma" },
  { id: "observer", name: "I am not a participant (organiser / mentor)" },
];

export default function JoinScreen() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");

  const handleEnter = () => {
    if (name.trim() && teamId) {
      navigate("/lobby");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[480px] space-y-6"
      >
        <div className="flex items-center justify-center">
          <JoinCodeDisplay code={code || "HACK24"} />
        </div>

        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">Join the session</h1>
          <p className="text-muted-foreground text-sm mt-1">Enter your details to participate</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="h-12 bg-card"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your team</label>
            <div className="space-y-2">
              {MOCK_TEAMS.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setTeamId(team.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                    teamId === team.id
                      ? "border-primary bg-primary/5 text-foreground font-medium"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleEnter}
            disabled={!name.trim() || !teamId}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            Enter
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
