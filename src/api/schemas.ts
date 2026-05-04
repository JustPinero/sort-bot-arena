import { z, type ZodTypeAny } from 'zod';

// ---------------------------------------------------------------------------
// Bot + supporting shapes
// ---------------------------------------------------------------------------

export const BotInputResultSchema = z
  .object({
    input_id: z.string(),
    input_name: z.string(),
    time_seconds: z.number(),
  })
  .passthrough();
export const BotInputResultStrictSchema = BotInputResultSchema.strict();
export type BotInputResult = z.infer<typeof BotInputResultSchema>;

export const AchievementSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    description: z.string(),
    unlocked_at: z.string(),
    rarity_pct: z.number(),
  })
  .passthrough();
export const AchievementStrictSchema = AchievementSchema.strict();
export type Achievement = z.infer<typeof AchievementSchema>;

export const RecentFormSymbolSchema = z.enum(['W', 'L', 'D']);
export type RecentFormSymbol = z.infer<typeof RecentFormSymbolSchema>;

const RecordSchema = z
  .object({
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    draws: z.number().int().nonnegative(),
  })
  .passthrough();

export const BotSchema = z
  .object({
    id: z.string(),
    display_name: z.string(),
    nickname: z.string().nullable(),
    language: z.string(),
    algorithm: z.string().nullable(),
    portrait_url: z.string().nullable(),
    rank: z.number().nullable(),
    record: RecordSchema,
    ko_percentage: z.number(),
    signature_input: BotInputResultSchema.nullable(),
    achilles_heel: BotInputResultSchema.nullable(),
    recent_form: z.array(RecentFormSymbolSchema).readonly(),
    achievements: z.array(AchievementSchema),
    trash_talk: z.string().nullable(),
    analysis_url: z.string().nullable(),
    retired: z.boolean(),
  })
  .passthrough();
export const BotStrictSchema = BotSchema.strict();
export type Bot = z.infer<typeof BotSchema>;

// ---------------------------------------------------------------------------
// Bot runs / cursor pages
// ---------------------------------------------------------------------------

export const RunOutcomeSchema = z.enum(['win', 'loss', 'draw', 'no_contest']);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;

export const BotRunSchema = z
  .object({
    id: z.string(),
    battle_id: z.string(),
    opponent_id: z.string(),
    opponent_nickname: z.string().nullable(),
    opponent_portrait_url: z.string().nullable(),
    outcome: RunOutcomeSchema,
    ko: z.boolean(),
    date: z.string(),
  })
  .passthrough();
export const BotRunStrictSchema = BotRunSchema.strict();
export type BotRun = z.infer<typeof BotRunSchema>;

export const CursorPageSchema = <T extends ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item),
      next_cursor: z.string().nullable(),
    })
    .passthrough();
export type CursorPage<T> = { items: T[]; next_cursor: string | null };

// ---------------------------------------------------------------------------
// Snapshots, performance, analysis, health
// ---------------------------------------------------------------------------

export const BotSnapshotSchema = z
  .object({
    date: z.string(),
    rank: z.number(),
  })
  .passthrough();
export const BotSnapshotStrictSchema = BotSnapshotSchema.strict();
export type BotSnapshot = z.infer<typeof BotSnapshotSchema>;

export const InputPerformanceSchema = z
  .object({
    input_id: z.string(),
    input_name: z.string(),
    size: z.number(),
    time_seconds: z.number(),
    rank_in_field: z.number(),
    total_in_field: z.number(),
  })
  .passthrough();
export const InputPerformanceStrictSchema = InputPerformanceSchema.strict();
export type InputPerformance = z.infer<typeof InputPerformanceSchema>;

export const AnalysisResponseSchema = z
  .object({
    bot_id: z.string(),
    analysis: z.string(),
    generated_at: z.string(),
  })
  .passthrough();
export const AnalysisResponseStrictSchema = AnalysisResponseSchema.strict();
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

export const HealthResponseSchema = z
  .object({
    status: z.string(),
  })
  .passthrough();
export const HealthResponseStrictSchema = HealthResponseSchema.strict();
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ---------------------------------------------------------------------------
// Auth / session
// ---------------------------------------------------------------------------

export const SessionUserSchema = z
  .object({
    id: z.string(),
    display_name: z.string(),
    email: z.string(),
  })
  .passthrough();
