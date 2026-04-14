import { describe, expect, it } from "vitest";
import { buildPublicResultsPath, buildPublicResultsUrl } from "./resultsLink";

describe("resultsLink", () => {
  it("builds public path from session id", () => {
    expect(buildPublicResultsPath("abc-123")).toBe("/results/public/abc-123");
  });

  it("builds public url and normalizes trailing slash", () => {
    expect(buildPublicResultsUrl("https://pitchrank.app", "abc-123")).toBe(
      "https://pitchrank.app/results/public/abc-123",
    );
    expect(buildPublicResultsUrl("https://pitchrank.app/", "abc-123")).toBe(
      "https://pitchrank.app/results/public/abc-123",
    );
  });
});
