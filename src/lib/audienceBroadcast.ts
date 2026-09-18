import { supabase } from "./supabase";

/** Sends a one-off broadcast on the "audience-nav" channel.
 *
 * `supabase.channel("audience-nav")` doesn't create a new connection when
 * one already exists for that topic — the client returns the SAME channel
 * instance (see RealtimeClient.channel() in @supabase/realtime-js), and
 * AudienceNavListener (mounted once in the root layout) already has that
 * exact topic subscribed on every page, admin included. So this just grabs
 * that same already-joined channel and sends directly — calling
 * .subscribe() again here would call it a second time on someone else's
 * channel, which tears the existing subscription down (a phx_leave with no
 * rejoin) instead of ever sending anything. */
function broadcastAudienceNav(event: string, payload: Record<string, unknown>) {
  const channel = supabase.channel("audience-nav");
  return channel.send({ type: "broadcast", event, payload }).then(() => {});
}

export function broadcastGotoPage(path: string) {
  return broadcastAudienceNav("goto-page", { path });
}

export function broadcastGotoVote(teamId: string, excludeTeamIds: string[]) {
  return broadcastAudienceNav("goto-vote", { teamId, excludeTeamIds });
}
