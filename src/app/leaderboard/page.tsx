"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";

interface FinalRankedTeam {
  id: string;
  name: string;
  final_rank: number;
}

export default function Leaderboard() {
  const [hidden, setHidden] = useState(false);
  const [topFive, setTopFive] = useState<FinalRankedTeam[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(!!sessionStorage.getItem("admin_key"));
    load();
    const channel = supabase
      .channel("leaderboard")
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
      .select("leaderboard_hidden")
      .single();
    setHidden(settings?.leaderboard_hidden ?? false);

    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, final_rank")
      .not("final_rank", "is", null)
      .order("final_rank");
    setTopFive((teams as FinalRankedTeam[]) ?? []);
  }

  return (
    <PageShell eyebrow="LEADERBOARD" themable={false}>
      <h1 className="text-3xl tracking-tight mb-8">Top 5</h1>

      {isAdmin && hidden && (
        <div className="max-w-xl mb-10 border border-teal/40 bg-teal/5 p-5">
          <p className="font-mono text-[10px] tracking-widest text-teal mb-3">
            ADMIN PREVIEW · HIDDEN FROM THE PUBLIC
          </p>
          <div className="flex flex-col divide-y divide-line text-sm">
            {topFive.map((t) => (
              <div key={t.id} className="flex items-center gap-4 py-2">
                <span className="font-mono text-ink/40 w-6">{t.final_rank}</span>
                {t.name}
              </div>
            ))}
            {topFive.length === 0 && <p className="text-ink/50 py-2">No final ranking set yet.</p>}
          </div>
        </div>
      )}

      {hidden ? (
        <p className="text-ink/60 font-mono text-sm">
          The leaderboard is currently hidden — check back shortly.
        </p>
      ) : topFive.length === 0 ? (
        <p className="text-ink/60 font-mono text-sm">Results coming soon.</p>
      ) : (
        <div className="max-w-xl">
          <div className="flex flex-col divide-y divide-line border-t border-b border-line">
            <AnimatePresence>
              {topFive.map((t) => (
                <RankRow key={t.id} team={t} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </PageShell>
  );
}

const PLACE_WORDS = ["", "1st", "2nd", "3rd", "4th", "5th"];

function RankRow({ team }: { team: FinalRankedTeam }) {
  const winner = team.final_rank === 1;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ layout: { type: "spring", stiffness: 300, damping: 30 }, default: { duration: 0.3 } }}
      className={`flex items-center gap-4 py-5 ${winner ? "px-2 -mx-2 bg-teal/10" : ""}`}
    >
      <span className={`font-mono w-14 shrink-0 ${winner ? "text-teal text-2xl" : "text-ink/40 text-lg"}`}>
        {PLACE_WORDS[team.final_rank] ?? team.final_rank}
      </span>
      <span className={`break-words ${winner ? "text-2xl" : "text-lg"}`}>{team.name}</span>
    </motion.div>
  );
}
