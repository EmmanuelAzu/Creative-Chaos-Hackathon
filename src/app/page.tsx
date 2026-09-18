"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { SponsorStrip } from "@/components/SponsorStrip";
import { ThemeToggle } from "@/components/ThemeToggle";

const roles = [
  {
    href: "/register/participant",
    label: "Participant",
    detail: "Register your name and team.",
    hint: "01",
  },
  {
    href: "/register/judge",
    label: "Judge",
    detail: "Register, then head to your judging panel.",
    hint: "02",
  },
  {
    href: "/register/committee",
    label: "Committee / Company Rep",
    detail: "Register your name and portfolio or company.",
    hint: "03",
  },
];

export default function Home() {
  return (
    <div className="theme-scope min-h-screen flex flex-col px-6 md:px-10 bg-paper text-ink">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-medium tracking-tight">Creative Chaos</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/leaderboard"
            className="text-sm font-mono text-teal hover:text-teal-deep transition-colors focus-ring"
          >
            Leaderboard →
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 grid md:grid-cols-2 gap-12 items-center py-10 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-md"
        >
          <div className="flex items-center gap-4 mb-8">
            <Logo size={64} />
            <div className="h-12 w-px bg-line" />
            <span className="font-mono text-xs text-ink/60 leading-tight">
              LIVE EVENT
              <br />
              REGISTRATION
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl leading-[1.05] tracking-tight text-ink mb-5">
            Everyone at the event, tracked in one place.
          </h1>
          <p className="text-ink/70 text-lg leading-relaxed">
            Register below to get checked in. Judges are routed straight to
            their grading panel; teams get a QR code for scanning on the day.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-col gap-4"
        >
          {roles.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="group border border-line hover:border-teal bg-surface/40 px-6 py-5 flex items-center justify-between transition-colors focus-ring"
            >
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-teal">{r.hint}</span>
                  <span className="text-xl text-ink">{r.label}</span>
                </div>
                <p className="text-sm text-ink/60 mt-1">{r.detail}</p>
              </div>
              <span className="text-teal opacity-0 group-hover:opacity-100 transition-opacity text-lg">
                ↗
              </span>
            </Link>
          ))}
        </motion.div>
      </main>

      <footer className="py-8 border-t border-line flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <SponsorStrip />
        <Link
          href="/certificate"
          className="text-sm font-mono text-teal hover:text-teal-deep transition-colors focus-ring"
        >
          Find my certificate →
        </Link>
      </footer>
    </div>
  );
}
