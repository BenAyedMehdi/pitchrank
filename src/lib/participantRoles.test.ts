import { describe, expect, it } from "vitest";
import {
  buildParticipantRoleInsert,
  buildVoteWeightResolver,
  canVoteForOwnTeam,
  DEFAULT_VOTE_WEIGHT,
  getParticipantRole,
  getRoleLabel,
  getVoteWeightForTeam,
  isBlockedFromVotingForTeam,
  isUseCaseOwner,
  requiresTeamSelection,
  resolveVoteWeight,
  USE_CASE_OWNER_VOTE_WEIGHT,
} from "./participantRoles";

describe("getParticipantRole", () => {
  it("maps flags to roles", () => {
    expect(getParticipantRole({})).toBe("participant");
    expect(getParticipantRole({ is_use_case_owner: true })).toBe("use_case_owner");
    expect(getParticipantRole({ is_observer: true })).toBe("observer");
  });

  it("prefers observer when both flags are set", () => {
    expect(getParticipantRole({ is_observer: true, is_use_case_owner: true })).toBe("observer");
  });

  it("tolerates null flags", () => {
    expect(getParticipantRole({ is_observer: null, is_use_case_owner: null })).toBe("participant");
  });
});

describe("getVoteWeightForTeam", () => {
  const owner = { is_use_case_owner: true, team_id: "t1" };

  it("doubles a use case owner vote on their own project", () => {
    expect(getVoteWeightForTeam(owner, "t1")).toBe(USE_CASE_OWNER_VOTE_WEIGHT);
    expect(USE_CASE_OWNER_VOTE_WEIGHT).toBe(2);
  });

  it("keeps a use case owner vote normal on every other project", () => {
    expect(getVoteWeightForTeam(owner, "t2")).toBe(DEFAULT_VOTE_WEIGHT);
    expect(getVoteWeightForTeam(owner, "t3")).toBe(DEFAULT_VOTE_WEIGHT);
  });

  it("never doubles for a use case owner without a project", () => {
    expect(getVoteWeightForTeam({ is_use_case_owner: true, team_id: null }, "t1")).toBe(
      DEFAULT_VOTE_WEIGHT,
    );
  });

  it("gives everyone else the default weight", () => {
    expect(getVoteWeightForTeam({ team_id: "t1" }, "t1")).toBe(DEFAULT_VOTE_WEIGHT);
    expect(getVoteWeightForTeam({ is_observer: true }, "t1")).toBe(DEFAULT_VOTE_WEIGHT);
    expect(getVoteWeightForTeam({ is_observer: true, is_use_case_owner: true, team_id: "t1" }, "t1")).toBe(
      DEFAULT_VOTE_WEIGHT,
    );
  });
});

describe("buildVoteWeightResolver / resolveVoteWeight", () => {
  const participants = [
    { id: "p1", team_id: "t1" },
    { id: "p2", team_id: "t1", is_use_case_owner: true },
    { id: "p3", is_observer: true },
  ];
  const resolver = buildVoteWeightResolver(participants);

  it("resolves the weight per participant and team", () => {
    expect(resolver("p1", "t1")).toBe(1);
    expect(resolver("p2", "t1")).toBe(2);
    expect(resolver("p2", "t2")).toBe(1);
    expect(resolver("p3", "t1")).toBe(1);
  });

  it("falls back to the default weight for unknown voters or no resolver", () => {
    expect(resolver("nope", "t1")).toBe(DEFAULT_VOTE_WEIGHT);
    expect(resolveVoteWeight("p2", "t1", undefined)).toBe(DEFAULT_VOTE_WEIGHT);
    expect(resolveVoteWeight("p2", "t1", resolver)).toBe(2);
  });
});

describe("role capabilities", () => {
  it("requires a team for everyone but observers", () => {
    expect(requiresTeamSelection("participant")).toBe(true);
    expect(requiresTeamSelection("use_case_owner")).toBe(true);
    expect(requiresTeamSelection("observer")).toBe(false);
  });

  it("only lets use case owners rate their own project", () => {
    expect(canVoteForOwnTeam("use_case_owner")).toBe(true);
    expect(canVoteForOwnTeam("participant")).toBe(false);
    expect(canVoteForOwnTeam("observer")).toBe(false);
  });

  it("exposes readable labels", () => {
    expect(getRoleLabel("use_case_owner")).toBe("Use case owner");
    expect(getRoleLabel("participant")).toBe("Team member");
    expect(getRoleLabel("observer")).toBe("Observer");
  });
});

describe("isBlockedFromVotingForTeam", () => {
  it("blocks plain team members from their own team", () => {
    expect(isBlockedFromVotingForTeam({ team_id: "t1" }, "t1")).toBe(true);
    expect(isBlockedFromVotingForTeam({ team_id: "t1" }, "t2")).toBe(false);
  });

  it("never blocks use case owners, even for their own project", () => {
    expect(isBlockedFromVotingForTeam({ team_id: "t1", is_use_case_owner: true }, "t1")).toBe(false);
    expect(isUseCaseOwner({ is_use_case_owner: true })).toBe(true);
  });

  it("never blocks observers", () => {
    expect(isBlockedFromVotingForTeam({ team_id: null, is_observer: true }, "t1")).toBe(false);
  });
});

describe("buildParticipantRoleInsert", () => {
  it("builds the insert payload per role", () => {
    expect(buildParticipantRoleInsert("participant", "t1")).toEqual({
      team_id: "t1",
      is_observer: false,
      is_use_case_owner: false,
    });
    expect(buildParticipantRoleInsert("use_case_owner", "t1")).toEqual({
      team_id: "t1",
      is_observer: false,
      is_use_case_owner: true,
    });
    expect(buildParticipantRoleInsert("observer", "t1")).toEqual({
      team_id: null,
      is_observer: true,
      is_use_case_owner: false,
    });
  });
});
