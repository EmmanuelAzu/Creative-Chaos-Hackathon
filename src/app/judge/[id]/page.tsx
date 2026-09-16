"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { ScanTeamButton } from "@/components/ScanTeamButton";

interface Row {
  team_id: string;
  team_name: string;
  criteria_done: number;
  criteria_total: number;
}

export default function JudgeDashboard({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [judgeName, setJudgeName] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [graded, setGraded] = useState<Row[]>([]);
  const [pickTeam, setPickTeam] = useState("");
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

    const { data: allTeams } = await supabase.from("teams").select("id, name").order("name");
    setTeams(allTeams ?? []);
    if (allTeams?.length) setPickTeam(allTeams[0].id);

    const { data: criteria } = await supabase
      .from("criteria")
      .select("id")
      .eq("stage", "round1");
    const criteriaTotal = criteria?.length ?? 0;

    const { data: myScores } = await supabase
      .from("scores")
      .select("team_id, criteria_id, teams(name)")
      .eq("judge_id", params.id);

    const byTeam = new Map<string, Row>();
    for (const s of myScores ?? []) {
      // @ts-expect-error - joined shape from supabase-js
      const teamName = s.teams?.name ?? "Unknown team";
      const row = byTeam.get(s.team_id) ?? {
        team_id: s.team_id,
        team_name: teamName,
        criteria_done: 0,
        criteria_total: criteriaTotal,
      };
      row.criteria_done += 1;
      byTeam.set(s.team_id, row);
    }
    setGraded(Array.from(byTeam.values()).sort((a, b) => a.team_name.localeCompare(b.team_name)));
    setLoading(false);
  }

  function goToTeam(teamId: string) {
    router.push(`/judge/${params.id}/score/${teamId}`);
  }

  return (
    <PageShell eyebrow={judgeName ? `JUDGE · ${judgeName.toUpperCase()}` : "JUDGE"}>
      <div className="max-w-lg">
        <h1 className="text-3xl tracking-tight mb-2">Grade a team</h1>
        <p className="text-ink/60 mb-6">
          Scan a team's QR code to pull up their grading form, or pick a team
          below if you don't have a camera handy.
        </p>

        <ScanTeamButton onScan={goToTeam} label="Scan a team's QR code" className="mb-6" />

        <div className="flex gap-2 mb-10">
          <select
            className="border border-line bg-white px-3 py-2 text-sm flex-1 focus-ring"
            value={pickTeam}
            onChange={(e) => setPickTeam(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => pickTeam && goToTeam(pickTeam)}
            disabled={!pickTeam}
            className="bg-ink text-paper px-4 py-2 text-sm hover:bg-teal-deep transition-colors focus-ring disabled:opacity-40"
          >
            Go
          </button>
        </div>

        <h2 className="font-mono text-xs text-teal mb-3">TEAMS YOU'VE GRADED</h2>
        <div className="flex flex-col divide-y divide-line border-t border-b border-line">
          {graded.map((r) => {
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
                    done ? "border-teal text-teal" : "border-line text-ink/50"
                  }`}
                >
                  {done ? "GRADED" : `${r.criteria_done}/${r.criteria_total}`}
                </span>
              </Link>
            );
          })}
          {!loading && graded.length === 0 && (
            <p className="py-8 text-ink/50 font-mono text-sm">
              Nothing graded yet — scan or pick a team above to get started.
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