export const SessionUserStrictSchema = SessionUserSchema.strict();
export type SessionUser = z.infer<typeof SessionUserSchema>;

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export const WeightClassFilterSchema = z.enum([
  'all',
  'heavyweight',
  'cruiserweight',
  'middleweight',
  'lightweight',
]);
export type WeightClassFilter = z.infer<typeof WeightClassFilterSchema>;

export const ActivityFilterSchema = z.enum(['all', 'week', 'month']);
export type ActivityFilter = z.infer<typeof ActivityFilterSchema>;

export const LeaderboardSortSchema = z.enum(['rank', 'wins', 'ko', 'recent', 'alphabetical']);
export type LeaderboardSort = z.infer<typeof LeaderboardSortSchema>;

export const RankTrendSchema = z.enum(['up', 'down', 'steady', 'new', 'returning']);
export type RankTrend = z.infer<typeof RankTrendSchema>;

export const LeaderboardEntrySchema = z
  .object({
    bot_id: z.string(),
    rank: z.number(),
    trend: RankTrendSchema,
    display_name: z.string(),
    nickname: z.string().nullable(),
    language: z.string(),
    portrait_url: z.string().nullable(),
    record: RecordSchema,
    ko_percentage: z.number(),
    signature_input: BotInputResultSchema.nullable(),
    last_fight_at: z.string().nullable(),
    retired: z.boolean(),
  })
  .passthrough();
export const LeaderboardEntryStrictSchema = LeaderboardEntrySchema.strict();
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const InputSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    description: z.string().optional(),
  })
  .passthrough();
export const InputSummaryStrictSchema = InputSummarySchema.strict();
export type InputSummary = z.infer<typeof InputSummarySchema>;

export const LeaderboardFiltersSchema = z
  .object({
    weight: WeightClassFilterSchema,
    activity: ActivityFilterSchema,
    language: z.string().nullable(),
    sort: LeaderboardSortSchema,
  })
  .passthrough();
export const LeaderboardFiltersStrictSchema = LeaderboardFiltersSchema.strict();
export type LeaderboardFilters = z.infer<typeof LeaderboardFiltersSchema>;

export const PerInputLeaderboardEntrySchema = z
  .object({
    bot_id: z.string(),
    rank_in_field: z.number(),
    display_name: z.string(),
    nickname: z.string().nullable(),
    language: z.string(),
    portrait_url: z.string().nullable(),
    time_seconds: z.number(),
    achieved_at: z.string(),
  })
  .passthrough();
export const PerInputLeaderboardEntryStrictSchema = PerInputLeaderboardEntrySchema.strict();
export type PerInputLeaderboardEntry = z.infer<typeof PerInputLeaderboardEntrySchema>;

// ---------------------------------------------------------------------------
// Battles
// ---------------------------------------------------------------------------

export const CornerSchema = z.enum(['red', 'blue']);
export type Corner = z.infer<typeof CornerSchema>;

export const BattleStatusSchema = z.enum(['pre_fight', 'live', 'completed']);
export type BattleStatus = z.infer<typeof BattleStatusSchema>;

export const BattleOutcomeSchema = z.enum(['ko', 'tko', 'decision', 'draw', 'no_contest']);
export type BattleOutcome = z.infer<typeof BattleOutcomeSchema>;

export const BattleWeightClassSchema = z.enum(['sparring', 'exhibition', 'title_fight']);
export type BattleWeightClass = z.infer<typeof BattleWeightClassSchema>;

export const BattleFighterSchema = z
  .object({
    bot_id: z.string(),
    nickname: z.string().nullable(),
    display_name: z.string(),
    language: z.string(),
    portrait_url: z.string().nullable(),
    corner: CornerSchema,
    rank: z.number().nullable(),
    trash_talk: z.string().nullable().optional(),
  })
  .passthrough();
export const BattleFighterStrictSchema = BattleFighterSchema.strict();
export type BattleFighter = z.infer<typeof BattleFighterSchema>;

export const BattleRankChangeSchema = z
  .object({
    previous_champion_bot_id: z.string(),
    new_champion_bot_id: z.string(),
  })
  .passthrough();
export const BattleRankChangeStrictSchema = BattleRankChangeSchema.strict();
export type BattleRankChange = z.infer<typeof BattleRankChangeSchema>;

