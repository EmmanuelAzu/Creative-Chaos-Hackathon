"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Team, Person } from "@/lib/types";

const JUDGE_WEIGHT = 1.2;

export default function FinalVote() {
  return (
    <Suspense fallback={null}>
      <FinalVoteInner />
    </Suspense>
  );
}

function FinalVoteInner() {
  const params = useSearchParams();
  const [voter, setVoter] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [stageOpen, setStageOpen] = useState<boolean | null>(null);
  const [savedTeam, setSavedTeam] = useState<string | null>(null);

  useEffect(() => {
    checkStage();
    const voterId = params.get("voter");
    if (voterId) loadVoter(voterId);
  }, []);

  async function checkStage() {
    const { data } = await supabase.from("settings").select("final_stage_open").single();
    setStageOpen(data?.final_stage_open ?? false);
    if (data?.final_stage_open) {
      const { data: t } = await supabase.from("teams").select("*").eq("is_top5", true);
      setTeams((t as Team[]) ?? []);
    }
  }

  async function loadVoter(id: string) {
    const { data } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
    if (data) setVoter(data as Person);
  }

  async function runSearch(q: string) {
    setSearch(q);
    if (q.trim().length < 2) {
      setMatches([]);
      return;
    }
    const { data } = await supabase
      .from("people")
      .select("*")
      .ilike("full_name", `%${q.trim()}%`)
      .limit(6);
    setMatches((data as Person[]) ?? []);
  }

  async function submitVote(teamId: string) {
    if (!voter) return;
    const weight = voter.role === "judge" ? JUDGE_WEIGHT : 1;
    const value = values[teamId] ?? 0;
    const { error } = await supabase
      .from("final_votes")
      .upsert(
        { voter_id: voter.id, team_id: teamId, value, weight },
        { onConflict: "voter_id,team_id" }
      );
    if (!error) setSavedTeam(teamId);
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

  if (!voter) {
    return (
      <PageShell eyebrow="FINAL VOTE">
        <div className="max-w-sm">
          <h1 className="text-3xl tracking-tight mb-2">Who's voting?</h1>
          <p className="text-ink/60 mb-6">Find your name to continue.</p>
          <input
            className="border border-line bg-white px-3 py-2 w-full mb-3 focus-ring"
            placeholder="Start typing your name…"
            value={search}
            onChange={(e) => runSearch(e.target.value)}
            autoFocus
          />
          <div className="flex flex-col divide-y divide-line border-t border-line">
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => setVoter(m)}
                className="text-left py-3 hover:bg-white/60 transition-colors focus-ring"
              >
                {m.full_name}{" "}
                <span className="font-mono text-xs text-ink/40 ml-2">{m.role}</span>
              </button>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow={`VOTING AS ${voter.full_name.toUpperCase()}`}>
      <h1 className="text-3xl tracking-tight mb-2">Score the top 5</h1>
      <p className="text-ink/60 mb-8 max-w-md">
        Rate each team after they present. You can change your score until
        voting closes.
      </p>
      <div className="flex flex-col gap-8 max-w-lg">
        {teams.map((t) => (
          <div key={t.id} className="border border-line p-5 bg-white/40">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-lg">{t.name}</span>
              <span className="font-mono text-teal">{values[t.id] ?? 0} / 10</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={values[t.id] ?? 0}
              onChange={(e) =>
                setValues((v) => ({ ...v, [t.id]: Number(e.target.value) }))
              }
              className="w-full accent-teal mb-3"
            />
            <button
              onClick={() => submitVote(t.id)}
              className="text-sm border border-teal text-teal px-3 py-1.5 hover:bg-teal hover:text-paper transition-colors focus-ring"
            >
              {savedTeam === t.id ? "Saved ✓" : "Submit score"}
            </button>
          </div>
        ))}
        {teams.length === 0 && (
          <p className="text-ink/50 font-mono text-sm">Top 5 not announced yet.</p>
        )}
      </div>
    </PageShell>
  );
}
