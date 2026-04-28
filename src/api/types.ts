export interface BotInputResult {
  input_id: string;
  input_name: string;
  time_seconds: number;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlocked_at: string;
  rarity_pct: number;
}

export type RecentFormSymbol = 'W' | 'L' | 'D';

export interface Bot {
  id: string;
  display_name: string;
  nickname: string | null;
  language: string;
  algorithm: string | null;
  portrait_url: string | null;
  rank: number | null;
  record: { wins: number; losses: number; draws: number };
  ko_percentage: number;
  signature_input: BotInputResult | null;
  achilles_heel: BotInputResult | null;
  recent_form: ReadonlyArray<RecentFormSymbol>;
  achievements: Achievement[];
  trash_talk: string | null;
  analysis_url: string | null;
  retired: boolean;
}

export type RunOutcome = 'win' | 'loss' | 'draw' | 'no_contest';

export interface BotRun {
  id: string;
  battle_id: string;
  opponent_id: string;
  opponent_nickname: string | null;
  opponent_portrait_url: string | null;
  outcome: RunOutcome;
  ko: boolean;
  date: string;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface BotSnapshot {
  date: string;
  rank: number;
}

export interface InputPerformance {
  input_id: string;
  input_name: string;
  size: number;
  time_seconds: number;
  rank_in_field: number;
  total_in_field: number;
}

export interface AnalysisResponse {
  bot_id: string;
  analysis: string;
  generated_at: string;
}

export interface HealthResponse {
  status: string;
}

export type WeightClassFilter =
  | 'all'
  | 'heavyweight'
  | 'cruiserweight'
  | 'middleweight'
  | 'lightweight';
export type ActivityFilter = 'all' | 'week' | 'month';
export type LeaderboardSort = 'rank' | 'wins' | 'ko' | 'recent' | 'alphabetical';
export type RankTrend = 'up' | 'down' | 'steady' | 'new' | 'returning';

export interface LeaderboardEntry {
  bot_id: string;
  rank: number;
  trend: RankTrend;
  display_name: string;
  nickname: string | null;
  language: string;
  portrait_url: string | null;
  record: { wins: number; losses: number; draws: number };
  ko_percentage: number;
  signature_input: BotInputResult | null;
  last_fight_at: string | null;
  retired: boolean;
}

export interface InputSummary {
  id: string;
  name: string;
  size: number;
  description?: string;
}

export interface LeaderboardFilters {
  weight: WeightClassFilter;
  activity: ActivityFilter;
  language: string | null;
  sort: LeaderboardSort;
}

export interface PerInputLeaderboardEntry {
  bot_id: string;
  rank_in_field: number;
  display_name: string;
  nickname: string | null;
  language: string;
  portrait_url: string | null;
  time_seconds: number;
  achieved_at: string;
}