export const BattleSchema = z
  .object({
    id: z.string(),
    status: BattleStatusSchema,
    fighter_a: BattleFighterSchema,
    fighter_b: BattleFighterSchema,
    rounds_total: z.number(),
    current_round: z.number(),
    scheduled_at: z.string(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    winner_bot_id: z.string().nullable(),
    outcome: BattleOutcomeSchema.nullable(),
    weight_class: BattleWeightClassSchema.nullable(),
    rank_change: BattleRankChangeSchema.optional(),
  })
  .passthrough();
export const BattleStrictSchema = BattleSchema.strict();
export type Battle = z.infer<typeof BattleSchema>;

// ---------------------------------------------------------------------------
// Submit + evaluation events
// ---------------------------------------------------------------------------

// The arena server's `POST /api/v1/bots` returns the synthesized rich Bot
// shape (asserted by `server/tests/contract-drift.test.ts`), keyed off
// `id`. The frontend has historically read `res.bot_id` from this call, so
// we preprocess to bridge the two — accept either `bot_id` directly or
// derive `bot_id` from `id` — without forcing a wider rename through every
// caller of `useSubmitBot`. The G2 real-server E2E surfaced the gap; this
// preprocess closes it.
const submitBotPreprocess = (v: unknown): unknown => {
  if (v && typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    if (!('bot_id' in obj) && typeof obj['id'] === 'string') {
      return { ...obj, bot_id: obj['id'] };
    }
  }
  return v;
};
export const SubmitBotResponseSchema = z.preprocess(
  submitBotPreprocess,
  z.object({ bot_id: z.string() }).passthrough(),
);
export const SubmitBotResponseStrictSchema = z.preprocess(
  submitBotPreprocess,
  z.object({ bot_id: z.string() }).strict(),
);
export type SubmitBotResponse = z.infer<typeof SubmitBotResponseSchema>;

const evalBaseTs = z.object({ ts: z.string() });

export const EvaluationEventSchema = z.discriminatedUnion('type', [
  evalBaseTs.extend({
    type: z.literal('eval_start'),
    total: z.number(),
  }),
  evalBaseTs.extend({
    type: z.literal('eval_progress'),
    input_id: z.string(),
    input_name: z.string(),
    time_seconds: z.number(),
    rank_estimate: z.number().nullable(),
    completed: z.number(),
    total: z.number(),
  }),
  evalBaseTs.extend({
    type: z.literal('eval_complete'),
    bot_id: z.string(),
    final_rank: z.number().nullable(),
    record: RecordSchema,
  }),
  evalBaseTs.extend({
    type: z.literal('eval_failed'),
    reason: z.string(),
  }),
]);
export type EvaluationEvent = z.infer<typeof EvaluationEventSchema>;

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

export const TournamentMatchStatusSchema = z.enum(['pending', 'live', 'completed', 'bye']);

export const TournamentMatchSchema = z
  .object({
    id: z.string(),
    round: z.number(),
    position: z.number(),
    fighter_a_bot_id: z.string().nullable(),
    fighter_b_bot_id: z.string().nullable(),
    winner_bot_id: z.string().nullable(),
    status: TournamentMatchStatusSchema,
    battle_id: z.string().nullable(),
  })
  .passthrough();
export const TournamentMatchStrictSchema = TournamentMatchSchema.strict();
export type TournamentMatch = z.infer<typeof TournamentMatchSchema>;

export const TournamentStatusSchema = z.enum(['upcoming', 'active', 'completed']);
export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;

export const TournamentParticipantSchema = z
  .object({
    bot_id: z.string(),
    nickname: z.string().nullable(),
    display_name: z.string(),
    language: z.string(),
    portrait_url: z.string().nullable(),
  })
  .passthrough();
export const TournamentParticipantStrictSchema = TournamentParticipantSchema.strict();
export type TournamentParticipant = z.infer<typeof TournamentParticipantSchema>;

export const TournamentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: TournamentStatusSchema,
    participant_count: z.number(),
    weight_class_filter: WeightClassFilterSchema.nullable(),
    prize_description: z.string().nullable(),
    scheduled_at: z.string(),
    rounds_total: z.number(),
    current_round: z.number(),
    champion_bot_id: z.string().nullable(),
    matches: z.array(TournamentMatchSchema),
    participants: z.array(TournamentParticipantSchema),
  })
  .passthrough();
export const TournamentStrictSchema = TournamentSchema.strict();
export type Tournament = z.infer<typeof TournamentSchema>;

