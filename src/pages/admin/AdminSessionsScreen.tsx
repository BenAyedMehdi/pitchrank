import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Users, Settings, Radio, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminNav } from "@/components/AdminNav";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const [deleteTarget, setDeleteTarget] = useState<SessionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await supabase.from("sessions").delete().eq("id", deleteTarget.id);
    if (err) {
      console.error("Failed to delete session:", err);
      setError("Failed to delete session. Please try again.");
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="min-h-screen px-4 pb-8">
      <div className="max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <AdminNav title="Sessions" />
          <Button onClick={() => navigate("/admin/sessions/new")} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New session</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 h-40 animate-pulse bg-muted/30" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-muted-foreground text-sm">No sessions yet.</p>
            <p className="text-muted-foreground text-xs">Create your first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="p-4 flex flex-col gap-3 h-full">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-heading font-semibold text-sm truncate">{session.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <JoinCodeDisplay code={session.join_code} />
                        <SessionStatusBadge status={statusMap(session.status)} />
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(session)}
                      className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Settings className="w-3.5 h-3.5" /> {session.teamCount} teams
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {session.participantCount} joined
                    </span>
                    {session.created_at && (
                      <span className="flex items-center gap-1 ml-auto">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {format(new Date(session.created_at), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => navigate(`/admin/sessions/${session.id}/setup`)}
                    >
                      <Settings className="w-4 h-4 mr-1.5" /> Manage
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9"
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{deleteTarget?.name}</strong> and all of its
              teams, participants and votes will be permanently deleted. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
