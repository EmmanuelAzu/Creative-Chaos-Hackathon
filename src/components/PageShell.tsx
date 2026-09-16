import Link from "next/link";
import { Logo } from "./Logo";

export function PageShell({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-medium tracking-tight text-ink">Creative Chaos</span>
        </Link>
        {eyebrow && (
          <span className="text-sm font-mono text-teal">{eyebrow}</span>
        )}
      </header>
      <div className="circuit-rule mx-6 md:mx-10" />
      <main className="flex-1 px-6 md:px-10 py-10">{children}</main>
      <footer className="px-6 md:px-10 py-6 text-xs text-ink/50 font-mono">
        Creative Chaos Hackathon
      </footer>
    </div>
  );
}
