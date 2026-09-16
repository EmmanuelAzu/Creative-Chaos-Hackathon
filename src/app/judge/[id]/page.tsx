"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";

interface Row {
  team_id: string;
  team_name: string;
  criteria_done: number;
  criteria_total: number;
}

export default function JudgeDashboard({ params }: { params: { id: string } }) {
  const [judgeName, setJudgeName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: judge } = await supabase
      .from("people")
      .select("full_name")
      .eq("id", params.id)
      .maybeSingle();
    setJudgeName(judge?.full_name ?? "");

    const { data: assignments } = await supabase
      .from("judge_assignments")
      .select("team_id, teams(name)")
      .eq("judge_id", params.id);

    const { data: criteria } = await supabase
      .from("criteria")
      .select("id")
      .eq("stage", "round1");
    const criteriaTotal = criteria?.length ?? 0;

    const result: Row[] = [];
    for (const a of assignments ?? []) {
      const { data: scored } = await supabase
        .from("scores")
        .select("criteria_id")
        .eq("judge_id", params.id)
        .eq("team_id", a.team_id);
      // @ts-expect-error - joined shape from supabase-js
      const teamName = a.teams?.name ?? "Unknown team";
      result.push({
        team_id: a.team_id,
        team_name: teamName,
        criteria_done: scored?.length ?? 0,
        criteria_total: criteriaTotal,
      });
    }
    setRows(result);
    setLoading(false);
  }

  return (
    <PageShell eyebrow={judgeName ? `JUDGE · ${judgeName.toUpperCase()}` : "JUDGE"}>
      <h1 className="text-3xl tracking-tight mb-2">Your teams</h1>
      <p className="text-ink/60 mb-8">
        Tap a team to grade it, or scan a team's QR code from the grading screen.
      </p>

      {loading && <p className="text-ink/50 font-mono text-sm">Loading…</p>}

      <div className="flex flex-col divide-y divide-line border-t border-b border-line">
        {rows.map((r) => {
          const done = r.criteria_total > 0 && r.criteria_done >= r.criteria_total;
          return (
            <Link
              key={r.team_id}
              href={`/judge/${params.id}/score/${r.team_id}`}
              className="flex items-center justify-between py-4 hover:bg-white/50 transition-colors px-2 -mx-2 focus-ring"
            >
              <span className="text-lg">{r.team_name}</span>
              <span
                className={`font-mono text-xs px-2 py-1 border ${
                  done
                    ? "border-teal text-teal"
                    : "border-line text-ink/50"
                }`}
              >
                {done ? "GRADED" : `${r.criteria_done}/${r.criteria_total}`}
              </span>
            </Link>
          );
        })}
        {!loading && rows.length === 0 && (
          <p className="py-8 text-ink/50 font-mono text-sm">
            No teams assigned to you yet — check with the committee.
          </p>
        )}
      </div>
    </PageShell>
  );
}
