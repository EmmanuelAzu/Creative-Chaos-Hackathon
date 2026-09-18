import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { AudienceNavListener } from "@/components/AudienceNavListener";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Creative Chaos — Hackathon",
  description: "Live registration, judging and leaderboard for Creative Chaos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
      <head>
        {/* Applies the saved/preferred theme before first paint, so themed
            pages don't flash light before switching to dark on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              var t = localStorage.getItem("theme");
              var d = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
              if (d) document.documentElement.classList.add("dark");
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="bg-paper font-sans min-h-screen antialiased">
        <AudienceNavListener />
        {children}
      </body>
    </html>
  );
}
