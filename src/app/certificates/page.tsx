"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Person } from "@/lib/types";

export default function CertificateFinder() {
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [found, setFound] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFound(null);

    const name = fullName.trim();
    const team = teamName.trim();
    if (!name) {
      setError("Enter the full name you registered with.");
      return;
    }

    setLoading(true);
    try {
      if (team) {
        // Participants: name must match a person on the named team.
        const { data: teamRow } = await supabase
          .from("teams")
          .select("id, name")
          .ilike("name", team)
          .maybeSingle();
        if (!teamRow) {
          setError(`We don't have a team called "${team}" — check the spelling and try again.`);
          return;
        }
        const { data: person } = await supabase
          .from("people")
          .select("*")
          .ilike("full_name", name)
          .eq("team_id", teamRow.id)
          .maybeSingle();
        if (!person) {
          setError(
            `We don't have "${name}" on team "${teamRow.name}" — double-check the spelling exactly as you registered.`
          );
          return;
        }
        setFound(person as Person);
      } else {
        // No team given: only matches judges/committee (participants must supply a team).
        const { data: person } = await supabase
          .from("people")
          .select("*")
          .ilike("full_name", name)
          .is("team_id", null)
          .maybeSingle();
        if (!person) {
          setError(
            `No judge or committee member found with that name. Participants: enter your team name too.`
          );
          return;
        }
        setFound(person as Person);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell eyebrow="CERTIFICATE">
      <div className="max-w-sm">
        <h1 className="text-3xl tracking-tight mb-2">Find your certificate</h1>
        <p className="text-ink/60 mb-6">
          Enter the name (and team, if you're a participant) you registered with — we'll check it against
          our records before generating your certificate.
        </p>
        <form onSubmit={handleSearch} className="flex flex-col gap-3 mb-3">
          <input
            className="border border-line bg-surface px-3 py-2 w-full focus-ring"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setFound(null);
              setError(null);
            }}
            autoFocus
          />
          <input
            className="border border-line bg-surface px-3 py-2 w-full focus-ring"
            placeholder="Team name (participants only)"
            value={teamName}
            onChange={(e) => {
              setTeamName(e.target.value);
              setFound(null);
              setError(null);
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors focus-ring disabled:opacity-50"
          >
            {loading ? "Checking…" : "Find my certificate"}
          </button>
        </form>

        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}

        {found && (
          <a
            href={`/api/certificate/${found.id}`}
            className="mt-6 block text-center bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors focus-ring"
          >
            Download certificate for {found.full_name}
          </a>
        )}
      </div>
    </PageShell>
  );
}
