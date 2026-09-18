"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
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
  const [justRevealedRank, setJustRevealedRank] = useState<number | null>(null);
  const prevStepRef = useRef(0);

  useEffect(() => {
    if (revealStep > prevStepRef.current) {
      const rank = 11 - revealStep;
      setJustRevealedRank(rank);
      const t = setTimeout(() => setJustRevealedRank(null), 900);
      prevStepRef.current = revealStep;
      return () => clearTimeout(t);
    }
    prevStepRef.current = revealStep;
  }, [revealStep]);

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

    // Fetched for everyone now, not just admins — it backs both the admin
    // preview box and the public live-standings board below.
    const { data: live } = await supabase
      .from("round1_team_scores")
      .select("*")
      .order("aggregate_score", { ascending: false, nullsFirst: false })
      .order("team_name", { ascending: true });
    const scores = (live as Round1TeamScore[]) ?? [];
    setLiveStandings(scores);
    setJudgedTeams(scores.filter((r) => (r.judges_scored ?? 0) > 0).length);

    if (step > 0) {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, round1_rank")
        .not("round1_rank", "is", null)
        .order("round1_rank");
      const scoreByTeam = new Map(scores.map((s) => [s.team_id, s.aggregate_score]));
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

  // Live scores are public and update in real time while there's still a
  // deep bench of ungraded teams — once we're down to the last 10 still
  // needing scores, hide the board again so the live reveal ceremony isn't
  // spoiled by anyone doing the math themselves in the final stretch.
  const remaining = totalTeams - judgedTeams;
  const finalStretch = totalTeams > 0 && remaining <= 10;
  const topLive = liveStandings.slice(0, 10);

  // Ranks revealed so far, going from 10th down to 1st as `revealStep` increases.
  const shownRanks = revealed
    .filter((t) => t.round1_rank >= 11 - revealStep)
    .sort((a, b) => a.round1_rank - b.round1_rank);
  const placeholderRanks = Array.from({ length: 10 - shownRanks.length }, (_, i) => 10 - i - shownRanks.length);

  return (
    <PageShell eyebrow="LEADERBOARD" themable={false}>
      <h1 className="text-3xl tracking-tight mb-8">Round 1 leaderboard</h1>

      {isAdmin && (
        <div className="max-w-xl mb-10 border border-teal/40 bg-teal/5 p-5">
          <p className="font-mono text-[10px] tracking-widest text-teal mb-3">
            {finalStretch
              ? "ADMIN PREVIEW · LIVE STANDINGS — NOT VISIBLE TO THE PUBLIC"
              : "ADMIN PREVIEW · ALL TEAMS — PUBLIC BOARD BELOW ALREADY SHOWS THE TOP 10 LIVE"}
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
          {finalStretch && (
            <p className="font-mono text-[10px] text-ink/40 tracking-widest mt-4">
              BELOW: EXACTLY WHAT THE PUBLIC CURRENTLY SEES ↓
            </p>
          )}
        </div>
      )}

      {!finalStretch && revealStep === 0 && (
        <div className="max-w-xl">
          <p className="text-ink/60 font-mono text-sm mb-6 flex items-center gap-2">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="h-1.5 w-1.5 rounded-full bg-teal inline-block"
            />
            Live standings — updating as judges finish scoring ({judgedTeams}/
            {totalTeams || "—"} teams judged so far). Hidden again once we're
            down to the last 10 still being graded.
          </p>
          <div className="flex flex-col divide-y divide-line border-t border-b border-line">
            <AnimatePresence>
              {topLive.map((r, i) => (
                <LiveRow key={r.team_id} rank={i + 1} row={r} />
              ))}
            </AnimatePresence>
            {topLive.length === 0 && (
              <p className="py-8 text-ink/50 font-mono text-sm">No scores yet.</p>
            )}
          </div>
        </div>
      )}

      {finalStretch && revealStep === 0 && (
        <div className="max-w-xl">
          <p className="text-ink/60 font-mono text-sm mb-6">
            Down to the last teams — standings are hidden now until the live
            reveal.
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

      {revealStep > 0 && (
        <div className="max-w-xl relative">
          <AnimatePresence>
            {justRevealedRank !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 z-10 flex items-center justify-center bg-ink/90 backdrop-blur-sm"
              >
                <motion.span
                  initial={{ letterSpacing: "0.1em" }}
                  animate={{ letterSpacing: "0.35em" }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="font-mono text-paper text-sm tracking-widest"
                >
                  REVEALING #{justRevealedRank}…
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex flex-col divide-y divide-line border-t border-b border-line">
            <AnimatePresence>
              {shownRanks.map((t) => (
                <RevealRow key={t.id} team={t} />
              ))}
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

function LiveRow({ rank, row }: { rank: number; row: Round1TeamScore }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ layout: { type: "spring", stiffness: 300, damping: 30 }, default: { duration: 0.3 } }}
      className="flex items-center justify-between gap-3 py-4"
    >
      <span className="flex items-center gap-4 min-w-0">
        <span className="font-mono text-ink/40 w-6 shrink-0">{rank}</span>
        <span className="text-lg break-words">{row.team_name}</span>
      </span>
      <span className="flex items-center gap-3 shrink-0">
        <span className="text-ink/50 text-xs font-mono">
          {row.judges_scored} judge{row.judges_scored === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-teal text-lg">
          <CountUpScore value={row.aggregate_score} />
        </span>
      </span>
    </motion.div>
  );
}

function RevealRow({ team }: { team: RevealTeam }) {
  const advancing = team.round1_rank <= 5;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, rotateX: -40, y: -12 }}
      animate={{
        opacity: 1,
        scale: 1,
        rotateX: 0,
        y: 0,
        backgroundColor: advancing
          ? ["rgba(182,255,61,0.35)", "rgba(182,255,61,0.1)"]
          : ["rgba(18,115,111,0.3)", "rgba(18,115,111,0)"],
      }}
      transition={{
        default: { type: "spring", stiffness: 160, damping: 18 },
        backgroundColor: { duration: 1.1, ease: "easeOut" },
      }}
      style={{ transformPerspective: 600 }}
      className={`flex items-center justify-between gap-3 py-4 ${advancing ? "px-2 -mx-2" : ""}`}
    >
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
        <motion.span
          initial={{ scale: 1.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          className="font-mono text-ink/40 w-6 shrink-0"
        >
          {team.round1_rank}
        </motion.span>
        <span className="text-lg break-words">{team.name}</span>
        {advancing && (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="font-mono text-[10px] tracking-widest text-teal border border-teal px-1.5 py-0.5 shrink-0"
          >
            ADVANCING
          </motion.span>
        )}
      </span>
      <span className="font-mono text-teal text-lg shrink-0">
        <CountUpScore value={team.aggregate_score} />
      </span>
    </motion.div>
  );
}

function CountUpScore({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === null) return;
    const controls = animate(0, value, {
      duration: 1,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value]);
  return <>{value === null ? "—" : display.toFixed(2)}</>;
}
