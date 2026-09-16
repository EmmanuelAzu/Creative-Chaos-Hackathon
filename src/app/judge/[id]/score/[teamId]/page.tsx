"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Criteria } from "@/lib/types";

interface AssignedTeam {
  team_id: string;
  team_name: string;
}

export default function ScoreTeam({
  params,
}: {
  params: { id: string; teamId: string };
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<AssignedTeam[]>([]);
  const [teamName, setTeamName] = useState("");
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.teamId]);

  async function load() {
    setSaved(false);
    setError(null);

    const { data: assignments } = await supabase
      .from("judge_assignments")
      .select("team_id, teams(name)")
      .eq("judge_id", params.id);
    setTeams(
      (assignments ?? []).map((a: any) => ({
        team_id: a.team_id,
        team_name: a.teams?.name ?? "Unknown team",
      }))
    );

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
    router.push(`/judge/${params.id}/score/${teamId}`);
  }

  async function startScan() {
    setScanning(true);
    setError(null);
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setError("Camera scanning isn't supported on this device — use the dropdown instead.");
      setScanning(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-expect-error - global BarcodeDetector
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const interval = setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            clearInterval(interval);
            stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
            setScanning(false);
            const raw = codes[0].rawValue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.teamId) switchTeam(parsed.teamId);
            } catch {
              setError("Unrecognized QR code.");
            }
          }
        } catch {
          /* keep trying */
        }
      }, 400);
    } catch {
      setError("Couldn't access the camera — use the dropdown instead.");
      setScanning(false);
    }
  }

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
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs text-teal mb-1">NOW GRADING</p>
            <h1 className="text-3xl tracking-tight">{teamName || "—"}</h1>
          </div>
          <div className="flex gap-2">
            <select
              className="border border-line bg-white px-3 py-2 text-sm focus-ring"
              value={params.teamId}
              onChange={(e) => switchTeam(e.target.value)}
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name}
                </option>
              ))}
            </select>
            <button
              onClick={startScan}
              className="border border-teal text-teal px-3 py-2 text-sm hover:bg-teal hover:text-paper transition-colors focus-ring"
            >
              Scan QR
            </button>
          </div>
        </div>

        {scanning && (
          <video ref={videoRef} className="w-full mb-6 border border-line" muted playsInline />
        )}

        <div className="flex flex-col gap-6">
          {criteria.map((c) => (
            <div key={c.id}>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-ink">{c.name}</label>
                <span className="font-mono text-sm text-teal">
                  {values[c.id] ?? 0} / {c.max_score}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={c.max_score}
                step={1}
                value={values[c.id] ?? 0}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [c.id]: Number(e.target.value) }))
                }
                className="w-full accent-teal"
              />
            </div>
          ))}
          {criteria.length === 0 && (
            <p className="text-ink/50 font-mono text-sm">
              No round 1 criteria set up yet — add them from the admin panel.
            </p>
          )}
        </div>

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
