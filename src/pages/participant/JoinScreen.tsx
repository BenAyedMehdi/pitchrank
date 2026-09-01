import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { supabase } from "@/integrations/supabase/client";
import {
  isDuplicateParticipantName,
  normalizeParticipantName,
  sanitizeParticipantName,
} from "@/lib/participantName";
import { setParticipant } from "@/lib/participantStore";
import {
  buildParticipantRoleInsert,
  getRoleDescription,
  getRoleLabel,
  requiresTeamSelection,
  type ParticipantRole,
} from "@/lib/participantRoles";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export default function JoinScreen() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState<ParticipantRole>("participant");
  const [teamId, setTeamId] = useState("");
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!code) return;
    async function load() {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*")
        .ilike("join_code", code!)
        .single();

      if (!sessionData) {
        toast.error("Session not found");
        navigate("/");
        return;
      }

      setSession(sessionData);

      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .eq("session_id", sessionData.id)
        .order("pitch_order");

      setTeams(teamsData || []);
      setLoading(false);
    }
    load();
  }, [code, navigate]);

  const needsTeam = requiresTeamSelection(role);
  const canEnter = Boolean(name.trim()) && (!needsTeam || Boolean(teamId));

  const handleEnter = async () => {
    if (!canEnter || !session) return;
    const sanitizedName = sanitizeParticipantName(name);
    const normalizedName = normalizeParticipantName(sanitizedName);
    if (!normalizedName) return;
    setNameError("");

    setSubmitting(true);

    const { data: existingParticipants, error: existingParticipantsError } = await supabase
      .from("participants")
      .select("name")
      .eq("session_id", session.id);

    if (existingParticipantsError) {
      console.error("Failed to validate participant name uniqueness:", existingParticipantsError);
      toast.error("Failed to validate participant name");
      setSubmitting(false);
      return;
    }

    if (isDuplicateParticipantName((existingParticipants || []).map((participant) => participant.name), sanitizedName)) {
      const duplicateNameError = "This name is already taken in this session. Please enter a different name.";
      setNameError(duplicateNameError);
      toast.error(duplicateNameError);
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from("participants")
      .insert({
        session_id: session.id,
        name: sanitizedName,
        ...buildParticipantRoleInsert(role, teamId || null),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to join:", error);
      toast.error("Failed to join session");
      setSubmitting(false);
      return;
    }

    setParticipant({
      id: data.id,
      name: data.name,
      teamId: data.team_id,
      isObserver: data.is_observer,
      isUseCaseOwner: data.is_use_case_owner,
      sessionId: data.session_id,
      sessionName: session.name,
    });

    navigate("/lobby");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[480px] space-y-6"
      >
        <div className="flex items-center justify-center">
          <JoinCodeDisplay code={code || "------"} />
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
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="Enter your name"
              className="h-12 bg-card"
            />
            {nameError ? (
              <p className="text-xs text-destructive">{nameError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your role</label>
            <div className="space-y-2">
              {(["participant", "use_case_owner", "observer"] as ParticipantRole[]).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setRole(option);
                    if (!requiresTeamSelection(option)) setTeamId("");
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border transition-all text-sm",
                    role === option
                      ? "border-primary bg-primary/5 text-foreground font-medium"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {getRoleLabel(option)}
                    {option === "use_case_owner" ? (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                        Own project counts 2x
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {getRoleDescription(option)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {needsTeam ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {role === "use_case_owner" ? "Your project" : "Your team"}
              </label>
              <div className="space-y-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setTeamId(team.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl border transition-all text-sm",
                      teamId === team.id
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Button
            onClick={handleEnter}
            disabled={!canEnter || submitting}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Enter
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
