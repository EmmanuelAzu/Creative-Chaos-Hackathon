"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { useVoterIdentity, VoterPicker } from "@/components/VoterPicker";
import type { Team } from "@/lib/types";

interface Row extends Team {
  voted: boolean;
}

export default function FinalVoteIndex() {
  const { voter, checked, setVoter } = useVoterIdentity();
  const [stageOpen, setStageOpen] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("final-vote-index")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "final_votes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voter?.id]);

  async function load() {
    const { data: settings } = await supabase.from("settings").select("final_stage_open").single();
    setStageOpen(settings?.final_stage_open ?? false);

    const { data: teams } = await supabase.from("teams").select("*").eq("is_top5", true);
    const { data: crit } = await supabase.from("criteria").select("id").eq("stage", "final");

    if (voter) {
      const { data: votes } = await supabase
        .from("final_votes")
        .select("team_id, criteria_id")
        .eq("voter_id", voter.id);
      const votedCounts = new Map<string, number>();
      for (const v of votes ?? []) {
        votedCounts.set(v.team_id, (votedCounts.get(v.team_id) ?? 0) + 1);
      }
      setRows(
        ((teams as Team[]) ?? []).map((t) => ({
          ...t,
          voted: (votedCounts.get(t.id) ?? 0) >= (crit?.length ?? 0) && (crit?.length ?? 0) > 0,
        }))
      );
    } else {
      setRows(((teams as Team[]) ?? []).map((t) => ({ ...t, voted: false })));
    }
  }

  if (stageOpen === false) {
    return (
      <PageShell eyebrow="FINAL VOTE">
        <p className="text-ink/60 font-mono text-sm max-w-md">
          Final voting hasn't opened yet — it starts once the top 5 teams have
          presented. Keep this page open.
        </p>
      </PageShell>
    );
  }

  if (!checked) return null;

  if (!voter) {
    return (
      <PageShell eyebrow="FINAL VOTE">
        <VoterPicker onPick={setVoter} />
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow={`VOTING AS ${voter.full_name.toUpperCase()}`}>
      <h1 className="text-3xl tracking-tight mb-2">Score the top 5</h1>
      <p className="text-ink/60 mb-8 max-w-md">
        Scan a team's QR code to jump straight to their form, or pick one
        below. You can change your score until voting closes.
      </p>
      <div className="flex flex-col divide-y divide-line border-t border-b border-line max-w-lg">
        {rows.map((t) => (
          <Link
            key={t.id}
            href={`/final/vote/${t.id}`}
            className="flex items-center justify-between py-4 hover:bg-white/50 transition-colors px-2 -mx-2 focus-ring"
          >
            <span className="text-lg">{t.name}</span>
            <span
              className={`font-mono text-xs px-2 py-1 border ${
                t.voted ? "border-teal text-teal" : "border-line text-ink/50"
              }`}
            >
              {t.voted ? "SCORED" : "SCORE →"}
            </span>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="py-8 text-ink/50 font-mono text-sm">Top 5 not announced yet.</p>
        )}
      </div>
    </PageShell>
  );
}
