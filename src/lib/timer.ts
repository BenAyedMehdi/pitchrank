import type { Tables } from "@/integrations/supabase/types";

export const DEFAULT_TIMER_SECONDS = 60;

function sanitizeDuration(durationSeconds: number | null | undefined): number {
  if (typeof durationSeconds !== "number" || Number.isNaN(durationSeconds)) {
    return DEFAULT_TIMER_SECONDS;
  }

  return Math.max(0, Math.floor(durationSeconds));
}

export function getSecondsRemaining(
  timerStartedAt: string | null,
  nowMs: number = Date.now(),
  durationSeconds: number = DEFAULT_TIMER_SECONDS,
): number {
  const safeDuration = sanitizeDuration(durationSeconds);
  if (safeDuration <= 0) return 0;
  if (!timerStartedAt) return 0;

  const startedAtMs = Date.parse(timerStartedAt);
  if (Number.isNaN(startedAtMs)) return 0;

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const remainingMs = Math.max(0, safeDuration * 1000 - elapsedMs);

  return Math.ceil(remainingMs / 1000);
}

export function isTimerPaused(
  session: Pick<Tables<"sessions">, "timer_paused_remaining_seconds">,
): boolean {
  return typeof session.timer_paused_remaining_seconds === "number";
}

export function getSessionTimerRemaining(
  session: Pick<Tables<"sessions">, "timer_started_at" | "timer_duration_seconds" | "timer_paused_remaining_seconds">,
  nowMs: number = Date.now(),
): number {
  if (typeof session.timer_paused_remaining_seconds === "number") {
    return Math.max(0, Math.floor(session.timer_paused_remaining_seconds));
  }

  return getSecondsRemaining(session.timer_started_at, nowMs, session.timer_duration_seconds);
}
