"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { ScanTeamButton } from "@/components/ScanTeamButton";
import { usePanelSync } from "@/lib/panelSync";
import type { Criteria } from "@/lib/types";

interface TeamOption {
  id: string;
  name: string;
}

export default function ScoreTeam({
  params,
}: {
  params: { id: string; teamId: string };
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamName, setTeamName] = useState("");
  const [panelNumber, setPanelNumber] = useState<number | null>(null);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { broadcastGoto } = usePanelSync(panelNumber, params.id, (teamId) => {
    router.push(`/judge/${params.id}/score/${teamId}`);
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.teamId]);

  async function load() {
    setSaved(false);
    setError(null);

    const { data: judge } = await supabase
      .from("people")
      .select("panel_number")
      .eq("id", params.id)
      .maybeSingle();
    setPanelNumber(judge?.panel_number ?? null);

    const { data: allTeams } = await supabase.from("teams").select("id, name").order("name");
    setTeams((allTeams as TeamOption[]) ?? []);

    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", params.teamId)
      .maybeSingle();
    setTeamName(team?.name ?? "");

    const { data: crit } = await supabase
      .from("criteria")
      .select("*")
      .eq("stage", "round1")
      .order("sort_order");
    setCriteria(crit ?? []);

    const { data: existing } = await supabase
      .from("scores")
      .select("criteria_id, value")
      .eq("judge_id", params.id)
      .eq("team_id", params.teamId);
    const initial: Record<string, number> = {};
    for (const s of existing ?? []) initial[s.criteria_id] = Number(s.value);
    setValues(initial);
  }

  function switchTeam(teamId: string) {
    broadcastGoto(teamId);
    router.push(`/judge/${params.id}/score/${teamId}`);
  }

  const grouped = new Map<string, Criteria[]>();
  for (const c of criteria) {
    const key = c.category ?? "Other";
    grouped.set(key, [...(grouped.get(key) ?? []), c]);
  }
  const total = criteria.reduce((s, c) => s + (values[c.id] ?? 0), 0);
  const totalMax = criteria.reduce((s, c) => s + c.max_score, 0);

  async function handleSave() {
    setError(null);
    const rows = criteria.map((c) => ({
      judge_id: params.id,
      team_id: params.teamId,
      criteria_id: c.id,
      value: values[c.id] ?? 0,
    }));
    const { error: err } = await supabase
      .from("scores")
      .upsert(rows, { onConflict: "judge_id,team_id,criteria_id" });
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
  }

  return (
    <PageShell eyebrow="GRADING">
      <div className="max-w-lg">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div>
            <p className="font-mono text-xs text-teal mb-1">NOW GRADING</p>
            <h1 className="text-3xl tracking-tight">{teamName || "—"}</h1>
          </div>
          <select
            className="border border-line bg-surface px-3 py-2 text-sm focus-ring"
            value={params.teamId}
            onChange={(e) => switchTeam(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <ScanTeamButton onScan={switchTeam} label="Scan a different team's QR" className="mb-8" />

        <div className="flex flex-col gap-8">
          {Array.from(grouped.entries()).map(([category, items]) => {
            const subtotal = items.reduce((s, c) => s + (values[c.id] ?? 0), 0);
            const subtotalMax = items.reduce((s, c) => s + c.max_score, 0);
            return (
              <div key={category}>
                <div className="flex items-baseline justify-between mb-3 border-b border-line pb-1">
                  <h2 className="font-mono text-xs text-teal">{category.toUpperCase()}</h2>
                  <span className="font-mono text-xs text-ink/50">
                    {subtotal} / {subtotalMax}
                  </span>
                </div>
                <div className="flex flex-col gap-5">
                  {items.map((c) => (
                    <div key={c.id}>
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="text-ink">{c.name}</label>
                        <span className="font-mono text-sm text-teal">
                          {values[c.id] ?? 0} / {c.max_score}
                        </span>
                      </div>
                      {c.prompt && (
                        <p className="text-ink/50 text-xs mb-2">Ask: "{c.prompt}"</p>
                      )}
                      <input
                        type="range"
                        min={0}
                        max={c.max_score}
                        step={2}
                        value={values[c.id] ?? 0}
                        onChange={(e) => {
                          setValues((v) => ({ ...v, [c.id]: Number(e.target.value) }));
                          setSaved(false);
                        }}
                        className="w-full accent-teal"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {criteria.length === 0 && (
            <p className="text-ink/50 font-mono text-sm">
              No round 1 criteria set up yet — add them from the admin panel.
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
          {saved ? "Saved ✓" : "Save scores"}
        </button>
      </div>
    </PageShell>
  );
}
