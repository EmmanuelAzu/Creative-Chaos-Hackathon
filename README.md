# Creative Chaos — Hackathon Event System

Registration, QR check-in, judging, leaderboard, and a live final-reveal
ceremony, in one app. Next.js on Vercel, data on Supabase.

## What's inside

```
supabase/schema.sql        → run this once in Supabase to create everything
src/app/page.tsx           → landing / role picker
src/app/register/*         → participant, judge, committee sign-up
src/app/team/[id]          → a team's printable QR code
src/app/judge/[id]         → a judge's scan-a-team-to-grade-it dashboard
src/app/judge/[id]/score/  → the grading screen (dropdown + optional camera scan)
src/app/leaderboard        → public leaderboard (gated by an admin toggle)
src/app/final/vote         → shared QR page everyone scores the top 5 on
src/app/final/reveal       → big-screen ceremony, 5th → 1st
src/app/admin              → key-gated control room for the whole event
src/app/api/admin/*        → server-only actions (service role key)
```

## 1. Set up Supabase

1. Create a project at supabase.com.
2. Open the SQL editor, paste in `supabase/schema.sql`, run it. This creates
   every table, the two aggregation views, and locks down row-level security
   so the public (anon) key can only register people, submit scores, and cast
   votes — not touch settings.
3. From **Project Settings → API**, grab the project URL, the `anon` public
   key, and the `service_role` key (keep the service role key secret).

## 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase, server-only.
- `ADMIN_DASHBOARD_KEY` — any passphrase you choose. This is what unlocks
  `/admin` and every `/api/admin/*` action. Treat it like a password.
- `JUDGE_ACCESS_KEY`, `COMMITTEE_ACCESS_KEY`, `PARTICIPANT_ACCESS_KEY` —
  passphrases you choose and hand out to whoever should actually be able to
  check in at `/register/judge` / `/register/committee` / `/register/participant`.
  Checked server-side in `/api/register/*` — without the right key the
  request is rejected before it ever reaches the database. Participant
  check-in additionally requires the name + team to already exist in the
  database (from the imported roster) — there's no on-the-fly team/person
  creation any more, so import your confirmed teams and members before
  doors open.

Add the same seven variables in **Vercel → Project → Settings →
Environment Variables** before deploying.

## 3. Run locally

```
npm install
npm run dev
```

## 4. Deploy

Push this folder to a GitHub repo, then "Import Project" in Vercel and point
it at the repo. Vercel auto-detects Next.js — no build config needed, as
long as the seven env vars above are set.

## 5. Day-of run sheet

1. **Before doors open** — go to `/admin`, unlock with your key:
   - Paste your team-name CSV into "Import teams from CSV".
   - Round-1 criteria (the published Judging Rubric, 100 points across 4
     categories) and final-round criteria (the Top 5 Team Voting Criteria,
     100 points across 3 categories) are seeded automatically by
     `supabase/schema.sql` — add/remove more from "Judging criteria" if
     you need to adjust them.
2. **Check-in** — point participants to `/register/participant`. They enter
   their name, team name, and the participant access key; it's rejected
   unless both the team and their name already match the imported roster.
   Each team lands on `/team/[id]` with a QR code — get that on a phone or
   printed card at their table.
3. **Judging** — judges register at `/register/judge` and are automatically
   grouped into panels of at least 3 (fill up existing short panels first,
   only start a new one once every panel has 3+; run "Rebalance panels" in
   `/admin` once everyone's checked in to smooth out any leftover short
   panel). Each judge lands on a briefing page (the full rubric, pulled live
   from the database) with a "Start judging" button. There's no fixed
   judge-per-team assignment — a judge scans whichever team's QR code is in
   front of them (or picks the team from a dropdown if a camera isn't
   available) — but the moment one judge on a panel picks a team, the rest
   of their panel's screens jump there too, so a panel always grades
   together. Each sub-criterion gets a slider score. A team's score is the
   average of each judge's 0-100 total across however many judges end up
   scoring it.
4. **Leaderboard** — `/leaderboard` auto-unlocks into a blurred board once
   half the teams are judged, then stays blurred until you reveal it. If
   you've unlocked `/admin` in the same browser, `/leaderboard` also shows
   you a live, ungated standings panel the whole time — see exactly where
   things stand before anyone else can.
