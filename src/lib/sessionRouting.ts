import type { Tables } from "@/integrations/supabase/types";
import { getSecondsRemaining } from "@/lib/timer";

export type ParticipantRoute = "/lobby" | "/vote";

export function isVotingOpen(
  session: Pick<Tables<"sessions">, "status" | "current_pitch_index" | "timer_started_at">,
  nowMs: number = Date.now(),
): boolean {
  return (
    session.status === "active" &&
    session.current_pitch_index >= 0 &&
    getSecondsRemaining(session.timer_started_at, nowMs) > 0
  );
}

export function getParticipantRoute(
  session: Pick<Tables<"sessions">, "status" | "current_pitch_index" | "timer_started_at">,
  nowMs: number = Date.now(),
): ParticipantRoute {
  return isVotingOpen(session, nowMs) ? "/vote" : "/lobby";
}
