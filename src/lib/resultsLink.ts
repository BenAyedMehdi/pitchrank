export function buildPublicResultsPath(sessionId: string): string {
  return `/results/public/${sessionId}`;
}

export function buildPublicResultsUrl(origin: string, sessionId: string): string {
  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${normalizedOrigin}${buildPublicResultsPath(sessionId)}`;
}