5. **Top 10 reveal** — in `/admin`, under "Round 1 reveal", click "Reveal
   next place" with `/leaderboard` up on the big screen — it reveals 10th
   through 1st, one at a time, highlighting the top 5 once they're up, with
   a flip-in animation and a drumroll beat before each name lands. "Reveal
   all now" skips straight to the full board if you don't want the
   place-by-place ceremony. "Reset scores" wipes every Round 1 score/rank if
   you need a do-over.
6. **Top 5 & finals** — click "Promote top 5", then "Open final voting".
   Each top-5 team's `/team/[id]` page grows a second QR code (a plain
   scannable URL, no app needed) straight to `/final/vote/[id]` — put that
   up at their table. Judge scores count at 1.2× weight (edit
   `JUDGE_WEIGHT` in `src/app/final/vote/[teamId]/page.tsx` to change
   that). Want everyone's phone to jump straight to a specific team's ballot
   in sync with their live pitch? Use "Push everyone here" next to that team
   in `/admin` — it skips anyone already on a top-5 team.
7. **The reveal** — put `/final/reveal` up on the big screen. Back in
   `/admin`, under "Final scores & reveal", click "Reveal next place" once
   per announcement: 5th, 4th, 3rd, runner-up, then winner, each with its
   own animated entrance ("Reveal all now" skips to the full podium,
   "Reset votes" wipes final-round votes/ranks for a do-over).
8. **Managing people** — the "People" section in `/admin` lists every
   participant, judge, and committee member with a "remove" button, in case
   someone registered by mistake or needs pulling from the app. Deleting a
   team from "Round 1 leaderboard" removes it and its whole roster.

## 6. Certificates

Every registered person can pull their own certificate as a PDF, generated
on the fly (no pre-rendering, no storage — it reflects live standings every
time it's opened):

- Everyone finds their certificate at `/certificates` by entering the full
  name (and team name, for participants) they registered with — checked
  against the database before the download link appears — or grabs it
  straight from their team's QR page (`/team/[id]`) once everyone's
  registered.
- The certificate's background/layout comes from a single template image
  (`public/certificate-bg.png`) — only the person's name and team name are
  drawn on top at request time, in the same font/size the previous design
  used. The name is colored by tier (gold/silver/bronze for a locked-in
  `final_rank` 1st–3rd, green for 4th–5th or a round-1 top-10 finish,
  otherwise the default accent) — but the "Certificate of Participation"
  headline itself is static, baked into the template, since it has no room
  for per-tier wording any more.
- Generation happens in `src/lib/certificate.ts` (layout/wording) and is
  served by `src/app/api/certificate/[personId]/route.ts`. It's built with
  `pdf-lib`, so nothing external to install — it runs fine on Vercel.

## Notes & things you may want to adjust

- QR scanning in the judging screen uses the browser's native
  `BarcodeDetector` API (Chrome/Edge/Android). It falls back to the
  dropdown automatically on browsers that don't support it (notably
  Safari/iOS) — the dropdown is the reliable path everywhere.
- The final-vote page identifies voters by searching the `people` table by
  name (everyone already registered earlier in the day), so there's no
  separate login system to manage.
- Sponsor logos are in `public/sponsors/` and appear on the landing page
  footer, the reveal ceremony screen, and every certificate. `bbd` came in
  twice (a `.avif` and a `.png`) — the `.png` was used since it's the format
  `pdf-lib` can embed directly; delete the `.avif` from your uploads, it's
  unused.
- The color palette (`tailwind.config.ts`) was pulled from your poster —
  deep navy `#12143D` with the neon-green `#B6FF3D` accent — instead of the
  plainer teal-only palette from the first draft, so the app now matches the
  poster/theme rather than just the logo.
- There's no fixed judge-*panel*-per-team assignment — any panel can grade
  any team, in any order. A team's `round1_team_scores.judges_scored` is
  just however many individual judges have scored it so far (across
  whichever panels got to it), and the aggregate is an average across
  whoever that ends up being.
- The "push everyone to this team's ballot" and judge-panel sync features
  use Supabase Realtime **broadcast** channels (not `postgres_changes`) —
  make sure Realtime is enabled on your Supabase project (it is by default).
