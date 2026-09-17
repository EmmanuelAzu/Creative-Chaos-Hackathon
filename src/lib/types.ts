export type PersonRole = "participant" | "judge" | "committee";
export type ScoreStage = "round1" | "final";

export interface Team {
  id: string;
  name: string;
  qr_token: string;
  is_top5: boolean;
  round1_rank: number | null;
  final_rank: number | null;
  created_at: string;
}

export interface Person {
  id: string;
  role: PersonRole;
  full_name: string;
  team_id: string | null;
  company: string | null;
  is_independent: boolean | null;
  portfolio: string | null;
  created_at: string;
}

export interface Criteria {
  id: string;
  stage: ScoreStage;
  name: string;
  category: string | null;
  prompt: string | null;
  max_score: number;
  sort_order: number;
}

export interface Score {
  id: string;
  judge_id: string;
  team_id: string;
  criteria_id: string;
  value: number;
}

export interface FinalVote {
  id: string;
  voter_id: string;
  team_id: string;
  value: number;
  weight: number;
}

export interface Settings {
  round1_open: boolean;
  final_stage_open: boolean;
  round1_reveal_step: number;
  reveal_step: number;
}

export interface Round1TeamScore {
  team_id: string;
  team_name: string;
  judges_scored: number;
  aggregate_score: number | null;
}

export interface FinalTeamScore {
  team_id: string;
  team_name: string;
  vote_count: number;
  weighted_score: number | null;
}
