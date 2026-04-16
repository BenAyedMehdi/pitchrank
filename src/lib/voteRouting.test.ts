import { describe, expect, it } from "vitest";
import { shouldRouteToVote } from "./voteRouting";

describe("shouldRouteToVote", () => {
  it("routes to vote whenever session says vote, even if participant already voted", () => {
    expect(shouldRouteToVote("/vote", false)).toBe(true);
    expect(shouldRouteToVote("/vote", true)).toBe(true);
    expect(shouldRouteToVote("/lobby", false)).toBe(false);
  });
});
