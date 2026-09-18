"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyTeamId } from "@/lib/myTeam";

/** Mounted once in the root layout. Lets the admin force every open browser
 * in the room to jump straight to a top-5 team's final-vote ballot — except
 * browsers belonging to a top-5 team themselves, who sit this one out. */
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
