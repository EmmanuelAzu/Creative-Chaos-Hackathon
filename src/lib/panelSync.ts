"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Keeps every judge in the same panel on the same team: whichever one of
 * them scans/picks a team, the rest get auto-navigated there too. */
export function usePanelSync(
  panelNumber: number | null,
  selfId: string,
  onRemoteGoto: (teamId: string) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!panelNumber) return;
    const channel = supabase
      .channel(`judge-panel-${panelNumber}`)
      .on("broadcast", { event: "goto" }, ({ payload }) => {
        if (payload?.fromJudgeId !== selfId && payload?.teamId) {
          onRemoteGoto(payload.teamId);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelNumber, selfId]);

  function broadcastGoto(teamId: string) {
    channelRef.current?.send({
      type: "broadcast",
      event: "goto",
      payload: { teamId, fromJudgeId: selfId },
    });
  }

  return { broadcastGoto };
}
