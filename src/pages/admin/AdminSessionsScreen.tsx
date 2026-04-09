import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Users, Settings, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminNav } from "@/components/AdminNav";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { supabase } from "@/integrations/supabase/client";

interface SessionRow {
  id: string;
  name: string;
  join_code: string;
  status: string;
  created_at: string;
  teamCount: number;
  participantCount: number;
}

export default function AdminSessionsScreen() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("sessions")
        .select("*, teams(id), participants(id)")
        .order("created_at", { ascending: false });

      if (err) {
        console.error("Failed to load sessions:", err);
        setError("Failed to load sessions");
        setLoading(false);
        return;
      }

      setSessions(
        (data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          join_code: s.join_code,
          status: s.status,
          created_at: s.created_at,
          teamCount: s.teams?.length ?? 0,
          participantCount: s.participants?.length ?? 0,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  const statusMap = (s: string) => {
    if (s === "setup") return "setup" as const;
    if (s === "active") return "active" as const;
    return "closed" as const;
  };

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

        {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 h-32 animate-pulse bg-muted/30" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-muted-foreground text-sm">No sessions yet.</p>
            <p className="text-muted-foreground text-xs">Create your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, i) => (
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
                        <JoinCodeDisplay code={session.join_code} />
                        <SessionStatusBadge status={statusMap(session.status)} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Settings className="w-3.5 h-3.5" /> {session.teamCount} teams
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {session.participantCount} joined
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
        )}
      </div>
    </div>
  );
}
