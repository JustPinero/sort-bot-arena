import type {
  Achievement,
  AchievementDefinition,
  Bot,
  BotRun,
  BotSnapshot,
  FeedItem,
  HomeSnapshot,
  InputPerformance,
  InputSummary,
  LeaderboardEntry,
  PerInputLeaderboardEntry,
  Tournament,
  TournamentParticipant,
} from '@/api/types';

const ACH_FIRST_BLOOD: Achievement = {
  id: 'ach_first_blood',
  name: 'First Blood',
  icon: 'sword',
  description: 'Won your first bout.',
  unlocked_at: '2026-01-12T18:30:00Z',
  rarity_pct: 41.2,
};

const ACH_KO_KING: Achievement = {
  id: 'ach_ko_king',
  name: 'KO King',
  icon: 'crown',
  description: '10 knockouts.',
  unlocked_at: '2026-02-08T22:14:00Z',
  rarity_pct: 6.8,
};

const ACH_GIANT_KILLER: Achievement = {
  id: 'ach_giant_killer',
  name: 'Giant Killer',
  icon: 'mountain',
  description: 'Defeated a top-3 ranked bot.',
  unlocked_at: '2026-03-21T20:02:00Z',
  rarity_pct: 2.1,
};

const ACH_PERFECT_DEBUT: Achievement = {
  id: 'ach_perfect_debut',
  name: 'Perfect Debut',
  icon: 'star',
  description: 'Won every input on first evaluation.',
  unlocked_at: '2026-01-04T10:00:00Z',
  rarity_pct: 0.4,
};

export const championBot: Bot = {
  id: 'bot_champ',
  display_name: 'Champion Coder',
  nickname: 'The Algorithm',
  language: 'go',
  algorithm: 'Introsort',
  portrait_url: 'http://api.test/portraits/bot_champ.png',
  rank: 1,
  record: { wins: 24, losses: 3, draws: 0 },
  ko_percentage: 71.4,
  signature_input: {
    input_id: 'in_killer_quicksort',
    input_name: 'Adversarial Quicksort Killer',
    time_seconds: 0.041,
  },
  achilles_heel: {
    input_id: 'in_almost_sorted',
    input_name: 'Already Sorted, Big',
    time_seconds: 0.612,
  },
  recent_form: ['W', 'W', 'W', 'L', 'W'],
  achievements: [ACH_KO_KING, ACH_GIANT_KILLER, ACH_FIRST_BLOOD],
  trash_talk: "I don't lose to amateurs.",
  analysis_url: 'http://api.test/v1/bots/bot_champ/analysis',
  retired: false,
};

export const rookieBot: Bot = {
  id: 'bot_rookie',
  display_name: 'Anonymous Otter 4729',
  nickname: null,
  language: 'python',
  algorithm: 'Bubble Sort',
  portrait_url: null,
  rank: null,
  record: { wins: 0, losses: 0, draws: 0 },
  ko_percentage: 0,
  signature_input: null,
  achilles_heel: null,
  recent_form: [],
  achievements: [],
  trash_talk: null,
  analysis_url: null,
  retired: false,
};

export const veteranBot: Bot = {
  id: 'bot_vet',
  display_name: 'Sandy Reeves',
  nickname: 'The Pivot',
  language: 'node',
  algorithm: 'Quicksort',
  portrait_url: 'http://api.test/portraits/bot_vet.png',
  rank: 7,
  record: { wins: 18, losses: 9, draws: 1 },
  ko_percentage: 38.9,
  signature_input: {
    input_id: 'in_random_large',
    input_name: 'Random, 10k',
    time_seconds: 0.092,
  },
  achilles_heel: {
    input_id: 'in_killer_quicksort',
    input_name: 'Adversarial Quicksort Killer',
    time_seconds: 4.871,
  },
  recent_form: ['L', 'W', 'L', 'W', 'W'],
  achievements: [ACH_FIRST_BLOOD, ACH_PERFECT_DEBUT],
  trash_talk: "I've been doing this longer than your grad school years.",
  analysis_url: 'http://api.test/v1/bots/bot_vet/analysis',
  retired: false,
};

export const retiredBot: Bot = {
  ...veteranBot,
  id: 'bot_retired',
  display_name: 'Old Glory',
  nickname: 'The Veteran',
  language: 'binary',
  algorithm: 'Hand-tuned Radix Sort',
  retired: true,
  rank: null,
  recent_form: ['W', 'W', 'W', 'W', 'W'],
};

