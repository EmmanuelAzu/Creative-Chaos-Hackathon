"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { useVoterIdentity, VoterPicker } from "@/components/VoterPicker";
import type { Criteria } from "@/lib/types";

const JUDGE_WEIGHT = 1.2;

export default function FinalVoteTeam({ params }: { params: { teamId: string } }) {
  const { voter, checked, setVoter } = useVoterIdentity();
  const [teamName, setTeamName] = useState("");
  const [isTop5, setIsTop5] = useState<boolean | null>(null);
  const [stageOpen, setStageOpen] = useState<boolean | null>(null);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.teamId, voter?.id]);

  async function load() {
    const { data: settings } = await supabase.from("settings").select("final_stage_open").single();
    setStageOpen(settings?.final_stage_open ?? false);

    const { data: team } = await supabase
      .from("teams")
      .select("name, is_top5")
      .eq("id", params.teamId)
      .maybeSingle();
    setTeamName(team?.name ?? "");
    setIsTop5(team?.is_top5 ?? false);

    const { data: crit } = await supabase
      .from("criteria")
      .select("*")
      .eq("stage", "final")
      .order("sort_order");
    setCriteria((crit as Criteria[]) ?? []);

    if (voter) {
      const { data: existing } = await supabase
        .from("final_votes")
        .select("criteria_id, value")
        .eq("voter_id", voter.id)
        .eq("team_id", params.teamId);
      const initial: Record<string, number> = {};
      for (const v of existing ?? []) initial[v.criteria_id] = Number(v.value);
      setValues(initial);
    }
  }

  async function handleSave() {
    if (!voter) return;
    setError(null);
    setSaved(false);
    const weight = voter.role === "judge" ? JUDGE_WEIGHT : 1;
    const rows = criteria.map((c) => ({
      voter_id: voter.id,
      team_id: params.teamId,
      criteria_id: c.id,
      value: values[c.id] ?? 0,
      weight,
    }));
    const { error: err } = await supabase
      .from("final_votes")
      .upsert(rows, { onConflict: "voter_id,team_id,criteria_id" });
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
  }

  if (stageOpen === false) {
    return (
      <PageShell eyebrow="FINAL VOTE">
        <p className="text-ink/60 font-mono text-sm max-w-md">
          Final voting hasn't opened yet — it starts once the top 5 teams have
          presented. Keep this page open.
        </p>
      </PageShell>
    );
  }

  if (isTop5 === false) {
    return (
      <PageShell eyebrow="FINAL VOTE">
        <p className="text-ink/60 font-mono text-sm max-w-md">
          This team isn't in the final top 5.
        </p>
      </PageShell>
    );
  }

  if (!checked) return null;

  if (!voter) {
    return (
      <PageShell eyebrow="FINAL VOTE">
        <VoterPicker onPick={setVoter} />
      </PageShell>
    );
  }

  const total = criteria.reduce((s, c) => s + (values[c.id] ?? 0), 0);
  const totalMax = criteria.reduce((s, c) => s + c.max_score, 0);

  return (
    <PageShell eyebrow={`VOTING AS ${voter.full_name.toUpperCase()}`}>
      <div className="max-w-lg">
        <p className="font-mono text-xs text-teal mb-1">SCORING</p>
        <h1 className="text-3xl tracking-tight mb-8">{teamName || "—"}</h1>

        <div className="flex flex-col gap-6">
          {criteria.map((c) => (
            <div key={c.id}>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-ink">{c.name}</label>
                <span className="font-mono text-sm text-teal">
                  {values[c.id] ?? 0} / {c.max_score}
                </span>
              </div>
              {c.prompt && <p className="text-ink/50 text-xs mb-2">{c.prompt}</p>}
              <input
                type="range"
                min={0}
                max={c.max_score}
                step={1}
                value={values[c.id] ?? 0}
                onChange={(e) => setValues((v) => ({ ...v, [c.id]: Number(e.target.value) }))}
                className="w-full accent-teal"
              />
            </div>
          ))}
          {criteria.length === 0 && (
            <p className="text-ink/50 font-mono text-sm">
              No final criteria set up yet — add them from the admin panel.
            </p>
          )}
        </div>

        {criteria.length > 0 && (
          <div className="flex items-baseline justify-between mt-6 pt-4 border-t border-line">
            <span className="font-mono text-xs text-ink/50">TOTAL</span>
            <span className="font-mono text-lg text-teal">
              {total} / {totalMax}
            </span>
          </div>
        )}

        {error && <p className="text-sm text-red-700 mt-4">{error}</p>}

        <button
          onClick={handleSave}
          className="mt-8 w-full bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors focus-ring"
        >
          {saved ? "Saved ✓" : "Submit score"}
        </button>

        <Link
          href="/final/vote"
          className="block text-center font-mono text-xs text-teal hover:text-teal-deep mt-6 focus-ring"
        >
          ← score another top-5 team
        </Link>
      </div>
    </PageShell>
  );
}
