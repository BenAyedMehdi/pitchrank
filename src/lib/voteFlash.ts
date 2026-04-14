const LAST_VOTED_TEAM_KEY = "hackathon_last_voted_team";

export function setLastVotedTeam(teamName: string) {
  sessionStorage.setItem(LAST_VOTED_TEAM_KEY, teamName);
}

export function consumeLastVotedTeam(): string | null {
  const value = sessionStorage.getItem(LAST_VOTED_TEAM_KEY);
  if (!value) return null;
  sessionStorage.removeItem(LAST_VOTED_TEAM_KEY);
  return value;
}