export const noAnalysisBot: Bot = {
  ...veteranBot,
  id: 'bot_no_analysis',
  display_name: 'Quiet Type',
  nickname: 'The Mute',
  analysis_url: null,
};

export const noPortraitBot: Bot = {
  ...veteranBot,
  id: 'bot_no_portrait',
  display_name: 'Faceless Foe',
  nickname: null,
  portrait_url: null,
};

export const allBotsById: Record<string, Bot> = {
  [championBot.id]: championBot,
  [rookieBot.id]: rookieBot,
  [veteranBot.id]: veteranBot,
  [retiredBot.id]: retiredBot,
  [noAnalysisBot.id]: noAnalysisBot,
  [noPortraitBot.id]: noPortraitBot,
};

export const championRuns: BotRun[] = [
  {
    id: 'run_1',
    battle_id: 'bat_a1',
    opponent_id: veteranBot.id,
    opponent_nickname: veteranBot.nickname,
    opponent_portrait_url: veteranBot.portrait_url,
    outcome: 'win',
    ko: true,
    date: '2026-04-20T18:00:00Z',
  },
  {
    id: 'run_2',
    battle_id: 'bat_a2',
    opponent_id: 'bot_x',
    opponent_nickname: 'The Wall',
    opponent_portrait_url: null,
    outcome: 'win',
    ko: false,
    date: '2026-04-12T18:00:00Z',
  },
  {
    id: 'run_3',
    battle_id: 'bat_a3',
    opponent_id: 'bot_y',
    opponent_nickname: null,
    opponent_portrait_url: null,
    outcome: 'loss',
    ko: false,
    date: '2026-04-04T18:00:00Z',
  },
];

export const championSnapshots: BotSnapshot[] = [
  { date: '2026-01-15T00:00:00Z', rank: 14 },
  { date: '2026-02-15T00:00:00Z', rank: 8 },
  { date: '2026-03-15T00:00:00Z', rank: 3 },
  { date: '2026-04-15T00:00:00Z', rank: 1 },
];

export const championInputs: InputPerformance[] = [
  {
    input_id: 'in_killer_quicksort',
    input_name: 'Adversarial Quicksort Killer',
    size: 5_000,
    time_seconds: 0.041,
    rank_in_field: 1,
    total_in_field: 24,
  },
  {
    input_id: 'in_random_large',
    input_name: 'Random, 10k',
    size: 10_000,
    time_seconds: 0.064,
    rank_in_field: 2,
    total_in_field: 24,
  },
  {
    input_id: 'in_almost_sorted',
    input_name: 'Already Sorted, Big',
    size: 100_000,
    time_seconds: 0.612,
    rank_in_field: 19,
    total_in_field: 24,
  },
];

export const championAnalysis = {
  bot_id: championBot.id,
  analysis:
    "An introsort that knows when to switch. Excels on adversarial inputs by falling back to heapsort early; struggles on near-sorted inputs because the partitioning overhead doesn't amortize. Watch for the killer-pattern finishing move.",
  generated_at: '2026-04-25T12:00:00Z',
};

const ENTRY_BASE = (
  bot: Bot,
  rank: number,
  trend: LeaderboardEntry['trend'],
): LeaderboardEntry => ({
  bot_id: bot.id,
  rank,
  trend,
  display_name: bot.display_name,
  nickname: bot.nickname,
  language: bot.language,
  portrait_url: bot.portrait_url,
  record: bot.record,
  ko_percentage: bot.ko_percentage,
  signature_input: bot.signature_input,
  last_fight_at: '2026-04-20T18:00:00Z',
  retired: bot.retired,
});

export const leaderboardEntries: LeaderboardEntry[] = [
  ENTRY_BASE(championBot, 1, 'up'),
  ENTRY_BASE(
    {
      ...veteranBot,
      id: 'bot_silver',
      nickname: 'Silver Bullet',
      display_name: 'Marina Cole',
      record: { wins: 21, losses: 5, draws: 0 },
      ko_percentage: 62.0,
    },
    2,
    'steady',
  ),
  ENTRY_BASE(
    {
      ...veteranBot,
      id: 'bot_bronze',
      nickname: 'The Bronze',
      display_name: 'Theo Park',
      record: { wins: 19, losses: 6, draws: 1 },
      ko_percentage: 51.0,
    },
    3,
    'down',
  ),
  ENTRY_BASE(veteranBot, 7, 'up'),
  ENTRY_BASE(
    {
      ...rookieBot,
      record: { wins: 1, losses: 0, draws: 0 },
      ko_percentage: 100,
    },
    14,
    'new',
  ),
];

