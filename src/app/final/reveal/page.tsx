"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { SponsorStrip } from "@/components/SponsorStrip";

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

export default function Reveal() {
  const [step, setStep] = useState(0);
  const [teams, setTeams] = useState<RevealTeam[]>([]);

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

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-8 left-8 flex items-center gap-3 opacity-70">
        <Logo size={32} />
        <span className="font-mono text-xs tracking-widest">CREATIVE CHAOS</span>
      </div>

      {step === 0 && (
        <p className="font-mono text-sm text-paper/50">Waiting for results…</p>
      )}

      <div className="flex flex-col gap-5 w-full max-w-xl">
        <AnimatePresence>
          {revealedRanks.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: t.final_rank === 1 ? 1.08 : 1 }}
              transition={{ type: "spring", stiffness: 140, damping: 16 }}
              className={`flex items-center justify-between border px-6 py-5 ${
                t.final_rank === 1
                  ? "border-volt bg-volt/10"
                  : "border-paper/20"
              }`}
            >
              <span className="font-mono text-xs tracking-widest text-teal-light">
                {ORDINALS[t.final_rank]?.toUpperCase()}
              </span>
              <span
                className={`text-2xl md:text-3xl tracking-tight ${
                  t.final_rank === 1 ? "text-volt" : "text-paper"
                }`}
              >
                {t.name}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-8">
        <SponsorStrip dark />
      </div>
    </div>
  );
}
