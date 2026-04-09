import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_PASSWORD } from "@/lib/constants";

export default function AdminPasswordGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("admin_auth", "true");
      navigate("/admin/sessions");
    } else {
      setError("Incorrect password");
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
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Admin Panel</h1>
        </div>

        <div className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Enter admin password"
            className="h-12 bg-card"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button
            onClick={handleSubmit}
            disabled={!password}
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
