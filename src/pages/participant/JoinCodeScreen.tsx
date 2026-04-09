import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinCodeScreen() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (code.trim().length > 0) {
      navigate(`/join/${code.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] flex flex-col items-center gap-8"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-bold">PitchRank</span>
        </div>

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-bold">Enter session code</h1>
          <p className="text-muted-foreground text-sm">Ask your host for the code to join the session</p>
        </div>

        <div className="w-full space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            className="text-center text-2xl font-heading font-bold tracking-[0.2em] h-14 bg-card"
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <Button
            onClick={handleJoin}
            disabled={code.trim().length === 0}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            Join Session
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
