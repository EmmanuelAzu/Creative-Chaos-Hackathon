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
  const [activePush, setActivePush] = useState<{ teamId: string; teamName: string; deadline: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

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

  // Ticks the live "voting is open now" banner's countdown, clearing it
  // once time's up rather than leaving a stale 0:00 on screen.
  useEffect(() => {
    if (!activePush) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((new Date(activePush.deadline).getTime() - Date.now()) / 1000);
      if (remaining <= 0) {
        setActivePush(null);
        setSecondsLeft(null);
        return;
      }
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activePush]);

  async function load() {
    const { data: settings } = await supabase
      .from("settings")
      .select("final_stage_open, final_vote_team_id, final_vote_deadline")
      .single();
    setStageOpen(settings?.final_stage_open ?? false);

    const pushActive =
      !!settings?.final_vote_deadline && new Date(settings.final_vote_deadline).getTime() > Date.now();
    if (pushActive && settings?.final_vote_team_id) {
      const { data: activeTeam } = await supabase
        .from("teams")
        .select("name")
        .eq("id", settings.final_vote_team_id)
        .maybeSingle();
      setActivePush({
        teamId: settings.final_vote_team_id,
        teamName: activeTeam?.name ?? "",
        deadline: settings.final_vote_deadline!,
      });
    } else {
      setActivePush(null);
    }

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
      {activePush && secondsLeft !== null && (
        <Link
          href={`/final/vote/${activePush.teamId}`}
          className="flex items-center justify-between border border-teal bg-teal/5 px-4 py-3 mb-6 max-w-lg hover:bg-teal/10 transition-colors focus-ring"
        >
          <span className="text-sm">
            Voting is open now: <strong>{activePush.teamName}</strong>
          </span>
          <span className="font-mono text-xs text-teal shrink-0 ml-3">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} left →
          </span>
        </Link>
      )}
      <p className="text-ink/60 mb-8 max-w-md">
        Scan a team's QR code to jump straight to their form, or pick one
        below. You can change your score until voting closes.
      </p>
      <div className="flex flex-col divide-y divide-line border-t border-b border-line max-w-lg">
        {rows.map((t) => (
          <Link
            key={t.id}
            href={`/final/vote/${t.id}`}
            className="flex items-center justify-between py-4 hover:bg-surface/50 transition-colors px-2 -mx-2 focus-ring"
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