export const sampleBattle = {
  id: 'bat_demo_1',
  status: 'live' as const,
  fighter_a: {
    bot_id: championBot.id,
    nickname: championBot.nickname,
    display_name: championBot.display_name,
    language: championBot.language,
    portrait_url: championBot.portrait_url,
    corner: 'red' as const,
    rank: championBot.rank,
    trash_talk: championBot.trash_talk,
  },
  fighter_b: {
    bot_id: veteranBot.id,
    nickname: veteranBot.nickname,
    display_name: veteranBot.display_name,
    language: veteranBot.language,
    portrait_url: veteranBot.portrait_url,
    corner: 'blue' as const,
    rank: veteranBot.rank,
    trash_talk: veteranBot.trash_talk,
  },
  rounds_total: 5,
  current_round: 0,
  scheduled_at: '2026-04-28T19:00:00Z',
  started_at: null,
  completed_at: null,
  winner_bot_id: null,
  outcome: null,
};

export const allBattles = [sampleBattle];

export const sampleInputs: InputSummary[] = [
  {
    id: 'in_killer_quicksort',
    name: 'Adversarial Quicksort Killer',
    size: 5_000,
    description: 'Median-of-three killer pattern.',
  },
  { id: 'in_random_large', name: 'Random, 10k', size: 10_000 },
  { id: 'in_almost_sorted', name: 'Already Sorted, Big', size: 100_000 },
];

export const perInputLeaderboard: PerInputLeaderboardEntry[] = [
  {
    bot_id: championBot.id,
    rank_in_field: 1,
    display_name: championBot.display_name,
    nickname: championBot.nickname,
    language: championBot.language,
    portrait_url: championBot.portrait_url,
    time_seconds: 0.041,
    achieved_at: '2026-04-20T18:00:00Z',
  },
  {
    bot_id: 'bot_silver',
    rank_in_field: 2,
    display_name: 'Marina Cole',
    nickname: 'Silver Bullet',
    language: 'go',
    portrait_url: null,
    time_seconds: 0.067,
    achieved_at: '2026-04-19T18:00:00Z',
  },
  {
    bot_id: veteranBot.id,
    rank_in_field: 7,
    display_name: veteranBot.display_name,
    nickname: veteranBot.nickname,
    language: veteranBot.language,
    portrait_url: veteranBot.portrait_url,
    time_seconds: 4.871,
    achieved_at: '2026-04-15T18:00:00Z',
  },
];

const TPART = (b: Bot): TournamentParticipant => ({
  bot_id: b.id,
  nickname: b.nickname,
  display_name: b.display_name,
  language: b.language,
  portrait_url: b.portrait_url,
});

