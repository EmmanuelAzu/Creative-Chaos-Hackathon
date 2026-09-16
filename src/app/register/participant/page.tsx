"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";

export default function ParticipantRegister() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !teamName.trim()) {
      setError("Enter your name and your team name.");
      return;
    }
    setLoading(true);

    // Find the team (imported from your CSV) or create it if it doesn't exist yet.
    let teamId: string;
    const { data: existing, error: findErr } = await supabase
      .from("teams")
      .select("id")
      .ilike("name", teamName.trim())
      .maybeSingle();

    if (findErr) {
      setError(findErr.message);
      setLoading(false);
      return;
    }

    if (existing) {
      teamId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("teams")
        .insert({ name: teamName.trim() })
        .select("id")
        .single();
      if (createErr || !created) {
        setError(createErr?.message ?? "Couldn't create the team.");
        setLoading(false);
        return;
      }
      teamId = created.id;
    }

    const { error: personErr } = await supabase.from("people").insert({
      role: "participant",
      full_name: fullName.trim(),
      team_id: teamId,
    });

    setLoading(false);
    if (personErr) {
      setError(personErr.message);
      return;
    }

    router.push(`/team/${teamId}`);
  }

  return (
    <PageShell eyebrow="PARTICIPANT">
      <div className="max-w-md">
        <h1 className="text-3xl tracking-tight mb-2">Register your team</h1>
        <p className="text-ink/60 mb-8">
          Same team name as your teammates — you'll all land on the same QR code.
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
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors disabled:opacity-50 focus-ring"
          >
            {loading ? "Registering…" : "Register"}
          </button>
        </form>
      </div>
      <style>{`.reg-input{border:1px solid #D8E4DE;background:white;padding:.75rem 1rem;outline:none;} .reg-input:focus{border-color:#12736F;}`}</style>
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
