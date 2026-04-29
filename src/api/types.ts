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

export type Corner = 'red' | 'blue';
export type BattleStatus = 'pre_fight' | 'live' | 'completed';
export type BattleOutcome = 'ko' | 'tko' | 'decision' | 'draw' | 'no_contest';

export interface BattleFighter {
  bot_id: string;
  nickname: string | null;
  display_name: string;
  language: string;
  portrait_url: string | null;
  corner: Corner;
  rank: number | null;
  trash_talk?: string | null;
}

export interface BattleRankChange {
  previous_champion_bot_id: string;
  new_champion_bot_id: string;
}

export interface Battle {
  id: string;
  status: BattleStatus;
  fighter_a: BattleFighter;
  fighter_b: BattleFighter;
  rounds_total: number;
  current_round: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  winner_bot_id: string | null;
  outcome: BattleOutcome | null;
  rank_change?: BattleRankChange;
}

export interface SubmitBotResponse {
  bot_id: string;
}

export type EvaluationEvent =
  | { type: 'eval_start'; total: number; ts: string }
  | {
      type: 'eval_progress';
      input_id: string;
      input_name: string;
      time_seconds: number;
      rank_estimate: number | null;
      completed: number;
      total: number;
      ts: string;
    }
  | {
      type: 'eval_complete';
      bot_id: string;
      final_rank: number | null;
      record: { wins: number; losses: number; draws: number };
      ts: string;
    }
  | { type: 'eval_failed'; reason: string; ts: string };

export interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  fighter_a_bot_id: string | null;
  fighter_b_bot_id: string | null;
  winner_bot_id: string | null;
  status: 'pending' | 'live' | 'completed' | 'bye';
  battle_id: string | null;
}

export type TournamentStatus = 'upcoming' | 'active' | 'completed';

export interface TournamentParticipant {
  bot_id: string;
  nickname: string | null;
  display_name: string;
  language: string;
  portrait_url: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  participant_count: number;
  weight_class_filter: string | null;
  prize_description: string | null;
  scheduled_at: string;
  rounds_total: number;
  current_round: number;
  champion_bot_id: string | null;
  matches: TournamentMatch[];
  participants: TournamentParticipant[];
}

export type FeedEventKind = 'rank_change' | 'submission' | 'ko' | 'tournament' | 'achievement';

export interface FeedItem {
  id: string;
  kind: FeedEventKind;
  ts: string;
  text: string;
  bot_id: string | null;
  href: string | null;
}

export interface HomeSnapshot {
  ticker: FeedItem[];
  featured_battle_id: string | null;
  rookie_of_the_day: {
    bot_id: string;
    nickname: string | null;
    display_name: string;
    language: string;
    portrait_url: string | null;
    record: { wins: number; losses: number; draws: number };
  } | null;
  biggest_upset: {
    text: string;
    battle_id: string;
  } | null;
  champion: {
    bot_id: string;
    nickname: string | null;
    display_name: string;
    language: string;
    portrait_url: string | null;
    record: { wins: number; losses: number; draws: number };
  } | null;
}

export interface AchievementDefinition extends Achievement {
  unlocked_pct: number;
}

export type BattleEvent =
  | { type: 'walkout'; bot_id: string; ts: string }
  | { type: 'fight_start'; ts: string }
  | { type: 'round_start'; round: number; input_id: string; input_name: string; ts: string }
  | {
      type: 'round_progress';
      round: number;
      bot_id: string;
      progress_pct: number;
      ts: string;
    }
  | {
      type: 'round_end';
      round: number;
      winner_bot_id: string;
      a_time_seconds: number;
      b_time_seconds: number;
      delta_seconds: number;
      ts: string;
    }
  | {
      type: 'fighter_downed';
      bot_id: string;
      reason: 'timeout' | 'crash' | 'oom';
      ts: string;
    }
  | { type: 'commentary'; text: string; ts: string }
  | {
      type: 'fight_end';
      winner_bot_id: string | null;
      outcome: BattleOutcome;
      a_rounds_won: number;
      b_rounds_won: number;
      rank_change?: BattleRankChange;
      ts: string;
    };
