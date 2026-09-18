"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { useVoterIdentity, VoterPicker } from "@/components/VoterPicker";
import type { Criteria, Person } from "@/lib/types";

const JUDGE_WEIGHT = 1.2;

export default function FinalVoteTeam({ params }: { params: { teamId: string } }) {
  const router = useRouter();
  const { voter, checked, setVoter } = useVoterIdentity();
  const [teamName, setTeamName] = useState("");
  const [isTop5, setIsTop5] = useState<boolean | null>(null);
  const [stageOpen, setStageOpen] = useState<boolean | null>(null);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteDeadline, setVoteDeadline] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // The countdown effect below only re-runs when the deadline itself
  // changes, so its closure would otherwise see whatever values/voter/
  // criteria were current at that moment — not the latest slider drags —
  // if it tried to auto-submit on timeout. Refs keep it reading live data.
  const voterRef = useRef(voter);
  const criteriaRef = useRef(criteria);
  const valuesRef = useRef(values);
  useEffect(() => {
    voterRef.current = voter;
  }, [voter]);
  useEffect(() => {
    criteriaRef.current = criteria;
  }, [criteria]);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`final-vote-${params.teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, syncMeta)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, syncMeta)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.teamId, voter?.id]);

  // Ticks the synced countdown once a second and sends everyone back to
  // /final/vote to wait for the next push once time's up. Only active
  // while this specific team is the one admin pushed everyone to — a
  // walk-up voter who scanned the table QR on their own (no active push)
  // sees no timer at all.
  useEffect(() => {
    if (!voteDeadline) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((new Date(voteDeadline).getTime() - Date.now()) / 1000);
      setSecondsLeft(Math.max(remaining, 0));
      if (remaining <= 0) {
        // Auto-submit whatever was set before time ran out, so a voter who
        // was mid-drag when the clock hit zero doesn't just lose their
        // work — but only if they'd actually touched a slider; an
        // untouched ballot shouldn't get silently recorded as all zeros.
        if (voterRef.current && Object.keys(valuesRef.current).length > 0) {
          submitVotes(valuesRef.current, voterRef.current, criteriaRef.current);
        }
        router.push("/final/vote");
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [voteDeadline, router]);

  // Only re-syncs settings/team-status — never touches `values`, so it can't
  // stomp on an in-progress slider edit if it fires while someone's voting.
  async function syncMeta() {
    const { data: settings } = await supabase
      .from("settings")
      .select("final_stage_open, final_vote_team_id, final_vote_deadline")
      .single();
    setStageOpen(settings?.final_stage_open ?? false);

    // A deadline only counts as an active push if it hasn't already
    // passed — otherwise it's just left over from whichever team was
    // pushed last, and everyone should be free to vote at their own pace
    // (e.g. a walk-up voter scanning the table QR) with no timer at all.
    const pushActive =
      !!settings?.final_vote_deadline && new Date(settings.final_vote_deadline).getTime() > Date.now();

    // Admin has already moved on to a different team — follow them there
    // instead of waiting for this page's own (now stale) timer. Same as the
    // timeout case: auto-submit anything touched first, since this can fire
    // mid-vote if the admin advances early, not just once time is up.
    if (pushActive && settings!.final_vote_team_id && settings!.final_vote_team_id !== params.teamId) {
      if (voterRef.current && Object.keys(valuesRef.current).length > 0) {
        submitVotes(valuesRef.current, voterRef.current, criteriaRef.current);
      }
      router.push(`/final/vote/${settings!.final_vote_team_id}`);
      return;
    }
    setVoteDeadline(pushActive && settings?.final_vote_team_id === params.teamId ? settings.final_vote_deadline : null);

    const { data: team } = await supabase
      .from("teams")
      .select("name, is_top5")
      .eq("id", params.teamId)
      .maybeSingle();
    setTeamName(team?.name ?? "");
    setIsTop5(team?.is_top5 ?? false);
  }

  async function load() {
    await syncMeta();

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

  // Takes its inputs as params (rather than closing over state) so the
  // timeout auto-submit above can call it with fresh ref values without
  // needing its own stale copy of this function.
  async function submitVotes(
    vals: Record<string, number>,
    currentVoter: Person,
    currentCriteria: Criteria[]
  ): Promise<string | null> {
    if (currentCriteria.length === 0) return null;
    const weight = currentVoter.role === "judge" ? JUDGE_WEIGHT : 1;
    const rows = currentCriteria.map((c) => ({
      voter_id: currentVoter.id,
      team_id: params.teamId,
      criteria_id: c.id,
      value: vals[c.id] ?? 0,
      weight,
    }));
    const { error: err } = await supabase
      .from("final_votes")
      .upsert(rows, { onConflict: "voter_id,team_id,criteria_id" });
    return err?.message ?? null;
  }

  async function handleSave() {
    if (!voter) return;
    setError(null);
    setSaved(false);
    const errMsg = await submitVotes(values, voter, criteria);
    if (errMsg) {
      setError(errMsg);
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
        <div className="flex items-baseline justify-between mb-1">
          <p className="font-mono text-xs text-teal">SCORING</p>
          {secondsLeft !== null && (
            <p
              className={`font-mono text-xs ${
                secondsLeft <= 20 ? "text-red-700" : "text-ink/50"
              }`}
            >
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} left
            </p>
          )}
        </div>
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
