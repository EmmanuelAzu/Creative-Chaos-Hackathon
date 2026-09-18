"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { rememberVoter } from "@/components/VoterPicker";

export default function CommitteeRegister() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !portfolio.trim()) {
      setError("Enter your name and your portfolio/company.");
      return;
    }
    if (!accessKey.trim()) {
      setError("Enter the committee access key.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/register/committee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        portfolio: portfolio.trim(),
        accessKey: accessKey.trim(),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    rememberVoter(data.id);
    router.push(`/final/vote`);
  }

  return (
    <PageShell eyebrow="COMMITTEE">
      <div className="max-w-md">
        <h1 className="text-3xl tracking-tight mb-2">Committee &amp; company rep registration</h1>
        <p className="text-ink/60 mb-8">
          For organizing committee members and sponsor/company representatives.
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
            <span className="text-sm font-mono text-ink/60">Portfolio/Company</span>
            <input
              className="reg-input"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              placeholder="Logistics & Ops, or your company name"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-mono text-ink/60">Committee access key</span>
            <input
              type="password"
              className="reg-input"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Given to you by the organizers"
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
    </PageShell>
  );
}
