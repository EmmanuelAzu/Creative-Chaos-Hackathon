"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Round1TeamScore, FinalTeamScore, Settings, Criteria, Person } from "@/lib/types";

interface TeamRow {
  id: string;
  name: string;
}

export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [round1, setRound1] = useState<Round1TeamScore[]>([]);
  const [finalScores, setFinalScores] = useState<FinalTeamScore[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
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
    const { data: ppl } = await supabase
      .from("people")
      .select("*")
      .order("role")
      .order("full_name");
    setPeople((ppl as Person[]) ?? []);
    const { data: tms } = await supabase.from("teams").select("id, name").order("name");
    setTeams((tms as TeamRow[]) ?? []);
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

  function confirmCall(question: string, path: string, body: any = {}, method = "POST") {
    if (!window.confirm(question)) return;
    call(path, body, method);
  }

  async function pushEveryoneToTeam(teamId: string) {
    const excludeTeamIds = finalScores.map((r) => r.team_id);
    const channel = supabase.channel("audience-nav");
    await channel.send({
      type: "broadcast",
      event: "goto-vote",
      payload: { teamId, excludeTeamIds },
    });
    supabase.removeChannel(channel);
    setMessage("Pushed — every open browser (except top-5 teams) just jumped to that ballot.");
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

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const judges = people.filter((p) => p.role === "judge");
  const committee = people.filter((p) => p.role === "committee");
  const participants = people.filter((p) => p.role === "participant");
  const panels = new Map<number, Person[]>();
  for (const j of judges) {
    const panel = j.panel_number ?? 0;
    panels.set(panel, [...(panels.get(panel) ?? []), j]);
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

        <Section title="Judge panels">
          <p className="text-sm text-ink/60 mb-3">
            Judges are auto-grouped into panels of at least 3 as they
            register — when one scans a team's QR, the whole panel jumps
            there together. Rebalance once everyone's checked in to smooth
            out any leftover short panel.
          </p>
          <ActionButton onClick={() => call("/api/admin/rebalance-panels")}>Rebalance panels</ActionButton>
          <div className="mt-4 flex flex-col gap-2 text-sm max-h-48 overflow-y-auto">
            {Array.from(panels.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([panel, members]) => (
                <div key={panel} className="flex items-start gap-2">
                  <span className="font-mono text-xs text-teal shrink-0">
                    {panel === 0 ? "UNASSIGNED" : `PANEL ${panel}`}
                  </span>
                  <span className="text-ink/70">{members.map((m) => m.full_name).join(", ")}</span>
                </div>
              ))}
            {judges.length === 0 && <p className="text-ink/50">No judges registered yet.</p>}
          </div>
        </Section>

        <Section title="Round 1 leaderboard">
          <p className="text-sm text-ink/60 mb-3">
            {judgedTeams}/{totalTeams || "—"} teams judged — the public board
            {boardUnlocked ? " is unlocked (blurred until you reveal)" : ` unlocks at ${unlockThreshold}`}.
          </p>
          <ScoreTable
            rows={round1.map((r) => ({
              id: r.team_id,
              name: r.team_name,
              score: r.aggregate_score,
              detail: `${r.judges_scored} judge${r.judges_scored === 1 ? "" : "s"} scored`,
            }))}
            onDelete={(id, name) =>
              confirmCall(`Delete team "${name}" and its whole roster? This can't be undone.`, "/api/admin/teams", { id }, "DELETE")
            }
          />
        </Section>

        <Section title="Round 1 reveal">
          <p className="text-sm text-ink/60 mb-3">
            Reveals the top 10 on <code>/leaderboard</code>, one place at a
            time, starting from 10th. Freezes standings on the first click so
            late scores can't reorder mid-ceremony. "Reveal all" skips
            straight to the full board.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => call("/api/admin/reveal", { action: "next", stage: "round1" })}>
              Reveal next place
            </ActionButton>
            <ActionButton onClick={() => call("/api/admin/reveal", { action: "revealAll", stage: "round1" })}>
              Reveal all now
            </ActionButton>
            <ActionButton
              variant="outline"
              onClick={() => call("/api/admin/reveal", { action: "reset", stage: "round1" })}
            >
              Reset reveal
            </ActionButton>
            <ActionButton
              variant="outline"
              onClick={() =>
                confirmCall(
                  "Wipe every Round 1 score and rank? This can't be undone.",
                  "/api/admin/reset-scores",
                  { stage: "round1" }
                )
              }
            >
              Reset scores
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
              id: r.team_id,
              name: r.team_name,
              score: r.weighted_score,
              detail: `${r.vote_count} votes`,
            }))}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <ActionButton onClick={() => call("/api/admin/reveal", { action: "next", stage: "final" })}>
              Reveal next place
            </ActionButton>
            <ActionButton onClick={() => call("/api/admin/reveal", { action: "revealAll", stage: "final" })}>
              Reveal all now
            </ActionButton>
            <ActionButton variant="outline" onClick={() => call("/api/admin/reveal", { action: "reset", stage: "final" })}>
              Reset reveal
            </ActionButton>
            <ActionButton
              variant="outline"
              onClick={() =>
                confirmCall(
                  "Wipe every final-round vote and rank? This can't be undone.",
                  "/api/admin/reset-scores",
                  { stage: "final" }
                )
              }
            >
              Reset votes
            </ActionButton>
          </div>
          <p className="font-mono text-xs text-ink/50 mt-2">
            Current step: {settings?.reveal_step ?? 0} / 5 — open{" "}
            <code>/final/reveal</code> on the big screen.
          </p>

          {finalScores.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-sm text-ink/60 mb-2">
                Push every open browser straight to a team's ballot (skips
                anyone already identified as a top-5 team member):
              </p>
              <div className="flex flex-col gap-1">
                {finalScores.map((r) => (
                  <div key={r.team_id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{r.team_name}</span>
                    <button
                      onClick={() => pushEveryoneToTeam(r.team_id)}
                      className="font-mono text-xs text-teal border border-teal px-2 py-1 hover:bg-teal hover:text-paper transition-colors focus-ring"
                    >
                      Push everyone here
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="People">
          <p className="text-sm text-ink/60 mb-3">
            {participants.length} participants · {judges.length} judges ·{" "}
            {committee.length} committee.
          </p>
          <div className="flex flex-col gap-4 max-h-96 overflow-y-auto text-sm">
            <PeopleGroup
              label="PARTICIPANTS"
              rows={participants.map((p) => ({
                id: p.id,
                primary: p.full_name,
                secondary: p.team_id ? teamNameById.get(p.team_id) ?? "—" : "—",
              }))}
              onDelete={(id, primary) =>
                confirmCall(`Remove "${primary}" from the app?`, "/api/admin/people", { id }, "DELETE")
              }
            />
            <PeopleGroup
              label="JUDGES"
              rows={judges.map((p) => ({
                id: p.id,
                primary: p.full_name,
                secondary: p.is_independent ? "Independent" : p.company ?? "—",
              }))}
              onDelete={(id, primary) =>
                confirmCall(`Remove "${primary}" from the app?`, "/api/admin/people", { id }, "DELETE")
              }
            />
            <PeopleGroup
              label="COMMITTEE"
              rows={committee.map((p) => ({
                id: p.id,
                primary: p.full_name,
                secondary: p.portfolio ?? "—",
              }))}
              onDelete={(id, primary) =>
                confirmCall(`Remove "${primary}" from the app?`, "/api/admin/people", { id }, "DELETE")
              }
            />
          </div>
        </Section>
      </div>
    </PageShell>
  );
}

function PeopleGroup({
  label,
  rows,
  onDelete,
}: {
  label: string;
  rows: { id: string; primary: string; secondary: string }[];
  onDelete: (id: string, primary: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[10px] text-ink/40 tracking-widest mb-1">{label}</p>
      <div className="flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-1.5">
            <span>
              {r.primary} <span className="text-ink/40 text-xs ml-1">{r.secondary}</span>
            </span>
            <button onClick={() => onDelete(r.id, r.primary)} className="text-ink/30 hover:text-red-700 text-xs focus-ring">
              remove
            </button>
          </div>
        ))}
      </div>
    </div>
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
  onDelete,
}: {
  rows: { id: string; name: string; score: number | null; detail: string }[];
  onDelete?: (id: string, name: string) => void;
}) {
  return (
    <div className="flex flex-col divide-y divide-line text-sm">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center justify-between py-2">
          <span>
            <span className="font-mono text-ink/40 mr-2">{i + 1}</span>
            {r.name}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-ink/50 text-xs">{r.detail}</span>
            <span className="font-mono text-teal">{r.score ?? "—"}</span>
            {onDelete && (
              <button onClick={() => onDelete(r.id, r.name)} className="text-ink/30 hover:text-red-700 text-xs focus-ring">
                remove
              </button>
            )}
          </span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-ink/50 py-2">No data yet.</p>}
    </div>
  );
}
