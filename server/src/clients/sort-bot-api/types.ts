// Canonical (unwrapped) types our app uses — sort-bot-api's wrapped
// {Int64,Valid}/{String,Valid} shapes are normalized away inside the
// client before reaching this layer.

export type BotStatus = 'pending' | 'running' | 'evaluated' | 'failed';
export type Language = 'python' | 'node' | 'binary';

export interface ApiUser {
  id: string;
  display_name: string;
  created_at?: string;
}

export interface CreateUserResponse {
  user_id: string;
  display_name: string;
  api_key: string;
}

export interface ApiBot {
  id: string;
  user_id: string;
  display_name: string;
  language: Language;
  source_size_bytes: number;
  source_sha256: string;
  status: BotStatus;
  submitted_at: string;
  evaluation_completed_at?: string;
}

export interface ApiInput {
  id: number;
  size_class: 'small' | 'medium' | 'large';
  case_index: number;
  array_len: number;
  is_custom: boolean;
  uploader_id: string | null;
  created_at: string;
}

export interface InputsResponse {
  inputs: ApiInput[];
  total: number;
}

export interface LeaderboardRow {
  bot_id: string;
  display_name: string;
  language: Language;
  score: number;
  inputs_covered: number;
  total_inputs: number;
  incomplete: boolean;
  rank: number;
}

export interface LeaderboardResponse {
  filter: Record<string, unknown>;
  total_inputs: number;
  bots: LeaderboardRow[];
}

export interface PerInputLeaderboardRow {
  bot_id: string;
  display_name: string;
  language: Language;
  duration_ms: number;
  rank: number;
}

export interface PerInputLeaderboardResponse {
  input_id: number;
  bots: PerInputLeaderboardRow[];
}

export interface StatsResponse {
  fastest_run_ms: number;
  language_distribution: Record<string, number>;
  total_bots: number;
  total_runs: number;
}

export interface BotPerInput {
  input_id: number;
  size_class: 'small' | 'medium' | 'large';
  median_ms: number;
  status_counts: Record<string, number>;
}

export interface RankSnapshot {
  bot_id: string;
  rank: number;
  score: number;
  snapshot_at: string;
  triggering_bot_id: string;
}

export interface BotProfileResponse {
  bot: ApiBot;
  rank: number;
  score: number;
  incomplete: boolean;
  inputs_covered: number;
  total_inputs: number;
  best_input: { input_id: number; median_ms: number };
  worst_input: { input_id: number; median_ms: number };
  per_input: BotPerInput[];
  rank_history: RankSnapshot[];
}

export interface BotRun {
  id: number;
  bot_id: string;
  input_id: number;
  run_number: number;
  status: string;
  duration_ms: number | null;
  cpu_ms: number | null;
  error_msg: string | null;
  started_at: string;
  completed_at: string;
}

export interface BotRunsResponse {
  bot_id: string;
  runs: BotRun[];
  total: number;
}

export interface RankHistoryResponse {
  bot_id: string;
  count: number;
  history: RankSnapshot[];
}

export interface BotAnalysis {
  algorithm: string;
  time_complexity_estimate: string;
  space_complexity_estimate: string;
  strengths: string[];
  weaknesses: string[];
  suggested_use_cases: string[];
  anti_patterns: string[];
  reasoning: string;
}

export interface BattleSummary {
  id: string;
  bot_a_id: string;
  bot_b_id: string;
  initiator_id: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  winner_bot_id: string | null;
  bot_a_wins: number;
  bot_b_wins: number;
  ties: number;
  created_at: string;
  completed_at: string | null;
}

export interface BattleRun {
  id: number;
  battle_id: string;
  input_id: number;
  bot_a_duration_ms: number | null;
  bot_b_duration_ms: number | null;
  bot_a_status: string;
  bot_b_status: string;
  winner_bot_id: string | null;
  completed_at: string;
}

export interface BattleResponse {
  battle: BattleSummary;
  runs: BattleRun[];
}

export interface CreateBattleResponse {
  battle_id: string;
  bot_a: string;
  bot_b: string;
  input_ids: number[];
  status: string;
  created_at: string;
}

export interface HeadToHeadResponse {
  bot_a: string;
  bot_b: string;
  a_wins: number;
  b_wins: number;
  ties: number;
  per_input: Array<{
    input_id: number;
    size_class: 'small' | 'medium' | 'large';
    a_median_ms: number;
    b_median_ms: number;
    winner: 'a' | 'b' | 'tie';
  }>;
}

export interface TournamentMatch {
  id: number;
  tournament_id: string;
  round: number;
  bracket_position: number;
  bot_a_id: string | null;
  bot_b_id: string | null;
  winner_bot_id: string | null;
  battle_id: string | null;
  completed_at: string | null;
}

export interface TournamentSummary {
  id: string;
  initiator_id: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  participant_count: number;
  winner_bot_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TournamentResponse {
  tournament: TournamentSummary;
  matches: TournamentMatch[];
}
