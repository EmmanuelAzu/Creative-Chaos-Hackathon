import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function PageShell({
  children,
  eyebrow,
  themable = true,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  // Big-screen/ceremony pages (the reveal boards) keep one deliberate, fixed
  // look for everyone in the room — set false there to opt out of the toggle.
  themable?: boolean;
}) {
  return (
    <div className={`min-h-screen flex flex-col bg-paper text-ink ${themable ? "theme-scope" : ""}`}>
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-medium tracking-tight text-ink">Creative Chaos</span>
        </Link>
        <div className="flex items-center gap-4">
          {eyebrow && (
            <span className="text-sm font-mono text-teal">{eyebrow}</span>
          )}
          {themable && <ThemeToggle />}
        </div>
      </header>
      <div className="circuit-rule mx-6 md:mx-10" />
      <main className="flex-1 px-6 md:px-10 py-10">{children}</main>
      <footer className="px-6 md:px-10 py-6 text-xs text-ink/50 font-mono">
        Creative Chaos Hackathon
      </footer>
    </div>
  );
}
