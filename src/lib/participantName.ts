export function sanitizeParticipantName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeParticipantName(name: string): string {
  return sanitizeParticipantName(name).toLowerCase();
}

export function isDuplicateParticipantName(
  existingNames: string[],
  candidateName: string,
): boolean {
  const normalizedCandidate = normalizeParticipantName(candidateName);
  if (!normalizedCandidate) return false;

  return existingNames.some((name) => normalizeParticipantName(name) === normalizedCandidate);
}
