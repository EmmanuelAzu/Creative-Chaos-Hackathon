"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";

interface RevealTeam {
  id: string;
  name: string;
  final_rank: number;
}

const ORDINALS: Record<number, string> = {
  5: "5th place",
  4: "4th place",
  3: "3rd place",
  2: "Runner-up",
  1: "Winner",
};

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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (step > prevStepRef.current) {
      const rank = 6 - step;
      setJustRevealedRank(rank);
      const t = setTimeout(() => setJustRevealedRank(null), 1000);
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
      .order("final_rank", { ascending: false });
    setTeams((t as RevealTeam[]) ?? []);
  }

  // Ranks revealed so far, going from 5th down to 1st as `step` increases.
  const revealedRanks = teams
    .filter((t) => t.final_rank >= 6 - step)
    .sort((a, b) => b.final_rank - a.final_rank);
  const winnerRevealed = revealedRanks.some((t) => t.final_rank === 1);

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col items-center justify-center px-4 sm:px-6 py-24 relative overflow-hidden">
      <div className="absolute top-6 left-4 sm:top-8 sm:left-8 flex items-center gap-3 opacity-70">
        <Logo size={32} />
        <span className="font-mono text-xs tracking-widest">CREATIVE CHAOS</span>
      </div>

      {step === 0 && (
        <p className="font-mono text-sm text-paper/50">Waiting for results…</p>
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
              initial={{ letterSpacing: "0.1em", opacity: 0.4 }}
              animate={{ letterSpacing: "0.5em", opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="font-mono text-paper text-sm sm:text-base tracking-widest text-center px-6"
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
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 40, scale: 0.9, rotateX: -30 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: t.final_rank === 1 ? 1.08 : 1,
                rotateX: 0,
                boxShadow:
                  t.final_rank === 1
                    ? [
                        "0 0 0px rgba(182,255,61,0)",
                        "0 0 40px rgba(182,255,61,0.5)",
                        "0 0 18px rgba(182,255,61,0.35)",
                      ]
                    : "0 0 0px rgba(0,0,0,0)",
              }}
              transition={{
                default: { type: "spring", stiffness: 140, damping: 16 },
                boxShadow: { duration: 1.6, ease: "easeOut" },
              }}
              style={{ transformPerspective: 600 }}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 border px-5 sm:px-6 py-4 sm:py-5 text-center sm:text-left ${
                t.final_rank === 1 ? "border-volt bg-volt/10" : "border-paper/20"
              }`}
            >
              <span className="font-mono text-xs tracking-widest text-teal-light shrink-0">
                {ORDINALS[t.final_rank]?.toUpperCase()}
              </span>
              <span
                className={`text-xl sm:text-2xl md:text-3xl tracking-tight break-words ${
                  t.final_rank === 1 ? "text-volt" : "text-paper"
                }`}
              >
                {t.name}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
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