// Slice D4 — POST /api/v1/tournaments now returns a clean envelope
// (`{tournament_id, status: 'pending'}`) instead of the upstream
// CreateTournamentResponse passed through verbatim. The frontend's
// `useStartTournament` consumes this shape; the rich `Tournament` is
// fetched separately by `useTournament(id)` after the redirect.
export const CreateTournamentResponseSchema = z
  .object({ tournament_id: z.string(), status: z.string() })
  .passthrough();
export const CreateTournamentResponseStrictSchema = CreateTournamentResponseSchema.strict();
export type CreateTournamentResponse = z.infer<typeof CreateTournamentResponseSchema>;

// ---------------------------------------------------------------------------
// Feed + home snapshot
// ---------------------------------------------------------------------------

export const FeedEventKindSchema = z.enum([
  'rank_change',
  'submission',
  'ko',
  'tournament',
  'achievement',
]);
export type FeedEventKind = z.infer<typeof FeedEventKindSchema>;

export const FeedItemSchema = z
  .object({
    id: z.string(),
    kind: FeedEventKindSchema,
    ts: z.string(),
    text: z.string(),
    bot_id: z.string().nullable(),
    href: z.string().nullable(),
  })
  .passthrough();
export const FeedItemStrictSchema = FeedItemSchema.strict();
export type FeedItem = z.infer<typeof FeedItemSchema>;

const HomeBotSummarySchema = z
  .object({
    bot_id: z.string(),
    nickname: z.string().nullable(),
    display_name: z.string(),
    language: z.string(),
    portrait_url: z.string().nullable(),
    record: RecordSchema,
  })
  .passthrough();

const HomeUpsetSchema = z
  .object({
    text: z.string(),
    battle_id: z.string(),
  })
  .passthrough();

export const HomeSnapshotSchema = z
  .object({
    ticker: z.array(FeedItemSchema),
    featured_battle_id: z.string().nullable(),
    rookie_of_the_day: HomeBotSummarySchema.nullable(),
    biggest_upset: HomeUpsetSchema.nullable(),
    champion: HomeBotSummarySchema.nullable(),
  })
  .passthrough();
export const HomeSnapshotStrictSchema = HomeSnapshotSchema.strict();
export type HomeSnapshot = z.infer<typeof HomeSnapshotSchema>;

// ---------------------------------------------------------------------------
// Achievement definition (catalog)
// ---------------------------------------------------------------------------

export const AchievementDefinitionSchema = AchievementSchema.extend({
  unlocked_pct: z.number(),
}).passthrough();
export const AchievementDefinitionStrictSchema = AchievementDefinitionSchema.strict();
export type AchievementDefinition = z.infer<typeof AchievementDefinitionSchema>;

// ---------------------------------------------------------------------------
// Battle SSE events
// ---------------------------------------------------------------------------

const battleBaseTs = z.object({ ts: z.string() });

export const BattleEventSchema = z.discriminatedUnion('type', [
  battleBaseTs.extend({ type: z.literal('walkout'), bot_id: z.string() }),
  battleBaseTs.extend({ type: z.literal('fight_start') }),
  battleBaseTs.extend({
    type: z.literal('round_start'),
    round: z.number().int().min(1),
    input_id: z.string(),
    input_name: z.string(),
  }),
  battleBaseTs.extend({
    type: z.literal('round_progress'),
    round: z.number().int().min(1),
    bot_id: z.string(),
    progress_pct: z.number().min(0).max(100),
  }),
  battleBaseTs.extend({
    type: z.literal('round_end'),
    round: z.number().int().min(1),
    winner_bot_id: z.string(),
    a_time_seconds: z.number().nonnegative(),
    b_time_seconds: z.number().nonnegative(),
    delta_seconds: z.number(),
  }),
  battleBaseTs.extend({
    type: z.literal('fighter_downed'),
    bot_id: z.string(),
    reason: z.enum(['timeout', 'crash', 'oom']),
  }),
  battleBaseTs.extend({ type: z.literal('commentary'), text: z.string() }),
  battleBaseTs.extend({
    type: z.literal('fight_end'),
    winner_bot_id: z.string().nullable(),
    outcome: BattleOutcomeSchema,
    a_rounds_won: z.number().int().nonnegative(),
    b_rounds_won: z.number().int().nonnegative(),
    rank_change: BattleRankChangeSchema.optional(),
  }),
]);
export type BattleEvent = z.infer<typeof BattleEventSchema>;
