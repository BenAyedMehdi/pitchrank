export type ParticipantRole = "participant" | "use_case_owner" | "observer";

export const DEFAULT_VOTE_WEIGHT = 1;
export const USE_CASE_OWNER_VOTE_WEIGHT = 2;

export interface ParticipantRoleFlags {
  is_observer?: boolean | null;
  is_use_case_owner?: boolean | null;
  team_id?: string | null;
}

/** Resolves the weight of a single vote: participant + the team being rated. */
export type VoteWeightResolver = (participantId: string, teamId: string) => number;

/** Resolves the role of a participant row. Observer wins over use case owner. */
export function getParticipantRole(participant: ParticipantRoleFlags): ParticipantRole {
  if (participant.is_observer) return "observer";
  if (participant.is_use_case_owner) return "use_case_owner";
  return "participant";
}

export function isUseCaseOwner(participant: ParticipantRoleFlags): boolean {
  return getParticipantRole(participant) === "use_case_owner";
}

/**
 * A use case owner's vote counts double **only for the project they own**.
 * On every other team they are an ordinary voter.
 */
export function getVoteWeightForTeam(participant: ParticipantRoleFlags, teamId: string): number {
  if (!isUseCaseOwner(participant)) return DEFAULT_VOTE_WEIGHT;
  if (!participant.team_id || participant.team_id !== teamId) return DEFAULT_VOTE_WEIGHT;
  return USE_CASE_OWNER_VOTE_WEIGHT;
}

export function buildVoteWeightResolver<T extends ParticipantRoleFlags & { id: string }>(
  participants: T[],
): VoteWeightResolver {
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  return (participantId, teamId) => {
    const participant = byId.get(participantId);
    if (!participant) return DEFAULT_VOTE_WEIGHT;
    return getVoteWeightForTeam(participant, teamId);
  };
}

export function resolveVoteWeight(
  participantId: string,
  teamId: string,
  resolver?: VoteWeightResolver,
): number {
  return resolver ? resolver(participantId, teamId) : DEFAULT_VOTE_WEIGHT;
}

export function getRoleLabel(role: ParticipantRole): string {
  switch (role) {
    case "observer":
      return "Observer";
    case "use_case_owner":
      return "Use case owner";
    default:
      return "Team member";
  }
}

export function getRoleDescription(role: ParticipantRole): string {
  switch (role) {
    case "observer":
      return "Organiser or mentor. Votes on every team, no project of your own.";
    case "use_case_owner":
      return "You own a use case. Pick your project — you may also vote for it, and your score counts double for your own project only.";
    default:
      return "You pitch with a team. You vote on every team except your own.";
  }
}

/** Team members and use case owners must pick a project; observers must not. */
export function requiresTeamSelection(role: ParticipantRole): boolean {
  return role !== "observer";
}

/** Only use case owners are allowed to rate the project they are attached to. */
export function canVoteForOwnTeam(role: ParticipantRole): boolean {
  return role === "use_case_owner";
}

/**
 * A voter is blocked from a pitch only when they are a plain team member of
 * the pitching team. Observers and use case owners are always eligible.
 */
export function isBlockedFromVotingForTeam(
  participant: ParticipantRoleFlags & { team_id?: string | null },
  teamId: string,
): boolean {
  const role = getParticipantRole(participant);
  if (role !== "participant") return false;
  return participant.team_id === teamId;
}

export function buildParticipantRoleInsert(role: ParticipantRole, teamId: string | null) {
  return {
    team_id: role === "observer" ? null : teamId,
    is_observer: role === "observer",
    is_use_case_owner: role === "use_case_owner",
  };
}
