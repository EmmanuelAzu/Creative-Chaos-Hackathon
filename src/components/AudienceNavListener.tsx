"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyTeamId } from "@/lib/myTeam";

/** Mounted once in the root layout. Lets the admin force every open browser
 * in the room to jump somewhere: either a top-5 team's final-vote ballot
 * (excluding browsers belonging to a top-5 team themselves, who sit that
 * one out), or a plain page everyone should be watching — the leaderboard
 * or final-reveal ceremony — with no exclusions. */
export function AudienceNavListener() {
  const router = useRouter();

  useEffect(() => {
    const myTeamId = getMyTeamId();
    const channel = supabase
      .channel("audience-nav")
      .on("broadcast", { event: "goto-vote" }, ({ payload }) => {
        const teamId = payload?.teamId as string | undefined;
        const excludeTeamIds = (payload?.excludeTeamIds as string[] | undefined) ?? [];
        if (!teamId) return;
        if (myTeamId && excludeTeamIds.includes(myTeamId)) return;
        router.push(`/final/vote/${teamId}`);
      })
      .on("broadcast", { event: "goto-page" }, ({ payload }) => {
        const path = payload?.path as string | undefined;
        if (path) router.push(path);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
