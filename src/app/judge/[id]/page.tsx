"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { ScanTeamButton } from "@/components/ScanTeamButton";
import { usePanelSync } from "@/lib/panelSync";
import type { Criteria } from "@/lib/types";

interface Row {
  team_id: string;
  team_name: string;
  criteria_done: number;
  criteria_total: number;
}

const BANDS = [
  { band: "Excellent", pct: "90–100%", meaning: "Best in the room; nothing meaningful missing" },
  { band: "Good", pct: "75–89%", meaning: "Solid and mostly complete, minor gaps" },
  { band: "Fair", pct: "60–74%", meaning: "Present but underdeveloped or partial" },
  { band: "Poor", pct: "Below 60%", meaning: "Missing, broken, or not attempted" },
];

export default function JudgeDashboard({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [stage, setStage] = useState<"brief" | "judge">("brief");
  const [judgeName, setJudgeName] = useState("");
  const [panelNumber, setPanelNumber] = useState<number | null>(null);
  const [panelMates, setPanelMates] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [graded, setGraded] = useState<Row[]>([]);
  const [pickTeam, setPickTeam] = useState("");
  const [loading, setLoading] = useState(true);

  const { broadcastGoto } = usePanelSync(panelNumber, params.id, (teamId) => {
    router.push(`/judge/${params.id}/score/${teamId}`);
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: judge } = await supabase
      .from("people")
      .select("full_name, panel_number")
      .eq("id", params.id)
      .maybeSingle();
    setJudgeName(judge?.full_name ?? "");
    setPanelNumber(judge?.panel_number ?? null);

    if (judge?.panel_number) {
      const { data: mates } = await supabase
        .from("people")
        .select("full_name")
        .eq("role", "judge")
        .eq("panel_number", judge.panel_number)
        .neq("id", params.id);
      setPanelMates((mates ?? []).map((m) => m.full_name));
    }

    const { data: crit } = await supabase
      .from("criteria")
      .select("*")
      .eq("stage", "round1")
      .order("sort_order");
    setCriteria((crit as Criteria[]) ?? []);

    const { data: allTeams } = await supabase.from("teams").select("id, name").order("name");
    setTeams(allTeams ?? []);
    if (allTeams?.length) setPickTeam(allTeams[0].id);

    const criteriaTotal = crit?.length ?? 0;
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
    broadcastGoto(teamId);
    router.push(`/judge/${params.id}/score/${teamId}`);
  }

  const grouped = new Map<string, Criteria[]>();
  for (const c of criteria) {
    const key = c.category ?? "Other";
    grouped.set(key, [...(grouped.get(key) ?? []), c]);
  }
  const total = criteria.reduce((s, c) => s + c.max_score, 0);

  if (stage === "brief") {
    return (
      <PageShell eyebrow={judgeName ? `JUDGE · ${judgeName.toUpperCase()}` : "JUDGE"}>
        <div className="max-w-2xl">
          <h1 className="text-3xl tracking-tight mb-2">Judging briefing</h1>
          {panelNumber && (
            <p className="font-mono text-xs text-teal mb-4">
              PANEL {panelNumber}
              {panelMates.length > 0 && ` · WITH ${panelMates.join(", ").toUpperCase()}`}
            </p>
          )}
          <p className="text-ink/60 mb-8">
            Teams get 5 minutes to pitch/demo, then 2–3 minutes for you to
            finalize scores. Judge for a finished, working solution — teams
            had a full week. Scan or pick a team and your whole panel jumps
            there with you.
          </p>

          {criteria.length === 0 ? (
            <p className="text-ink/50 font-mono text-sm mb-8">
              No round 1 criteria set up yet — check with the committee.
            </p>
          ) : (
            <div className="flex flex-col gap-6 mb-8">
              {Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category} className="border border-line p-4 bg-surface/40">
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-lg">{category}</h2>
                    <span className="font-mono text-xs text-teal">
                      {items.reduce((s, c) => s + c.max_score, 0)} pts
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-start justify-between gap-4 text-sm">
                        <div>
                          <span className="text-ink">{c.name}</span>
                          {c.prompt && (
                            <p className="text-ink/50 text-xs mt-0.5">Ask: "{c.prompt}"</p>
                          )}
                        </div>
                        <span className="font-mono text-ink/60 shrink-0">{c.max_score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="font-mono text-xs text-ink/50">TOTAL: {total} PTS</p>
            </div>
          )}

          <div className="border-t border-line pt-6 mb-8">
            <h2 className="font-mono text-xs text-teal mb-3">SCORING BANDS</h2>
            <div className="flex flex-col divide-y divide-line text-sm">
              {BANDS.map((b) => (
                <div key={b.band} className="flex items-center gap-4 py-2">
                  <span className="w-20 shrink-0">{b.band}</span>
                  <span className="font-mono text-xs text-ink/50 w-20 shrink-0">{b.pct}</span>
                  <span className="text-ink/70">{b.meaning}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStage("judge")}
            className="w-full bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors focus-ring"
          >
            Start judging
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow={judgeName ? `JUDGE · ${judgeName.toUpperCase()}` : "JUDGE"}>
      <div className="max-w-lg">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl tracking-tight">Grade a team</h1>
          <button
            onClick={() => setStage("brief")}
            className="font-mono text-xs text-teal hover:text-teal-deep focus-ring"
          >
            ← briefing
          </button>
        </div>
        <p className="text-ink/60 mb-6">
          Scan a team's QR code to pull up their grading form, or pick a team
          below if you don't have a camera handy.
        </p>

        <ScanTeamButton onScan={goToTeam} label="Scan a team's QR code" className="mb-6" />

        <div className="flex gap-2 mb-10">
          <select
            className="border border-line bg-surface px-3 py-2 text-sm flex-1 focus-ring"
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
                className="flex items-center justify-between py-4 hover:bg-surface/50 transition-colors px-2 -mx-2 focus-ring"
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
