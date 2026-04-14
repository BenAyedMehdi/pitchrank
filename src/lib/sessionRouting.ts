import type { Tables } from "@/integrations/supabase/types";
import { getSessionTimerRemaining } from "@/lib/timer";

export type ParticipantRoute = "/lobby" | "/vote" | "/results";

export function isVotingOpen(
  session: Pick<Tables<"sessions">, "status" | "current_pitch_index" | "timer_started_at" | "timer_duration_seconds" | "timer_paused_remaining_seconds">,
  nowMs: number = Date.now(),
): boolean {
  return (
    session.status === "active" &&
    session.current_pitch_index >= 0 &&
    getSessionTimerRemaining(session, nowMs) > 0
  );
}

export function getParticipantRoute(
  session: Pick<
    Tables<"sessions">,
    "status" | "current_pitch_index" | "timer_started_at" | "timer_duration_seconds" | "timer_paused_remaining_seconds"
  >,
  nowMs: number = Date.now(),
): ParticipantRoute {
  if (session.status === "voting_closed" || session.status === "results_revealed") {
    return "/results";
  }

  return isVotingOpen(session, nowMs) ? "/vote" : "/lobby";
}
