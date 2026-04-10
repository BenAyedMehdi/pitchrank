import { describe, expect, it } from "vitest";
import {
  buildCriteriaLabelsForStorage,
  getCriteriaInputDefaults,
  isCompleteVote,
  mapScoresToCriteriaScores,
  normalizeCriteriaLabels,
} from "./voting";

describe("normalizeCriteriaLabels", () => {
  it("returns empty list for missing labels", () => {
    expect(normalizeCriteriaLabels(null)).toEqual([]);
    expect(normalizeCriteriaLabels(undefined)).toEqual([]);
  });

  it("uses provided labels and removes empty ones", () => {
    expect(normalizeCriteriaLabels([" Tech ", "", "Function", "Innovation"])).toEqual([
      "Tech",
      "Function",
      "Innovation",
    ]);
  });
});

describe("buildCriteriaLabelsForStorage", () => {
  it("requires at least 2 criteria", () => {
    expect(() => buildCriteriaLabelsForStorage(["Only one", "", "", ""])).toThrow();
  });

  it("stores only provided criteria", () => {
    expect(buildCriteriaLabelsForStorage(["Tech", "Pitch", "", ""])).toEqual(["Tech", "Pitch"]);
  });

  it("accepts custom criteria count above 2", () => {
    expect(buildCriteriaLabelsForStorage(["A", "B", "C"])).toEqual(["A", "B", "C"]);
  });
});

describe("isCompleteVote", () => {
  it("requires score for every criterion", () => {
    expect(isCompleteVote([5, null, 3, 2], 4)).toBe(false);
    expect(isCompleteVote([5, 4, 3], 4)).toBe(false);
  });

  it("accepts only 1-5 values", () => {
    expect(isCompleteVote([1, 2, 3, 4], 4)).toBe(true);
    expect(isCompleteVote([0, 2, 3, 4], 4)).toBe(false);
    expect(isCompleteVote([6, 2, 3, 4], 4)).toBe(false);
  });
});

describe("getCriteriaInputDefaults", () => {
  it("returns 2 empty inputs", () => {
    expect(getCriteriaInputDefaults()).toEqual(["", ""]);
  });
});

describe("mapScoresToCriteriaScores", () => {
  it("converts complete score array to number array", () => {
    expect(mapScoresToCriteriaScores([5, 4, 3])).toEqual([5, 4, 3]);
  });

  it("throws when any score is missing", () => {
    expect(() => mapScoresToCriteriaScores([5, null, 3])).toThrow();
  });
});
