export function shouldRouteToVote(routeFromSession: "/lobby" | "/vote", hasAlreadyVotedForCurrentPitch: boolean): boolean {
  return routeFromSession === "/vote" && !hasAlreadyVotedForCurrentPitch;
}

