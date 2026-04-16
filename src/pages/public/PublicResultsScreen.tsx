import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildCriteriaDisplayLabels,
  getAllCategoryKeys,
} from "@/lib/results";
import { normalizeCriteriaLabels } from "@/lib/voting";

export default function PublicResultsScreen() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [teams, setTeams] = useState<Tables<"teams">[]>([]);
  const [participants, setParticipants] = useState<Tables<"participants">[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadData = async (sessionId: string) => {
    const [sessionRes, teamsRes, participantsRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
      supabase.from("teams").select("*").eq("session_id", sessionId).order("pitch_order"),
      supabase.from("participants").select("*").eq("session_id", sessionId),
    ]);

    if (sessionRes.error || !sessionRes.data) {
      setNotFound(true);
      return;
    }
    if (teamsRes.error || participantsRes.error) {
      return;
    }

    setSession(sessionRes.data);
    setTeams(teamsRes.data || []);
    setParticipants(participantsRes.data || []);
    setNotFound(false);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadData(id).finally(() => setLoading(false));

    const channel = supabase
      .channel(`public-results-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${id}` }, () => {
        void loadData(id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `session_id=eq.${id}` }, () => {
        void loadData(id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const criteriaLabels = useMemo(() => normalizeCriteriaLabels(session?.criteria_labels), [session?.criteria_labels]);
  const criteriaDisplayLabels = useMemo(
    () => buildCriteriaDisplayLabels(criteriaLabels, []),
    [criteriaLabels],
  );
  const allCategoryKeys = useMemo(
    () => getAllCategoryKeys(criteriaDisplayLabels.length),
    [criteriaDisplayLabels.length],
  );

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const membersByTeamId = useMemo(() => {
    const map = new Map<string, string[]>();
    participants.forEach((p) => {
      if (!p.team_id || p.is_observer) return;
      const list = map.get(p.team_id) ?? [];
      list.push(p.name);
      map.set(p.team_id, list);
    });
    return map;
  }, [participants]);

  const winnerCards = useMemo(() => {
    if (!session || session.status !== "results_revealed") return [];
    const stored = session.category_winners as Record<string, string> | null;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return [];
    return allCategoryKeys
      .map((key) => {
        const teamId = stored[key];
        if (!teamId) return null;
        const label = key === "overall"
          ? "Overall"
          : criteriaDisplayLabels[parseInt(key.replace("criterion-", ""), 10)] ?? key;
        return {
          key,
          label,
          teamId,
          teamName: teamById.get(teamId)?.name ?? "Unknown team",
          members: membersByTeamId.get(teamId) ?? [],
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [session, allCategoryKeys, criteriaDisplayLabels, teamById, membersByTeamId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-[560px] w-full p-8 text-center space-y-2">
          <h1 className="text-xl font-semibold">Results link is not valid</h1>
          <p className="text-sm text-muted-foreground">Check the URL and try again.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-[900px] mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-card to-card p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-yellow-300/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Final Results</p>
              <h1 className="text-2xl font-heading font-bold">{session.name}</h1>
            </div>
          </div>
        </div>

        {session.status !== "results_revealed" ? (
          <Card className="p-8 text-center space-y-2">
            <Trophy className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Results not yet revealed</p>
            <p className="text-xs text-muted-foreground">Check back once the admin announces the winners.</p>
          </Card>
        ) : winnerCards.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Winners have not been determined yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {winnerCards.map((card, index) => (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-md space-y-3 h-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">{card.label}</span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm">
                      <Trophy className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <h2 className="text-xl font-heading font-bold text-amber-900">{card.teamName}</h2>
                  {card.members.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700">
                        <Users className="h-3.5 w-3.5" />
                        <span>Team members</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {card.members.map((name) => (
                          <span
                            key={name}
                            className="rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-medium text-amber-800"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
