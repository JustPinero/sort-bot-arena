import type {
  Achievement,
  Bot,
  BotRun,
  BotSnapshot,
  InputPerformance,
  InputSummary,
  LeaderboardEntry,
  PerInputLeaderboardEntry,
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
  display_name: 'Justin Pinero',
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
