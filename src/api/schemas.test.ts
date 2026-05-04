import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import {
  AchievementSchema,
  AchievementStrictSchema,
  AchievementDefinitionSchema,
  AchievementDefinitionStrictSchema,
  AnalysisResponseSchema,
  AnalysisResponseStrictSchema,
  BattleEventSchema,
  BattleFighterSchema,
  BattleFighterStrictSchema,
  BattleSchema,
  BattleStrictSchema,
  BotInputResultSchema,
  BotInputResultStrictSchema,
  BotRunSchema,
  BotRunStrictSchema,
  BotSchema,
  BotSnapshotSchema,
  BotSnapshotStrictSchema,
  BotStrictSchema,
  CursorPageSchema,
  EvaluationEventSchema,
  FeedItemSchema,
  FeedItemStrictSchema,
  HealthResponseSchema,
  HealthResponseStrictSchema,
  HomeSnapshotSchema,
  HomeSnapshotStrictSchema,
  InputPerformanceSchema,
  InputPerformanceStrictSchema,
  InputSummarySchema,
  InputSummaryStrictSchema,
  LeaderboardEntrySchema,
  LeaderboardEntryStrictSchema,
  LeaderboardFiltersSchema,
  LeaderboardFiltersStrictSchema,
  PerInputLeaderboardEntrySchema,
  PerInputLeaderboardEntryStrictSchema,
  SubmitBotResponseSchema,
  SubmitBotResponseStrictSchema,
  TournamentMatchSchema,
  TournamentMatchStrictSchema,
  TournamentParticipantSchema,
  TournamentParticipantStrictSchema,
  TournamentSchema,
  TournamentStrictSchema,
} from './schemas';

const baseRecord = { wins: 1, losses: 2, draws: 0 };

const sigInput = {
  input_id: 'inp_1',
  input_name: 'almost-sorted-1k',
  time_seconds: 0.04,
};

const happyAchievement = {
  id: 'ach_1',
  name: 'First Blood',
  icon: 'sword',
  description: 'won first',
  unlocked_at: '2026-01-01T00:00:00Z',
  rarity_pct: 41.2,
};

const happyBot = {
  id: 'bot_1',
  display_name: 'Quicksort McGee',
  nickname: 'Pivot Pete',
  language: 'python',
  algorithm: 'quicksort',
  portrait_url: null,
  rank: 3,
  record: baseRecord,
  ko_percentage: 12.5,
  signature_input: sigInput,
  achilles_heel: null,
  recent_form: ['W', 'L', 'D'],
  achievements: [happyAchievement],
  trash_talk: null,
  analysis_url: null,
  retired: false,
};

const happyLeaderboardEntry = {
  bot_id: 'bot_1',
  rank: 1,
  trend: 'up',
  display_name: 'Quicksort',
  nickname: null,
  language: 'python',
  portrait_url: null,
  record: baseRecord,
  ko_percentage: 10,
  signature_input: null,
  last_fight_at: null,
  retired: false,
};

const happyBattleFighter = {
  bot_id: 'bot_1',
  nickname: null,
  display_name: 'Quicksort',
  language: 'python',
  portrait_url: null,
  corner: 'red',
  rank: 5,
};

const happyBattle = {
  id: 'bat_1',
  status: 'pre_fight',
  fighter_a: happyBattleFighter,
  fighter_b: { ...happyBattleFighter, bot_id: 'bot_2', corner: 'blue' },
  rounds_total: 3,
  current_round: 0,
  scheduled_at: '2026-04-01T00:00:00Z',
  started_at: null,
  completed_at: null,
  winner_bot_id: null,
  outcome: null,
  weight_class: 'sparring',
};

const happyTournamentMatch = {
  id: 'm_1',
  round: 1,
  position: 0,
  fighter_a_bot_id: 'bot_1',
  fighter_b_bot_id: 'bot_2',
  winner_bot_id: null,
  status: 'pending',
  battle_id: null,
};

const happyTournamentParticipant = {
  bot_id: 'bot_1',
  nickname: null,
  display_name: 'Quicksort',
  language: 'python',
  portrait_url: null,
};

const happyTournament = {
  id: 't_1',
  name: 'Spring Cup',
  status: 'upcoming',
  participant_count: 4,
  weight_class_filter: null,
  prize_description: null,
  scheduled_at: '2026-05-01T00:00:00Z',
  rounds_total: 2,
  current_round: 0,
  champion_bot_id: null,
  matches: [happyTournamentMatch],
  participants: [happyTournamentParticipant],
};

