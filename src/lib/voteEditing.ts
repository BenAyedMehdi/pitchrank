import type { ParticipantVoteSummary } from "@/lib/participantVotes";
import { isCompleteVote } from "@/lib/voting";

/**
 * Submitted votes stay editable only while the session is open (`active`).
 * As soon as the admin closes the voting the scores are final.
 */
export function canEditSubmittedVotes(status: string | null | undefined): boolean {
  return status === "active";
}

/** Turns a vote summary into the mutable score draft used by the inline editor. */
export function buildEditableScores(summary: ParticipantVoteSummary): Array<number | null> {
  return summary.criteriaScores.map((item) =>
    typeof item.score === "number" ? item.score : null,
  );
}

export function setScoreAt(
  scores: Array<number | null>,
  index: number,
  value: number,
): Array<number | null> {
  return scores.map((score, i) => (i === index ? value : score));
}

export function isEditedVoteValid(scores: Array<number | null>): boolean {
  if (scores.length === 0) return false;
  return isCompleteVote(scores, scores.length);
}

export function hasScoreChanges(
  original: Array<number | null>,
  next: Array<number | null>,
): boolean {
  if (original.length !== next.length) return true;
  return original.some((score, index) => score !== next[index]);
}

/** Applies an updated score array to the local votes cache without a refetch. */
export function applyVoteScoresUpdate<T extends { id: string; criteria_scores: number[] }>(
  votes: T[],
  voteId: string,
  criteriaScores: number[],
): T[] {
  return votes.map((vote) =>
    vote.id === voteId ? { ...vote, criteria_scores: criteriaScores } : vote,
  );
}
