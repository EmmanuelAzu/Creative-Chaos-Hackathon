"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { rememberMyTeam } from "@/lib/myTeam";

export default function ParticipantRegister() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !teamName.trim()) {
      setError("Enter your name and your team name.");
      return;
    }
    if (!accessKey.trim()) {
      setError("Enter the participant access key.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/register/participant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        teamName: teamName.trim(),
        accessKey: accessKey.trim(),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    rememberMyTeam(data.teamId);
    router.push(`/team/${data.teamId}`);
  }

  return (
    <PageShell eyebrow="PARTICIPANT">
      <div className="max-w-md">
        <h1 className="text-3xl tracking-tight mb-2">Check in</h1>
        <p className="text-ink/60 mb-8">
          Enter your name exactly as your team submitted it, and your team
          name — we'll match you against the confirmed roster.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Your full name">
            <input
              className="reg-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Dlamini"
              autoFocus
            />
          </Field>
          <Field label="Team name">
            <input
              className="reg-input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="The Night Owls"
            />
          </Field>
          <Field label="Access key">
            <input
              type="password"
              className="reg-input"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Given to you by the organizers"
            />
          </Field>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors disabled:opacity-50 focus-ring"
          >
            {loading ? "Checking in…" : "Check in"}
          </button>
        </form>
      </div>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-mono text-ink/60">{label}</span>
      {children}
    </label>
  );
}
