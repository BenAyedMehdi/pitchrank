export const MIN_CRITERIA_COUNT = 2;

export function getCriteriaInputDefaults(): string[] {
  return Array(MIN_CRITERIA_COUNT).fill("");
}

export function normalizeCriteriaLabels(labels: string[] | null | undefined): string[] {
  if (!labels || labels.length === 0) {
    return [];
  }

  return labels.map((label) => label.trim()).filter((label) => label.length > 0);
}

export function buildCriteriaLabelsForStorage(inputs: string[]): string[] {
  const cleaned = inputs.map((label) => label.trim()).filter((label) => label.length > 0);
  if (cleaned.length < MIN_CRITERIA_COUNT) {
    throw new Error(`At least ${MIN_CRITERIA_COUNT} criteria are required.`);
  }
  return cleaned;
}

export function isCompleteVote(scores: Array<number | null>, criteriaCount: number): boolean {
  if (scores.length !== criteriaCount) return false;
  return scores.every((score) => typeof score === "number" && score >= 1 && score <= 5);
}

export function mapScoresToCriteriaScores(scores: Array<number | null>): number[] {
  if (!isCompleteVote(scores, scores.length)) {
    throw new Error("All criteria must be rated between 1 and 5.");
  }

  return scores as number[];
}
