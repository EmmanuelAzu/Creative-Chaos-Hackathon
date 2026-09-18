"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";

interface RevealTeam {
  id: string;
  name: string;
  final_rank: number;
  weighted_score: number | null;
}

const ORDINALS: Record<number, string> = {
  5: "5th place",
  4: "4th place",
  3: "3rd place",
  2: "Runner-up",
  1: "Winner",
};

// Podium colors mirror the certificate tiers (gold/silver/bronze), so the
// live reveal and the PDF someone takes home tell the same visual story.
const RANK_COLORS: Record<number, string> = {
  1: "#D4AF37",
  2: "#C0C0C0",
  3: "#CD7F32",
};
const DEFAULT_RANK_COLOR = "#7FD6D1";

const CONFETTI_COLORS = ["#B6FF3D", "#4FBDB6", "#D4AF37", "#F5F7F0", "#12736F"];

export default function Reveal() {
  const [step, setStep] = useState(0);
  const [teams, setTeams] = useState<RevealTeam[]>([]);
  const [justRevealedRank, setJustRevealedRank] = useState<number | null>(null);
  const prevStepRef = useRef(0);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("reveal")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "final_votes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (step > prevStepRef.current) {
      const rank = 6 - step;
      setJustRevealedRank(rank);
      const t = setTimeout(() => setJustRevealedRank(null), 1200);
      prevStepRef.current = step;
      return () => clearTimeout(t);
    }
    prevStepRef.current = step;
  }, [step]);

  async function load() {
    const { data: s } = await supabase.from("settings").select("reveal_step").single();
    setStep(s?.reveal_step ?? 0);

    const { data: t } = await supabase
      .from("teams")
      .select("id, name, final_rank")
      .not("final_rank", "is", null)
      .order("final_rank", { ascending: true });
    const { data: scores } = await supabase.from("final_team_scores").select("team_id, weighted_score");
    const scoreByTeam = new Map((scores ?? []).map((r) => [r.team_id, r.weighted_score as number | null]));

    setTeams(
      ((t as { id: string; name: string; final_rank: number }[]) ?? []).map((team) => ({
        ...team,
        weighted_score: scoreByTeam.get(team.id) ?? null,
      }))
    );
  }

  // Shown top (1st) to bottom (5th) like a real leaderboard — even though the
  // suspenseful order ranks are *revealed* in runs the other way, 5th down to
  // 1st. `layout` on each row animates the reshuffle as better ranks land.
  const revealedRanks = teams
    .filter((t) => t.final_rank >= 6 - step)
    .sort((a, b) => a.final_rank - b.final_rank);
  const winnerRevealed = revealedRanks.some((t) => t.final_rank === 1);

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col items-center justify-center px-4 sm:px-6 py-24 relative overflow-hidden">
      <div className="absolute top-6 left-4 sm:top-8 sm:left-8 flex items-center gap-3 opacity-70">
        <Logo size={32} />
        <span className="font-mono text-xs tracking-widest">CREATIVE CHAOS</span>
      </div>

      {step === 0 && (
        <motion.p
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="font-mono text-sm text-paper/50"
        >
          Waiting for results…
        </motion.p>
      )}

      <AnimatePresence>
        {justRevealedRank !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-20 flex items-center justify-center bg-ink/95 backdrop-blur-sm"
          >
            <motion.span
              initial={{ letterSpacing: "0.1em", opacity: 0.4, scale: 0.9 }}
              animate={{ letterSpacing: "0.5em", opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="font-mono text-paper text-sm sm:text-base tracking-widest text-center px-6"
              style={{ color: RANK_COLORS[justRevealedRank] ?? "#F5F7F0" }}
            >
              {justRevealedRank === 1 ? "REVEALING THE WINNER…" : `REVEALING ${ORDINALS[justRevealedRank]?.toUpperCase()}…`}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {winnerRevealed && <Confetti />}

      <div className="flex flex-col gap-4 sm:gap-5 w-full max-w-xl">
        <AnimatePresence>
          {revealedRanks.map((t) => (
            <RevealRow key={t.id} team={t} justRevealed={t.final_rank === justRevealedRank} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RevealRow({ team, justRevealed }: { team: RevealTeam; justRevealed: boolean }) {
  const podium = team.final_rank <= 3;
  const rankColor = RANK_COLORS[team.final_rank] ?? DEFAULT_RANK_COLOR;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.9, rotateX: -30 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: team.final_rank === 1 ? 1.08 : 1,
        rotateX: 0,
        boxShadow: justRevealed
          ? [`0 0 0px ${rankColor}00`, `0 0 40px ${rankColor}80`, `0 0 18px ${rankColor}59`]
          : team.final_rank === 1
          ? ["0 0 0px rgba(182,255,61,0)", "0 0 40px rgba(182,255,61,0.5)", "0 0 18px rgba(182,255,61,0.35)"]
          : "0 0 0px rgba(0,0,0,0)",
      }}
      transition={{
        layout: { type: "spring", stiffness: 140, damping: 18 },
        default: { type: "spring", stiffness: 140, damping: 16 },
        boxShadow: { duration: 1.6, ease: "easeOut" },
      }}
      style={{ transformPerspective: 600 }}
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 border px-5 sm:px-6 py-4 sm:py-5 text-center sm:text-left ${
        team.final_rank === 1 ? "border-volt bg-volt/10" : podium ? "border-paper/30" : "border-paper/20"
      }`}
    >
      <motion.span
        initial={{ scale: 1.8, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
        className="font-mono text-xs tracking-widest shrink-0"
        style={{ color: rankColor }}
      >
        {ORDINALS[team.final_rank]?.toUpperCase()}
      </motion.span>
      <span
        className={`text-xl sm:text-2xl md:text-3xl tracking-tight break-words ${
          team.final_rank === 1 ? "text-volt" : "text-paper"
        }`}
      >
        {team.name}
      </span>
      <span className="font-mono text-base sm:text-lg shrink-0" style={{ color: rankColor }}>
        <CountUpScore value={team.weighted_score} />
      </span>
    </motion.div>
  );
}

function CountUpScore({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === null) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value]);
  return <>{value === null ? "—" : display.toFixed(2)}</>;
}

/** A lightweight, dependency-free confetti burst for the winner reveal. */
function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.2 + Math.random() * 1.4;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size = 6 + Math.random() * 6;
        const rotateEnd = 360 + Math.random() * 360;
        return (
          <motion.span
            key={i}
            initial={{ y: -40, x: 0, opacity: 0, rotate: 0 }}
            animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: rotateEnd }}
            transition={{ duration, delay, ease: "easeIn" }}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: 0,
              width: size,
              height: size * 0.4,
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );
}