export const sampleTournaments: Tournament[] = [
  {
    id: 'trn_active',
    name: 'Rumble in the Stack',
    status: 'active',
    participant_count: 4,
    weight_class_filter: null,
    prize_description: 'Champion belt + bragging rights',
    scheduled_at: '2026-04-28T20:00:00Z',
    rounds_total: 2,
    current_round: 1,
    champion_bot_id: null,
    participants: [championBot, veteranBot, retiredBot, noPortraitBot].map(TPART),
    matches: [
      {
        id: 'm_a',
        round: 1,
        position: 0,
        fighter_a_bot_id: championBot.id,
        fighter_b_bot_id: veteranBot.id,
        winner_bot_id: championBot.id,
        status: 'completed',
        battle_id: 'bat_demo_1',
      },
      {
        id: 'm_b',
        round: 1,
        position: 1,
        fighter_a_bot_id: retiredBot.id,
        fighter_b_bot_id: noPortraitBot.id,
        winner_bot_id: null,
        status: 'live',
        battle_id: null,
      },
      {
        id: 'm_final',
        round: 2,
        position: 0,
        fighter_a_bot_id: championBot.id,
        fighter_b_bot_id: null,
        winner_bot_id: null,
        status: 'pending',
        battle_id: null,
      },
    ],
  },
  {
    id: 'trn_upcoming',
    name: 'Sort-Fest 8',
    status: 'upcoming',
    participant_count: 8,
    weight_class_filter: 'lightweight',
    prize_description: 'Top-3 podium spots in the rankings',
    scheduled_at: '2026-05-05T20:00:00Z',
    rounds_total: 3,
    current_round: 0,
    champion_bot_id: null,
    participants: [],
    matches: [],
  },
  {
    id: 'trn_completed',
    name: 'Killer Pattern Cup',
    status: 'completed',
    participant_count: 3,
    weight_class_filter: null,
    prize_description: 'Trophy + leaderboard spotlight',
    scheduled_at: '2026-04-15T20:00:00Z',
    rounds_total: 2,
    current_round: 2,
    champion_bot_id: championBot.id,
    participants: [championBot, veteranBot, rookieBot].map(TPART),
    matches: [
      {
        id: 'm_q1',
        round: 1,
        position: 0,
        fighter_a_bot_id: championBot.id,
        fighter_b_bot_id: rookieBot.id,
        winner_bot_id: championBot.id,
        status: 'completed',
        battle_id: 'bat_demo_1',
      },
      {
        id: 'm_q2',
        round: 1,
        position: 1,
        fighter_a_bot_id: veteranBot.id,
        fighter_b_bot_id: null,
        winner_bot_id: veteranBot.id,
        status: 'bye',
        battle_id: null,
      },
      {
        id: 'm_final',
        round: 2,
        position: 0,
        fighter_a_bot_id: championBot.id,
        fighter_b_bot_id: veteranBot.id,
        winner_bot_id: championBot.id,
        status: 'completed',
        battle_id: 'bat_demo_1',
      },
    ],
  },
];

export const myBots = [championBot];

export const homeSnapshot: HomeSnapshot = {
  ticker: [
    {
      id: 'fi_1',
      kind: 'ko',
      ts: '2026-04-28T19:55:00Z',
      text: `KNOCKOUT — ${championBot.nickname} dispatches ${veteranBot.nickname} in 5`,
      bot_id: championBot.id,
      href: `/bots/${championBot.id}`,
    },
    {
      id: 'fi_2',
      kind: 'rank_change',
      ts: '2026-04-28T19:30:00Z',
      text: `${championBot.nickname} retakes the throne — #1`,
      bot_id: championBot.id,
      href: `/bots/${championBot.id}`,
    },
    {
      id: 'fi_3',
      kind: 'submission',
      ts: '2026-04-28T18:50:00Z',
      text: `New fighter: ${rookieBot.display_name} debuts in lightweight`,
      bot_id: rookieBot.id,
      href: `/bots/${rookieBot.id}`,
    },
    {
      id: 'fi_4',
      kind: 'tournament',
      ts: '2026-04-28T18:00:00Z',
      text: 'Rumble in the Stack — round 1 underway',
      bot_id: null,
      href: '/tournaments/trn_active',
    },
    {
      id: 'fi_5',
      kind: 'achievement',
      ts: '2026-04-28T17:30:00Z',
      text: `${championBot.nickname} unlocks Giant Killer (2.1% rarity)`,
      bot_id: championBot.id,
      href: `/bots/${championBot.id}?tab=achievements`,
    },
  ],
  featured_battle_id: sampleBattle.id,
  rookie_of_the_day: {
    bot_id: rookieBot.id,
    nickname: rookieBot.nickname,
    display_name: rookieBot.display_name,
    language: rookieBot.language,
    portrait_url: rookieBot.portrait_url,
    record: { wins: 1, losses: 0, draws: 0 },
  },
  biggest_upset: {
    text: `${rookieBot.display_name} drops top-15 fighter in debut`,
    battle_id: sampleBattle.id,
  },
  champion: {
    bot_id: championBot.id,
    nickname: championBot.nickname,
    display_name: championBot.display_name,
    language: championBot.language,
    portrait_url: championBot.portrait_url,
    record: championBot.record,
  },
};

export const liveFeedTail: FeedItem[] = homeSnapshot.ticker.slice(0, 8);

export const achievementsCatalog: AchievementDefinition[] = [
  { ...ACH_KO_KING, unlocked_pct: 6.8 },
  { ...ACH_GIANT_KILLER, unlocked_pct: 2.1 },
  { ...ACH_FIRST_BLOOD, unlocked_pct: 41.2 },
  { ...ACH_PERFECT_DEBUT, unlocked_pct: 0.4 },
];

export const hallOfFame: Bot[] = [retiredBot];
