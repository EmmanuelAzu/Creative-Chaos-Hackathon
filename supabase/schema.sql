-- ============================================================
-- Creative Chaos Hackathon — Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUM TYPES ----------
create type person_role as enum ('participant', 'judge', 'committee');
create type score_stage as enum ('round1', 'final');

-- ---------- TEAMS ----------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  qr_token uuid not null default gen_random_uuid(),   -- encoded into the team's printed QR code
  is_top5 boolean not null default false,
  round1_rank int,                                    -- frozen at the start of the round-1 reveal (1-10)
  final_rank int,                                     -- filled in only at the final reveal time (1-5)
  created_at timestamptz not null default now()
);

-- ---------- PEOPLE (participants / judges / committee, all in one table) ----------
create table people (
  id uuid primary key default gen_random_uuid(),
  role person_role not null,
  full_name text not null,
  -- participant-only
  team_id uuid references teams(id) on delete set null,
  -- judge-only
  company text,               -- null/blank + is_independent = true -> "Independent"
  is_independent boolean default false,
  -- committee-only
  portfolio text,
  created_at timestamptz not null default now()
);

create index on people (team_id);
create index on people (role);

-- ---------- CRITERIA (editable per stage from the admin panel) ----------
create table criteria (
  id uuid primary key default gen_random_uuid(),
  stage score_stage not null,
  name text not null,
  category text,               -- groups sub-criteria under a category on the scoring form
  prompt text,                 -- optional ready-made question for a judge to ask the team
  max_score int not null default 10,
  sort_order int not null default 0
);

-- ---------- ROUND 1 SCORES (per judge, per team, per criterion) ----------
create table scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references people(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  criteria_id uuid not null references criteria(id) on delete cascade,
  value numeric not null,
  created_at timestamptz not null default now(),
  unique (judge_id, team_id, criteria_id)
);

-- ---------- FINAL STAGE: everyone (judges + participants + committee) votes on the top 5 ----------
create table final_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references people(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  value numeric not null,        -- raw 1-10 score the voter gave
  weight numeric not null default 1,  -- 1 for participants/committee, e.g. 1.2 for judges
  created_at timestamptz not null default now(),
  unique (voter_id, team_id)
);

-- ---------- SINGLE-ROW ADMIN SETTINGS ----------
create table settings (
  id boolean primary key default true check (id),   -- enforces exactly one row
  round1_open boolean not null default true,
  final_stage_open boolean not null default false,
  round1_reveal_step int not null default 0,  -- 0 = blurred/hidden, 1..10 = that many places revealed, from 10th down to 1st
  reveal_step int not null default 0   -- 0 = nothing revealed, 1..5 = that many ranks revealed, starting from 5th
);
insert into settings (id) values (true);

-- ---------- ROUND 1 CRITERIA (the published Judging Rubric — 100 points) ----------
insert into criteria (stage, category, name, prompt, max_score, sort_order) values
  ('round1', 'Technical Implementation', 'Functionality & completeness', null, 12, 1),
  ('round1', 'Technical Implementation', 'Code quality & architecture', 'Why did you design the system to work this way?', 10, 2),
  ('round1', 'Technical Implementation', 'Technical depth & difficulty', 'Any third-party APIs or AI tools being used in your solution?', 8, 3),
  ('round1', 'Solution Impact Potential', 'Problem-solution fit', 'Why did you choose this problem, and how did you land on this solution?', 8, 4),
  ('round1', 'Solution Impact Potential', 'Real-world feasibility', 'What would it take to actually ship this?', 7, 5),
  ('round1', 'Solution Impact Potential', 'Scalability & market potential', 'How would this scale to more users or other markets?', 5, 6),
  ('round1', 'Solution Impact Potential', 'Originality & innovation', null, 5, 7),
  ('round1', 'Presentation & Demo', 'Live demo quality', null, 10, 8),
  ('round1', 'Presentation & Demo', 'Clarity of pitch & storytelling', null, 8, 9),
  ('round1', 'Presentation & Demo', 'Q&A handling', null, 4, 10),
  ('round1', 'Presentation & Demo', 'Visual & design polish', null, 3, 11),
  ('round1', 'Teamwork & Collaboration', 'Role distribution & contribution', null, 20, 12);

-- ============================================================
-- VIEWS for aggregation (recompute on read — fine at hackathon scale)
-- ============================================================

-- Round 1: each team's total score (sub-criteria summed, out of 100) per judge,
-- then averaged across judges. There's no fixed judge-per-team assignment —
-- judges score whichever teams they scan, so this simply reflects however
-- many have scored so far.
create view round1_team_scores as
select
  t.id as team_id,
  t.name as team_name,
  count(distinct s.judge_id) as judges_scored,
  round(avg(per_judge.judge_total), 2) as aggregate_score
from teams t
left join (
  select team_id, judge_id, sum(value) as judge_total
  from scores
  group by team_id, judge_id
) per_judge on per_judge.team_id = t.id
left join scores s on s.team_id = t.id
group by t.id, t.name;

-- Final stage: weighted average per team
create view final_team_scores as
select
  t.id as team_id,
  t.name as team_name,
  count(fv.id) as vote_count,
  round(sum(fv.value * fv.weight) / nullif(sum(fv.weight), 0), 2) as weighted_score
from teams t
left join final_votes fv on fv.team_id = t.id
where t.is_top5 = true
group by t.id, t.name;

-- ============================================================
-- ROW LEVEL SECURITY
-- This app reads/writes mostly through the anon key from the browser, gated by
-- application logic (no login walls for a one-day hackathon). Lock down the
-- sensitive bits: only the admin route (using the service role key) can change
-- settings or edit criteria/teams in bulk.
-- ============================================================

alter table teams enable row level security;
alter table people enable row level security;
alter table criteria enable row level security;
alter table scores enable row level security;
alter table final_votes enable row level security;
alter table settings enable row level security;

-- Public can read everything needed to render the app
create policy "public read teams" on teams for select using (true);
create policy "public read people" on people for select using (true);
create policy "public read criteria" on criteria for select using (true);
create policy "public read scores" on scores for select using (true);
create policy "public read final_votes" on final_votes for select using (true);
create policy "public read settings" on settings for select using (true);

-- Public (anon key) can insert their own registration + scores + votes
create policy "anyone can register" on people for insert with check (true);
create policy "anyone can create a team at registration" on teams for insert with check (true);
create policy "judges can insert their own scores" on scores for insert with check (true);
create policy "judges can update their own scores" on scores for update using (true);
create policy "anyone can cast a final vote" on final_votes for insert with check (true);
create policy "voters can change their final vote" on final_votes for update using (true);

-- Everything else (settings changes, criteria edits, team top5/rank flags) is
-- written exclusively via /api/admin/* routes using the SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. No public insert/update policies are defined for those on
-- purpose — do not add "public update settings" etc.
