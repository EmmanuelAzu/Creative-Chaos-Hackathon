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
  final_rank int,                                     -- filled in only at reveal time (1-5)
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

-- ---------- ROUND 1: which judges grade which teams ----------
create table judge_assignments (
  judge_id uuid not null references people(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (judge_id, team_id)
);

-- ---------- CRITERIA (editable per stage from the admin panel) ----------
create table criteria (
  id uuid primary key default gen_random_uuid(),
  stage score_stage not null,
  name text not null,
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
  leaderboard_public boolean not null default false,
  round1_open boolean not null default true,
  final_stage_open boolean not null default false,
  reveal_step int not null default 0   -- 0 = nothing revealed, 1..5 = that many ranks revealed, starting from 5th
);
insert into settings (id) values (true);

-- ============================================================
-- VIEWS for aggregation (recompute on read — fine at hackathon scale)
-- ============================================================

-- Round 1: each team's average score per judge, then averaged across judges
create view round1_team_scores as
select
  t.id as team_id,
  t.name as team_name,
  count(distinct s.judge_id) as judges_scored,
  (select count(*) from judge_assignments ja where ja.team_id = t.id) as judges_assigned,
  round(avg(per_judge.judge_avg), 2) as aggregate_score
from teams t
left join (
  select team_id, judge_id, avg(value) as judge_avg
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

-- Has every assigned judge scored every criterion for every team they're assigned?
create view round1_completion as
select
  (select count(*) from judge_assignments) as total_assignments,
  (
    select count(*) from (
      select ja.judge_id, ja.team_id
      from judge_assignments ja
      where (
        select count(distinct s.criteria_id) from scores s
        where s.judge_id = ja.judge_id and s.team_id = ja.team_id
      ) = (select count(*) from criteria where stage = 'round1')
    ) done
  ) as completed_assignments;

-- ============================================================
-- ROW LEVEL SECURITY
-- This app reads/writes mostly through the anon key from the browser, gated by
-- application logic (no login walls for a one-day hackathon). Lock down the
-- sensitive bits: only the admin route (using the service role key) can change
-- settings, create judge_assignments, or edit criteria/teams in bulk.
-- ============================================================

alter table teams enable row level security;
alter table people enable row level security;
alter table judge_assignments enable row level security;
alter table criteria enable row level security;
alter table scores enable row level security;
alter table final_votes enable row level security;
alter table settings enable row level security;

-- Public can read everything needed to render the app
create policy "public read teams" on teams for select using (true);
create policy "public read people" on people for select using (true);
create policy "public read assignments" on judge_assignments for select using (true);
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

-- Everything else (settings changes, assignments, criteria edits, team top5/rank flags)
-- is written exclusively via /api/admin/* routes using the SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. No public insert/update policies are defined for those on
-- purpose — do not add "public update settings" etc.
