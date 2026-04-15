import type { Tables } from "@/integrations/supabase/types";
import { getSessionTimerRemaining } from "@/lib/timer";

export type ParticipantRoute = "/lobby" | "/vote" | "/results";

export function isVotingOpen(
  session: Pick<Tables<"sessions">, "status" | "current_pitch_index" | "timer_started_at" | "timer_duration_seconds" | "timer_paused_remaining_seconds">,
  nowMs: number = Date.now(),
): boolean {
  if (session.status !== "active" || session.current_pitch_index < 0) return false;

  // Timer has not been started yet — voting is open so participants can fill in
  // scores while the team pitches; the countdown starts explicitly later (G6).
  const noTimerStarted =
    session.timer_started_at === null && session.timer_paused_remaining_seconds === null;
  if (noTimerStarted) return true;

  // Timer has been started (or is paused with remaining seconds) — keep voting
  // open until the countdown reaches zero.
  return getSessionTimerRemaining(session, nowMs) > 0;
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
