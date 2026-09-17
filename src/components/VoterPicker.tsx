"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Person } from "@/lib/types";

const STORAGE_KEY = "final_voter_id";

/** Lets a registration flow that already knows the new person's id (e.g. a
 * freshly-registered judge or committee member) pre-fill the voter identity
 * cache, so they land on /final/vote already identified. */
export function rememberVoter(id: string) {
  sessionStorage.setItem(STORAGE_KEY, id);
}

/** Remembers the identified voter across page loads (e.g. scanning several
 * top-5 teams' QR codes in a row) so they only have to find their name once. */
export function useVoterIdentity() {
  const [voter, setVoterState] = useState<Person | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem(STORAGE_KEY);
    if (id) load(id);
    else setChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(id: string) {
    const { data } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
    if (data) setVoterState(data as Person);
    setChecked(true);
  }

  function setVoter(p: Person) {
    sessionStorage.setItem(STORAGE_KEY, p.id);
    setVoterState(p);
  }

  return { voter, checked, setVoter };
}

export function VoterPicker({ onPick }: { onPick: (p: Person) => void }) {
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);

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

  return (
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
            onClick={() => onPick(m)}
            className="text-left py-3 hover:bg-white/60 transition-colors focus-ring"
          >
            {m.full_name}{" "}
            <span className="font-mono text-xs text-ink/40 ml-2">{m.role}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
