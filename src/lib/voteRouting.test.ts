import { describe, expect, it } from "vitest";
import { shouldRouteToVote } from "./voteRouting";

describe("shouldRouteToVote", () => {
  it("routes to vote only when session says vote and participant has not voted yet", () => {
    expect(shouldRouteToVote("/vote", false)).toBe(true);
    expect(shouldRouteToVote("/vote", true)).toBe(false);
    expect(shouldRouteToVote("/lobby", false)).toBe(false);
  });
});

