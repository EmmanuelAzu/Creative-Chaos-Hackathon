"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Round1TeamScore, FinalTeamScore, Settings, Criteria } from "@/lib/types";

export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [round1, setRound1] = useState<Round1TeamScore[]>([]);
  const [finalScores, setFinalScores] = useState<FinalTeamScore[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [csvText, setCsvText] = useState("");
  const [criteriaName, setCriteriaName] = useState("");
  const [criteriaCategory, setCriteriaCategory] = useState("");
  const [criteriaPrompt, setCriteriaPrompt] = useState("");
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
    const { data: crit } = await supabase
      .from("criteria")
      .select("*")
      .order("stage")
      .order("sort_order");
    setCriteria((crit as Criteria[]) ?? []);
  }

  function unlock() {
    sessionStorage.setItem("admin_key", key);
    setUnlocked(true);
  }

  async function call(path: string, body: any = {}, method = "POST") {
    setMessage("");
    const res = await fetch(path, {
      method,
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

  const judgedTeams = round1.filter((r) => r.judges_scored > 0).length;
  const totalTeams = round1.length;
  const unlockThreshold = Math.ceil(totalTeams / 2);
  const boardUnlocked = totalTeams > 0 && judgedTeams >= unlockThreshold;

  const round1Criteria = criteria.filter((c) => c.stage === "round1");
  const finalCriteria = criteria.filter((c) => c.stage === "final");
  const round1Total = round1Criteria.reduce((s, c) => s + c.max_score, 0);

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
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex gap-2">
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
            <div className="flex gap-2">
              <input
                className="border border-line bg-white px-2 py-2 text-sm flex-1"
                placeholder="Category (optional, e.g. Technical Implementation)"
                value={criteriaCategory}
                onChange={(e) => setCriteriaCategory(e.target.value)}
              />
            </div>
            <input
              className="border border-line bg-white px-2 py-2 text-sm"
              placeholder="Prompt to ask the team (optional)"
              value={criteriaPrompt}
              onChange={(e) => setCriteriaPrompt(e.target.value)}
            />
          </div>
          <ActionButton
            onClick={() =>
              call("/api/admin/criteria", {
                stage: criteriaStage,
                name: criteriaName,
                category: criteriaCategory || null,
                prompt: criteriaPrompt || null,
                max_score: criteriaMax,
                sort_order: criteria.filter((c) => c.stage === criteriaStage).length + 1,
              }).then(() => {
                setCriteriaName("");
                setCriteriaCategory("");
                setCriteriaPrompt("");
              })
            }
          >
            Add criterion
          </ActionButton>

          <div className="mt-4 flex flex-col gap-1 text-sm max-h-48 overflow-y-auto">
            <p className="font-mono text-[10px] text-ink/40 tracking-widest">
              ROUND 1 · {round1Total} PTS TOTAL
            </p>
            {round1Criteria.map((c) => (
              <CriterionRow key={c.id} c={c} onDelete={() => call("/api/admin/criteria", { id: c.id }, "DELETE")} />
            ))}
            {finalCriteria.length > 0 && (
              <>
                <p className="font-mono text-[10px] text-ink/40 tracking-widest mt-3">FINAL</p>
                {finalCriteria.map((c) => (
                  <CriterionRow key={c.id} c={c} onDelete={() => call("/api/admin/criteria", { id: c.id }, "DELETE")} />
                ))}
              </>
            )}
          </div>
        </Section>

        <Section title="Round 1 leaderboard">
          <p className="text-sm text-ink/60 mb-3">
            {judgedTeams}/{totalTeams || "—"} teams judged — the public board
            {boardUnlocked ? " is unlocked (blurred until you reveal)" : ` unlocks at ${unlockThreshold}`}.
          </p>
          <ScoreTable
            rows={round1.map((r) => ({
              name: r.team_name,
              score: r.aggregate_score,
              detail: `${r.judges_scored} judge${r.judges_scored === 1 ? "" : "s"} scored`,
            }))}
          />
        </Section>

        <Section title="Round 1 reveal">
          <p className="text-sm text-ink/60 mb-3">
            Reveals the top 10 on <code>/leaderboard</code>, one place at a
            time, starting from 10th. Freezes standings on the first click so
            late scores can't reorder mid-ceremony.
          </p>
          <div className="flex gap-2">
            <ActionButton onClick={() => call("/api/admin/reveal", { action: "next", stage: "round1" })}>
              Reveal next place
            </ActionButton>
            <ActionButton
              variant="outline"
              onClick={() => call("/api/admin/reveal", { action: "reset", stage: "round1" })}
            >
              Reset reveal
            </ActionButton>
          </div>
          <p className="font-mono text-xs text-ink/50 mt-2">
            Current step: {settings?.round1_reveal_step ?? 0} / 10 — open{" "}
            <code>/leaderboard</code> on the big screen.
          </p>
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
            <ActionButton onClick={() => call("/api/admin/reveal", { action: "next", stage: "final" })}>
              Reveal next place
            </ActionButton>
            <ActionButton variant="outline" onClick={() => call("/api/admin/reveal", { action: "reset", stage: "final" })}>
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

function CriterionRow({ c, onDelete }: { c: Criteria; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-1 text-ink/80">
      <span>
        {c.category && <span className="text-ink/40 mr-1">{c.category} ·</span>}
        {c.name}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-teal">{c.max_score}</span>
        <button onClick={onDelete} className="text-ink/30 hover:text-red-700 text-xs focus-ring">
          remove
        </button>
      </span>
    </div>
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
