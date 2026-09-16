"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";

export default function CommitteeRegister() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !portfolio.trim()) {
      setError("Enter your name and your portfolio.");
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("people")
      .insert({
        role: "committee",
        full_name: fullName.trim(),
        portfolio: portfolio.trim(),
      })
      .select("id")
      .single();
    setLoading(false);
    if (err || !data) {
      setError(err?.message ?? "Something went wrong.");
      return;
    }
    router.push(`/final/vote?voter=${data.id}`);
  }

  return (
    <PageShell eyebrow="COMMITTEE">
      <div className="max-w-md">
        <h1 className="text-3xl tracking-tight mb-2">Committee registration</h1>
        <p className="text-ink/60 mb-8">
          You'll be able to vote once the final stage opens.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-mono text-ink/60">Your full name</span>
            <input
              className="reg-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Thandiwe Mokoena"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-mono text-ink/60">Portfolio</span>
            <input
              className="reg-input"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              placeholder="Logistics & Ops"
            />
          </label>
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
