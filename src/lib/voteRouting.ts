import type { ParticipantRoute } from "@/lib/sessionRouting";

export function shouldRouteToVote(routeFromSession: ParticipantRoute, hasAlreadyVotedForCurrentPitch: boolean): boolean {
  return routeFromSession === "/vote" && !hasAlreadyVotedForCurrentPitch;
}
