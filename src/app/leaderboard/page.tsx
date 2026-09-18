"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Round1TeamScore } from "@/lib/types";

interface RevealTeam {
  id: string;
  name: string;
  round1_rank: number;
  aggregate_score: number | null;
}

export default function Leaderboard() {
  const [totalTeams, setTotalTeams] = useState(0);
  const [judgedTeams, setJudgedTeams] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const [revealed, setRevealed] = useState<RevealTeam[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [liveStandings, setLiveStandings] = useState<Round1TeamScore[]>([]);

  useEffect(() => {
    setIsAdmin(!!sessionStorage.getItem("admin_key"));
    load();
    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function load() {
    const { data: settings } = await supabase
      .from("settings")
      .select("round1_reveal_step")
      .single();
    const step = settings?.round1_reveal_step ?? 0;
    setRevealStep(step);

    const { count: teamCount } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true });
    setTotalTeams(teamCount ?? 0);

    const { data: scores } = await supabase
      .from("round1_team_scores")
      .select("team_id, aggregate_score, judges_scored");
    const judged = (scores ?? []).filter((r) => (r.judges_scored ?? 0) > 0).length;
    setJudgedTeams(judged);

    if (sessionStorage.getItem("admin_key")) {
      const { data: live } = await supabase
        .from("round1_team_scores")
        .select("*")
        .order("aggregate_score", { ascending: false, nullsFirst: false });
      setLiveStandings((live as Round1TeamScore[]) ?? []);
    }

    if (step > 0) {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, round1_rank")
        .not("round1_rank", "is", null)
        .order("round1_rank");
      const scoreByTeam = new Map((scores as Round1TeamScore[] | null ?? []).map((s) => [s.team_id, s.aggregate_score]));
      setRevealed(
        (teams ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          round1_rank: t.round1_rank as number,
          aggregate_score: scoreByTeam.get(t.id) ?? null,
        }))
      );
    } else {
      setRevealed([]);
    }
  }

  const unlockThreshold = Math.ceil(totalTeams / 2);
  const unlocked = totalTeams > 0 && judgedTeams >= unlockThreshold;

  // Ranks revealed so far, going from 10th down to 1st as `revealStep` increases.
  const shownRanks = revealed
    .filter((t) => t.round1_rank >= 11 - revealStep)
    .sort((a, b) => a.round1_rank - b.round1_rank);
  const placeholderRanks = Array.from({ length: 10 - shownRanks.length }, (_, i) => 10 - i - shownRanks.length);

  return (
    <PageShell eyebrow="LEADERBOARD">
      <h1 className="text-3xl tracking-tight mb-8">Round 1 leaderboard</h1>

      {isAdmin && (
        <div className="max-w-xl mb-10 border border-teal/40 bg-teal/5 p-5">
          <p className="font-mono text-[10px] tracking-widest text-teal mb-3">
            ADMIN PREVIEW · LIVE STANDINGS — NOT VISIBLE TO THE PUBLIC
          </p>
          <div className="flex flex-col divide-y divide-line text-sm">
            {liveStandings.map((r, i) => (
              <div key={r.team_id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-mono text-ink/40 mr-2">{i + 1}</span>
                  {r.team_name}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-ink/50 text-xs">
                    {r.judges_scored} judge{r.judges_scored === 1 ? "" : "s"}
                  </span>
                  <span className="font-mono text-teal">{r.aggregate_score ?? "—"}</span>
                </span>
              </div>
            ))}
            {liveStandings.length === 0 && <p className="text-ink/50 py-2">No scores yet.</p>}
          </div>
          <p className="font-mono text-[10px] text-ink/40 tracking-widest mt-4">
            BELOW: EXACTLY WHAT THE PUBLIC CURRENTLY SEES ↓
          </p>
        </div>
      )}

      {!unlocked && (
        <p className="text-ink/60 font-mono text-sm">
          Scores are still coming in ({judgedTeams}/{totalTeams || "—"} teams
          judged so far) — the board unlocks once half the teams are scored.
        </p>
      )}

      {unlocked && revealStep === 0 && (
        <div className="max-w-xl">
          <p className="text-ink/60 font-mono text-sm mb-6">
            Standings are in. Waiting on the room for the top 10 reveal.
          </p>
          <div className="flex flex-col divide-y divide-line border-t border-b border-line">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-4">
                <span className="flex items-center gap-4">
                  <span className="font-mono text-ink/40 w-6">{10 - i}</span>
                  <span className="h-4 w-40 bg-ink/10 blur-sm rounded" />
                </span>
                <span className="h-4 w-12 bg-ink/10 blur-sm rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {unlocked && revealStep > 0 && (
        <div className="max-w-xl">
          <div className="flex flex-col divide-y divide-line border-t border-b border-line">
            <AnimatePresence>
              {shownRanks.map((t) => {
                const advancing = t.round1_rank <= 5;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 140, damping: 16 }}
                    className={`flex items-center justify-between py-4 ${
                      advancing ? "bg-volt/10 px-2 -mx-2" : ""
                    }`}
                  >
                    <span className="flex items-center gap-4">
                      <span className="font-mono text-ink/40 w-6">{t.round1_rank}</span>
                      <span className="text-lg">{t.name}</span>
                      {advancing && (
                        <span className="font-mono text-[10px] tracking-widest text-teal border border-teal px-1.5 py-0.5">
                          ADVANCING
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-teal text-lg">
                      {t.aggregate_score ?? "—"}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {placeholderRanks.map((rank) => (
              <div key={rank} className="flex items-center justify-between py-4">
                <span className="flex items-center gap-4">
                  <span className="font-mono text-ink/40 w-6">{rank}</span>
                  <span className="h-4 w-40 bg-ink/10 blur-sm rounded" />
                </span>
                <span className="h-4 w-12 bg-ink/10 blur-sm rounded" />
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
