"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Round1TeamScore, FinalTeamScore, Settings } from "@/lib/types";

export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [round1, setRound1] = useState<Round1TeamScore[]>([]);
  const [finalScores, setFinalScores] = useState<FinalTeamScore[]>([]);
  const [csvText, setCsvText] = useState("");
  const [criteriaName, setCriteriaName] = useState("");
  const [criteriaMax, setCriteriaMax] = useState(10);
  const [criteriaStage, setCriteriaStage] = useState<"round1" | "final">("round1");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_key");
    if (saved) {
      setKey(saved);
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (unlocked) refresh();
  }, [unlocked]);

  async function refresh() {
    const { data: s } = await supabase.from("settings").select("*").single();
    setSettings(s as Settings);
    const { data: r1 } = await supabase
      .from("round1_team_scores")
      .select("*")
      .order("aggregate_score", { ascending: false, nullsFirst: false });
    setRound1((r1 as Round1TeamScore[]) ?? []);
    const { data: fs } = await supabase
      .from("final_team_scores")
      .select("*")
      .order("weighted_score", { ascending: false, nullsFirst: false });
    setFinalScores((fs as FinalTeamScore[]) ?? []);
  }

  function unlock() {
    sessionStorage.setItem("admin_key", key);
    setUnlocked(true);
  }

  async function call(path: string, body: any = {}) {
    setMessage("");
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return null;
    }
    setMessage("Done.");
    refresh();
    return data;
  }

  async function patchSettings(patch: Partial<Settings>) {
    setMessage("");
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }
    setSettings(data);
  }

  if (!unlocked) {
    return (
      <PageShell eyebrow="ADMIN">
        <div className="max-w-xs">
          <h1 className="text-2xl tracking-tight mb-4">Admin access</h1>
          <input
            type="password"
            className="border border-line bg-white px-3 py-2 w-full mb-3 focus-ring"
            placeholder="Dashboard key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
          />
          <button
            onClick={unlock}
            className="bg-ink text-paper px-4 py-2 w-full hover:bg-teal-deep transition-colors focus-ring"
          >
            Unlock
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="ADMIN">
      <h1 className="text-3xl tracking-tight mb-8">Event control</h1>
      {message && <p className="font-mono text-sm text-teal mb-6">{message}</p>}

      <div className="grid md:grid-cols-2 gap-10">
        <Section title="Import teams from CSV">
          <p className="text-sm text-ink/60 mb-3">One team name per line.</p>
          <textarea
            className="border border-line bg-white w-full h-28 p-2 text-sm mb-3 focus-ring"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"The Night Owls\nByte Me\nHackstreet Boys"}
          />
          <ActionButton
            onClick={() =>
              call("/api/admin/import-teams", {
                teamNames: csvText.split("\n"),
              })
            }
          >
            Import teams
          </ActionButton>
        </Section>

        <Section title="Judging criteria">
          <div className="flex gap-2 mb-3">
            <select
              className="border border-line bg-white px-2 py-2 text-sm"
              value={criteriaStage}
              onChange={(e) => setCriteriaStage(e.target.value as any)}
            >
              <option value="round1">Round 1</option>
              <option value="final">Final</option>
            </select>
            <input
              className="border border-line bg-white px-2 py-2 text-sm flex-1"
              placeholder="Criterion name"
              value={criteriaName}
              onChange={(e) => setCriteriaName(e.target.value)}
            />
            <input
              type="number"
              className="border border-line bg-white px-2 py-2 text-sm w-20"
              value={criteriaMax}
              onChange={(e) => setCriteriaMax(Number(e.target.value))}
            />
          </div>
          <ActionButton
            onClick={() =>
              call("/api/admin/criteria", {
                stage: criteriaStage,
                name: criteriaName,
                max_score: criteriaMax,
              })
            }
          >
            Add criterion
          </ActionButton>
        </Section>

        <Section title="Assign judges to teams">
          <p className="text-sm text-ink/60 mb-3">
            Distributes all registered judges evenly across all teams. Safe to
            re-run after late judge sign-ups.
          </p>
          <ActionButton onClick={() => call("/api/admin/assign-judges", { judgesPerTeam: 3 })}>
            Auto-assign (3 per team)
          </ActionButton>
        </Section>

        <Section title="Round 1 leaderboard">
          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              className="accent-teal"
              checked={settings?.leaderboard_public ?? false}
              onChange={(e) => patchSettings({ leaderboard_public: e.target.checked })}
            />
            Make leaderboard public now
          </label>
          <ScoreTable
            rows={round1.map((r) => ({
              name: r.team_name,
              score: r.aggregate_score,
              detail: `${r.judges_scored}/${r.judges_assigned} judges`,
            }))}
          />
        </Section>

        <Section title="Advance to final stage">
          <p className="text-sm text-ink/60 mb-3">
            Locks in the top 5 teams from round 1 scores and opens final voting
            to everyone.
          </p>
          <div className="flex gap-2">
            <ActionButton onClick={() => call("/api/admin/promote-top5")}>
              Promote top 5
            </ActionButton>
            <ActionButton
              variant="outline"
              onClick={() => patchSettings({ final_stage_open: !settings?.final_stage_open })}
            >
              {settings?.final_stage_open ? "Close final voting" : "Open final voting"}
            </ActionButton>
          </div>
        </Section>

        <Section title="Final scores & reveal">
          <ScoreTable
            rows={finalScores.map((r) => ({
              name: r.team_name,
              score: r.weighted_score,
              detail: `${r.vote_count} votes`,
            }))}
          />
          <div className="flex gap-2 mt-3">
            <ActionButton onClick={() => call("/api/admin/reveal", { action: "next" })}>
              Reveal next place
            </ActionButton>
            <ActionButton variant="outline" onClick={() => call("/api/admin/reveal", { action: "reset" })}>
              Reset reveal
            </ActionButton>
          </div>
          <p className="font-mono text-xs text-ink/50 mt-2">
            Current step: {settings?.reveal_step ?? 0} / 5 — open{" "}
            <code>/final/reveal</code> on the big screen.
          </p>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-line p-5 bg-white/40">
      <h2 className="font-mono text-xs text-teal mb-3">{title.toUpperCase()}</h2>
      {children}
    </div>
  );
}

function ActionButton({
  onClick,
  children,
  variant = "solid",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "solid" | "outline";
}) {
  return (
    <button
      onClick={onClick}
      className={
        variant === "solid"
          ? "bg-ink text-paper px-4 py-2 text-sm hover:bg-teal-deep transition-colors focus-ring"
          : "border border-ink px-4 py-2 text-sm hover:bg-ink hover:text-paper transition-colors focus-ring"
      }
    >
      {children}
    </button>
  );
}

function ScoreTable({
  rows,
}: {
  rows: { name: string; score: number | null; detail: string }[];
}) {
  return (
    <div className="flex flex-col divide-y divide-line text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <span>
            <span className="font-mono text-ink/40 mr-2">{i + 1}</span>
            {r.name}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-ink/50 text-xs">{r.detail}</span>
            <span className="font-mono text-teal">{r.score ?? "—"}</span>
          </span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-ink/50 py-2">No data yet.</p>}
    </div>
  );
}