const happyFeedItem = {
  id: 'feed_1',
  kind: 'rank_change',
  ts: '2026-04-01T00:00:00Z',
  text: 'Bot moved up',
  bot_id: 'bot_1',
  href: '/fighters/bot_1',
};

const happyHomeSnapshot = {
  ticker: [happyFeedItem],
  featured_battle_id: null,
  rookie_of_the_day: null,
  biggest_upset: null,
  champion: null,
};

describe('BotInputResultSchema', () => {
  it('parses a happy fixture', () => {
    expect(BotInputResultSchema.parse(sigInput)).toEqual(sigInput);
  });
  it('rejects wrong type for time_seconds', () => {
    expect(() => BotInputResultSchema.parse({ ...sigInput, time_seconds: 'fast' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => BotInputResultStrictSchema.parse({ ...sigInput, extra: 1 })).toThrow();
  });
});

describe('AchievementSchema', () => {
  it('parses a happy fixture', () => {
    expect(AchievementSchema.parse(happyAchievement)).toEqual(happyAchievement);
  });
  it('rejects missing field', () => {
    const { id: _id, ...rest } = happyAchievement;
    expect(() => AchievementSchema.parse(rest)).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => AchievementStrictSchema.parse({ ...happyAchievement, extra: 'x' })).toThrow();
  });
});

describe('BotSchema', () => {
  it('parses a happy fixture', () => {
    expect(BotSchema.parse(happyBot)).toEqual(happyBot);
  });
  it('rejects bad recent_form symbol', () => {
    expect(() => BotSchema.parse({ ...happyBot, recent_form: ['W', 'X'] })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => BotStrictSchema.parse({ ...happyBot, extra: 1 })).toThrow();
  });
});

describe('BotRunSchema', () => {
  const happy = {
    id: 'run_1',
    battle_id: 'bat_1',
    opponent_id: 'bot_2',
    opponent_nickname: null,
    opponent_portrait_url: null,
    outcome: 'win',
    ko: true,
    date: '2026-04-01T00:00:00Z',
  };
  it('parses a happy fixture', () => {
    expect(BotRunSchema.parse(happy)).toEqual(happy);
  });
  it('rejects unknown outcome', () => {
    expect(() => BotRunSchema.parse({ ...happy, outcome: 'tko' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => BotRunStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('CursorPageSchema', () => {
  const PageSchema = CursorPageSchema(z.object({ id: z.string() }));
  it('parses a happy page', () => {
    expect(PageSchema.parse({ items: [{ id: 'a' }], next_cursor: null })).toEqual({
      items: [{ id: 'a' }],
      next_cursor: null,
    });
  });
  it('rejects when items is not an array', () => {
    expect(() => PageSchema.parse({ items: 'oops', next_cursor: null })).toThrow();
  });
});

describe('BotSnapshotSchema', () => {
  const happy = { date: '2026-04-01', rank: 5 };
  it('parses a happy fixture', () => {
    expect(BotSnapshotSchema.parse(happy)).toEqual(happy);
  });
  it('rejects wrong type for rank', () => {
    expect(() => BotSnapshotSchema.parse({ ...happy, rank: '5' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => BotSnapshotStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('InputPerformanceSchema', () => {
  const happy = {
    input_id: 'inp_1',
    input_name: 'name',
    size: 1000,
    time_seconds: 0.5,
    rank_in_field: 1,
    total_in_field: 10,
  };
  it('parses a happy fixture', () => {
    expect(InputPerformanceSchema.parse(happy)).toEqual(happy);
  });
  it('rejects wrong type for size', () => {
    expect(() => InputPerformanceSchema.parse({ ...happy, size: '1000' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => InputPerformanceStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('AnalysisResponseSchema', () => {
  const happy = { bot_id: 'bot_1', analysis: 'good', generated_at: '2026-04-01T00:00:00Z' };
  it('parses a happy fixture', () => {
    expect(AnalysisResponseSchema.parse(happy)).toEqual(happy);
  });
  it('rejects missing analysis', () => {
    const { analysis: _a, ...rest } = happy;
    expect(() => AnalysisResponseSchema.parse(rest)).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => AnalysisResponseStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('HealthResponseSchema', () => {
  it('parses a happy fixture', () => {
    expect(HealthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });
  it('rejects wrong type for status', () => {
    expect(() => HealthResponseSchema.parse({ status: 1 })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => HealthResponseStrictSchema.parse({ status: 'ok', extra: 1 })).toThrow();
  });
});

describe('LeaderboardEntrySchema', () => {
  it('parses a happy fixture', () => {
    expect(LeaderboardEntrySchema.parse(happyLeaderboardEntry)).toEqual(happyLeaderboardEntry);
  });
  it('rejects unknown trend', () => {
    expect(() =>
      LeaderboardEntrySchema.parse({ ...happyLeaderboardEntry, trend: 'sideways' }),
    ).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() =>
      LeaderboardEntryStrictSchema.parse({ ...happyLeaderboardEntry, extra: 1 }),
    ).toThrow();
  });
});

describe('InputSummarySchema', () => {
  const happy = { id: 'inp_1', name: 'foo', size: 1000 };
  it('parses a happy fixture (no description)', () => {
    expect(InputSummarySchema.parse(happy)).toEqual(happy);
  });
  it('rejects wrong type for size', () => {
    expect(() => InputSummarySchema.parse({ ...happy, size: 'big' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => InputSummaryStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('LeaderboardFiltersSchema', () => {
  const happy = {
    weight: 'all' as const,
    activity: 'all' as const,
    language: null,
    sort: 'rank' as const,
  };
  it('parses a happy fixture', () => {
    expect(LeaderboardFiltersSchema.parse(happy)).toEqual(happy);
  });
  it('rejects unknown weight', () => {
    expect(() => LeaderboardFiltersSchema.parse({ ...happy, weight: 'super' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => LeaderboardFiltersStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('PerInputLeaderboardEntrySchema', () => {
  const happy = {
    bot_id: 'bot_1',
    rank_in_field: 1,
    display_name: 'Quicksort',
    nickname: null,
    language: 'python',
    portrait_url: null,
    time_seconds: 0.04,
    achieved_at: '2026-04-01T00:00:00Z',
  };
  it('parses a happy fixture', () => {
    expect(PerInputLeaderboardEntrySchema.parse(happy)).toEqual(happy);
  });
  it('rejects wrong type for time_seconds', () => {
    expect(() =>
      PerInputLeaderboardEntrySchema.parse({ ...happy, time_seconds: 'fast' }),
    ).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => PerInputLeaderboardEntryStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('BattleFighterSchema', () => {
  it('parses a happy fixture', () => {
    expect(BattleFighterSchema.parse(happyBattleFighter)).toEqual(happyBattleFighter);
  });
  it('rejects unknown corner', () => {
    expect(() => BattleFighterSchema.parse({ ...happyBattleFighter, corner: 'green' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => BattleFighterStrictSchema.parse({ ...happyBattleFighter, extra: 1 })).toThrow();
  });
});

describe('BattleSchema', () => {
  it('parses a happy fixture', () => {
    expect(BattleSchema.parse(happyBattle)).toEqual(happyBattle);
  });
  it('rejects unknown status', () => {
    expect(() => BattleSchema.parse({ ...happyBattle, status: 'paused' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => BattleStrictSchema.parse({ ...happyBattle, extra: 1 })).toThrow();
  });
});

describe('SubmitBotResponseSchema', () => {
  it('parses a happy fixture', () => {
    expect(SubmitBotResponseSchema.parse({ bot_id: 'bot_1' })).toEqual({ bot_id: 'bot_1' });
  });
  it('rejects missing bot_id', () => {
    expect(() => SubmitBotResponseSchema.parse({})).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => SubmitBotResponseStrictSchema.parse({ bot_id: 'bot_1', extra: 1 })).toThrow();
  });
});

describe('EvaluationEventSchema', () => {
  it('parses an eval_start', () => {
    const ev = { type: 'eval_start', total: 10, ts: '2026-04-01T00:00:00Z' };
    expect(EvaluationEventSchema.parse(ev)).toEqual(ev);
  });
  it('parses an eval_complete', () => {
    const ev = {
      type: 'eval_complete',
      bot_id: 'bot_1',
      final_rank: 5,
      record: baseRecord,
      ts: '2026-04-01T00:00:00Z',
    };
    expect(EvaluationEventSchema.parse(ev)).toEqual(ev);
  });
  it('rejects an unknown event type', () => {
    expect(() =>
      EvaluationEventSchema.parse({ type: 'mystery', ts: '2026-04-01T00:00:00Z' }),
    ).toThrow();
  });
});

describe('TournamentMatchSchema', () => {
  it('parses a happy fixture', () => {
    expect(TournamentMatchSchema.parse(happyTournamentMatch)).toEqual(happyTournamentMatch);
  });
  it('rejects unknown status', () => {
    expect(() =>
      TournamentMatchSchema.parse({ ...happyTournamentMatch, status: 'paused' }),
    ).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() =>
      TournamentMatchStrictSchema.parse({ ...happyTournamentMatch, extra: 1 }),
    ).toThrow();
  });
});

describe('TournamentParticipantSchema', () => {
  it('parses a happy fixture', () => {
    expect(TournamentParticipantSchema.parse(happyTournamentParticipant)).toEqual(
      happyTournamentParticipant,
    );
  });
  it('rejects missing display_name', () => {
    const { display_name: _d, ...rest } = happyTournamentParticipant;
    expect(() => TournamentParticipantSchema.parse(rest)).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() =>
      TournamentParticipantStrictSchema.parse({
        ...happyTournamentParticipant,
        extra: 1,
      }),
    ).toThrow();
  });
});

describe('TournamentSchema', () => {
  it('parses a happy fixture', () => {
    expect(TournamentSchema.parse(happyTournament)).toEqual(happyTournament);
  });
  it('rejects unknown status', () => {
    expect(() => TournamentSchema.parse({ ...happyTournament, status: 'cancelled' })).toThrow();
  });
  it('rejects invalid weight_class_filter values', () => {
    expect(() =>
      TournamentSchema.parse({ ...happyTournament, weight_class_filter: 'invalid_value' }),
    ).toThrow();
  });
  it('accepts a valid weight class filter', () => {
    const t = { ...happyTournament, weight_class_filter: 'lightweight' as const };
    expect(TournamentSchema.parse(t)).toEqual(t);
  });
  it('strict rejects extra key', () => {
    expect(() => TournamentStrictSchema.parse({ ...happyTournament, extra: 1 })).toThrow();
  });
});

describe('FeedItemSchema', () => {
  it('parses a happy fixture', () => {
    expect(FeedItemSchema.parse(happyFeedItem)).toEqual(happyFeedItem);
  });
  it('rejects unknown kind', () => {
    expect(() => FeedItemSchema.parse({ ...happyFeedItem, kind: 'mystery' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => FeedItemStrictSchema.parse({ ...happyFeedItem, extra: 1 })).toThrow();
  });
});

describe('HomeSnapshotSchema', () => {
  it('parses a happy fixture', () => {
    expect(HomeSnapshotSchema.parse(happyHomeSnapshot)).toEqual(happyHomeSnapshot);
  });
  it('rejects bad ticker shape', () => {
    expect(() => HomeSnapshotSchema.parse({ ...happyHomeSnapshot, ticker: 'no' })).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => HomeSnapshotStrictSchema.parse({ ...happyHomeSnapshot, extra: 1 })).toThrow();
  });
});

describe('AchievementDefinitionSchema', () => {
  const happy = { ...happyAchievement, unlocked_pct: 12.5 };
  it('parses a happy fixture', () => {
    expect(AchievementDefinitionSchema.parse(happy)).toEqual(happy);
  });
  it('rejects missing unlocked_pct', () => {
    const { unlocked_pct: _u, ...rest } = happy;
    expect(() => AchievementDefinitionSchema.parse(rest)).toThrow();
  });
  it('strict rejects extra key', () => {
    expect(() => AchievementDefinitionStrictSchema.parse({ ...happy, extra: 1 })).toThrow();
  });
});

describe('BattleEventSchema', () => {
  it('parses a fight_start event', () => {
    const ev = { type: 'fight_start', ts: '2026-04-01T00:00:00Z' };
    expect(BattleEventSchema.parse(ev)).toEqual(ev);
  });
  it('parses a round_progress event', () => {
    const ev = {
      type: 'round_progress',
      round: 1,
      bot_id: 'bot_1',
      progress_pct: 50,
      ts: '2026-04-01T00:00:00Z',
    };
    expect(BattleEventSchema.parse(ev)).toEqual(ev);
  });
  it('rejects an unknown event type', () => {
    expect(() =>
      BattleEventSchema.parse({ type: 'unknown', ts: '2026-04-01T00:00:00Z' }),
    ).toThrow();
  });
});
