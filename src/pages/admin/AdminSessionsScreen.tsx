import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Users, Settings, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminNav } from "@/components/AdminNav";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";

const MOCK_SESSIONS = [
  { id: "1", name: "IT Hub Hackathon 2025", code: "HACK24", status: "active" as const, teams: 4, participants: 12 },
  { id: "2", name: "Spring Demo Day", code: "SPR25", status: "setup" as const, teams: 2, participants: 0 },
  { id: "3", name: "Winter Hackathon 2024", code: "WIN24", status: "closed" as const, teams: 6, participants: 24 },
];

export default function AdminSessionsScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen px-4 pb-8">
      <div className="max-w-[480px] mx-auto">
        <div className="flex items-center justify-between py-4">
          <AdminNav title="Sessions" />
          <Button onClick={() => navigate("/admin/sessions/new")} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            New session
          </Button>
        </div>

        <div className="space-y-3">
          {MOCK_SESSIONS.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-heading font-semibold text-sm">{session.name}</h3>
                    <div className="flex items-center gap-2">
                      <JoinCodeDisplay code={session.code} />
                      <SessionStatusBadge status={session.status} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Settings className="w-3.5 h-3.5" /> {session.teams} teams
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {session.participants} joined
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10"
                    onClick={() => navigate(`/admin/sessions/${session.id}/setup`)}
                  >
                    <Settings className="w-4 h-4 mr-1.5" /> Manage
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10"
                    onClick={() => navigate(`/admin/sessions/${session.id}/lobby`)}
                  >
                    <Radio className="w-4 h-4 mr-1.5" /> Lobby
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
