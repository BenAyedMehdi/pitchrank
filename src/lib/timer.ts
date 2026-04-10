const TIMER_SECONDS = 60;

export function getSecondsRemaining(timerStartedAt: string | null, nowMs: number = Date.now()): number {
  if (!timerStartedAt) return 0;

  const startedAtMs = Date.parse(timerStartedAt);
  if (Number.isNaN(startedAtMs)) return 0;

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const remainingMs = Math.max(0, TIMER_SECONDS * 1000 - elapsedMs);

  return Math.ceil(remainingMs / 1000);
}

