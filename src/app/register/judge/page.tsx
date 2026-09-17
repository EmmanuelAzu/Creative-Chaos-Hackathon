"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/PageShell";

export default function JudgeRegister() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [independent, setIndependent] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || (!independent && !company.trim())) {
      setError("Enter your name, and your company (or mark yourself independent).");
      return;
    }
    if (!accessKey.trim()) {
      setError("Enter the judge access key.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/register/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        company: company.trim(),
        isIndependent: independent,
        accessKey: accessKey.trim(),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push(`/judge/${data.id}`);
  }

  return (
    <PageShell eyebrow="JUDGE">
      <div className="max-w-md">
        <h1 className="text-3xl tracking-tight mb-2">Judge registration</h1>
        <p className="text-ink/60 mb-8">
          You'll be taken straight to your judging panel afterwards.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-mono text-ink/60">Your full name</span>
            <input
              className="reg-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Sipho Ndlovu"
              autoFocus
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={independent}
              onChange={(e) => setIndependent(e.target.checked)}
              className="accent-teal"
            />
            I'm judging independently (no company)
          </label>

          {!independent && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-mono text-ink/60">Company</span>
              <input
                className="reg-input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Ventures"
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-mono text-ink/60">Judge access key</span>
            <input
              type="password"
              className="reg-input"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Given to you by the committee"
            />
          </label>

          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-ink text-paper py-3 font-medium hover:bg-teal-deep transition-colors disabled:opacity-50 focus-ring"
          >
            {loading ? "Registering…" : "Register & continue to panel"}
          </button>
        </form>
      </div>
      <style>{`.reg-input{border:1px solid #D8E4DE;background:white;padding:.75rem 1rem;outline:none;} .reg-input:focus{border-color:#12736F;}`}</style>
    </PageShell>
  );
}
