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

export function mapScoresToVoteColumns(scores: Array<number | null>) {
  if (scores.some((score) => score !== null && (score < 1 || score > 5))) {
    throw new Error("All criteria scores must be between 1 and 5.");
  }

  return {
    score_technicality: (scores[0] ?? null) as number | null,
    score_pitch: (scores[1] ?? null) as number | null,
    score_functionality: (scores[2] ?? null) as number | null,
    score_innovation: (scores[3] ?? null) as number | null,
  };
}

export function mapScoresToCriteriaScores(scores: Array<number | null>): number[] {
  if (!isCompleteVote(scores, scores.length)) {
    throw new Error("All criteria must be rated between 1 and 5.");
  }

  return scores as number[];
}
