"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import type { Person } from "@/lib/types";

export default function CertificateFinder() {
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(null);

  async function runSearch(q: string) {
    setSearch(q);
    setPicked(null);
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
    <PageShell eyebrow="CERTIFICATE">
      <div className="max-w-sm">
        <h1 className="text-3xl tracking-tight mb-2">Find your certificate</h1>
        <p className="text-ink/60 mb-6">
          Search the name you registered with.
        </p>
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
              onClick={() => setPicked(m)}
              className="text-left py-3 hover:bg-white/60 transition-colors focus-ring"
            >
              {m.full_name}{" "}
              <span className="font-mono text-xs text-ink/40 ml-2">{m.role}</span>
            </button>
          ))}
        </div>

        {picked && (
          <a
            href={`/api/certificate/${picked.id}`}
            className="mt-6 block text-center bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors focus-ring"
          >
            Download certificate for {picked.full_name}
          </a>
        )}
      </div>
    </PageShell>
  );
}
