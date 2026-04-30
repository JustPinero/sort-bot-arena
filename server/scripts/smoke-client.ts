// One-off live smoke for the sort-bot-api client. Hits the deployed
// service. Run via:
//   pnpm --filter @sort-bot-arena/server tsx scripts/smoke-client.ts

import { SortBotApiClient } from '../src/clients/sort-bot-api/index.js';

const client = new SortBotApiClient({
  baseUrl: process.env['SORT_BOT_API_URL'] ?? 'https://sort-bot-api-production.up.railway.app',
});

async function main(): Promise<void> {
  console.log('stats:', await client.getStats());
  const lb = await client.getLeaderboard({ limit: 3 });
  console.log('leaderboard:', { total_inputs: lb.total_inputs, n: lb.bots.length });
  if (lb.bots[0]) {
    const first = lb.bots[0];
    const profile = await client.getBotProfile(first.bot_id);
    console.log('top bot profile:', {
      bot_id: profile.bot.id,
      rank: profile.rank,
      score: profile.score,
      best_input: profile.best_input,
      worst_input: profile.worst_input,
    });
    const runs = await client.getBotRuns(first.bot_id, { limit: 3 });
    console.log('first 3 runs:', runs.runs.map((r) => ({
      input_id: r.input_id,
      duration_ms: r.duration_ms,
      status: r.status,
    })));
  }
}

main().catch((err) => {
  console.error('smoke failed:', err);
  process.exit(1);
});
