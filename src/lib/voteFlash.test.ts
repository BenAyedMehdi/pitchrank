import { afterEach, describe, expect, it } from "vitest";
import { consumeLastVotedTeam, setLastVotedTeam } from "./voteFlash";

describe("voteFlash", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("stores and consumes the last voted team once", () => {
    setLastVotedTeam("Team Alpha");
    expect(consumeLastVotedTeam()).toBe("Team Alpha");
    expect(consumeLastVotedTeam()).toBeNull();
  });
});

