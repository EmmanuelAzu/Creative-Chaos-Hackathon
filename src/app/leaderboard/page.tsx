"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Round1TeamScore } from "@/lib/types";

export default function Leaderboard() {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Round1TeamScore[]>([]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function load() {
    const { data: settings } = await supabase
      .from("settings")
      .select("leaderboard_public")
      .single();
    setVisible(settings?.leaderboard_public ?? false);
    if (settings?.leaderboard_public) {
      const { data } = await supabase
        .from("round1_team_scores")
        .select("*")
        .order("aggregate_score", { ascending: false, nullsFirst: false });
      setRows((data as Round1TeamScore[]) ?? []);
    }
  }

  return (
    <PageShell eyebrow="LEADERBOARD">
      <h1 className="text-3xl tracking-tight mb-8">Round 1 leaderboard</h1>

      {visible === false && (
        <p className="text-ink/60 font-mono text-sm">
          Scores are still being finalized — check back once judging wraps up.
        </p>
      )}

      {visible && (
        <div className="flex flex-col divide-y divide-line border-t border-b border-line max-w-xl">
          {rows.map((r, i) => (
            <motion.div
              key={r.team_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between py-4"
            >
              <span className="flex items-center gap-4">
                <span className="font-mono text-ink/40 w-6">{i + 1}</span>
                <span className="text-lg">{r.team_name}</span>
              </span>
              <span className="font-mono text-teal text-lg">
                {r.aggregate_score ?? "—"}
              </span>
            </motion.div>
          ))}
          {rows.length === 0 && (
            <p className="py-8 text-ink/50 font-mono text-sm">No scores yet.</p>
          )}
        </div>
      )}
    </PageShell>
  );
}
