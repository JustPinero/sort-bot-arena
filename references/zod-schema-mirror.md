# Zod schema mirror of `src/api/types.ts`

## Why

The phase-8 contract drift bug shipped because frontend tests asserted only against MSW handlers (which had drifted from the real server) and server tests asserted only field presence (`toHaveProperty`). Phase 9 added shape tests but they're still hand-rolled `expect(body['x']).toBe(...)` lists. Adding a new field to a type does not automatically tighten any test.

A zod schema mirror gives us:
- One runtime parser per response type, derivable from the same source TS uses.
- A boundary for the SPA — `apiClient.get(path, { schema })` runs `.parse()` and surfaces malformed responses as `ApiError({code: 'malformed_response'})` *before* a component reads `.someField`.
- A boundary for the server — server route tests `.parse(response.body)` against the same schema. A stale handler crashes the test.
- A drift signal — when `src/api/types.ts` adds a field, both sides fail compile/test until the schema is updated. The schema becomes the single source of truth at runtime; TS keeps its compile-time guarantees on top.

## File layout

```
src/api/
├── types.ts              # TS interfaces (current)
├── schemas.ts            # NEW — zod schemas + inferred types
└── client.ts             # extended with `{schema}` overload
```

`schemas.ts` exports both the schema and the inferred type:

```ts
export const LeaderboardEntrySchema = z.object({
  bot_id: z.string(),
  rank: z.number().int().nonnegative(),
  trend: z.enum(['up', 'down', 'steady', 'new', 'returning']),
  display_name: z.string(),
  nickname: z.string().nullable(),
  language: z.string(),
  portrait_url: z.string().url().nullable(),
  record: z.object({
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    draws: z.number().int().nonnegative(),
  }),
  ko_percentage: z.number().nonnegative(),
  signature_input: BotInputResultSchema.nullable(),
  last_fight_at: z.string().nullable(),
  retired: z.boolean(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
```

The original `src/api/types.ts` then re-exports types from `schemas.ts` so existing consumers don't break:

```ts
// types.ts becomes a barrel
export type { LeaderboardEntry } from './schemas';
```

## Schemas to write (alphabetical, top-level only)

These are the load-bearing types. Sub-types (`BotInputResult`, `Achievement`, `BattleFighter`, etc.) get their own exported schemas and are composed.

- `AchievementSchema` / `AchievementDefinitionSchema`
- `AnalysisResponseSchema`
- `BattleEventSchema` (already exists in `battleSchema.ts` — fold into `schemas.ts` and re-export from the old path for one cycle)
- `BattleFighterSchema` / `BattleSchema` / `BattleRankChangeSchema`
- `BotSchema` / `BotRunSchema` / `BotSnapshotSchema`
- `CursorPageSchema<T>` — generic helper: `<T>(item: ZodType<T>) => z.object({items: z.array(item), next_cursor: z.string().nullable()})`
- `EvaluationEventSchema`
- `FeedItemSchema` / `HomeSnapshotSchema`
- `HealthResponseSchema`
- `InputPerformanceSchema` / `InputSummarySchema`
- `LeaderboardEntrySchema` / `LeaderboardFiltersSchema` / `PerInputLeaderboardEntrySchema`
- `SubmitBotResponseSchema`
- `TournamentSchema` / `TournamentMatchSchema` / `TournamentParticipantSchema`

Strict mode: every object schema uses `.strict()` to reject unknown keys *only in tests* (so a future server-added field doesn't silently slip through). Production parsing uses the default `.passthrough()` so adding a field doesn't break the SPA before we can ship a fix. The pattern:

```ts
export const LeaderboardEntrySchema = z.object({...});
export const LeaderboardEntryStrictSchema = LeaderboardEntrySchema.strict();
```

Test code uses `…StrictSchema`. Production uses `…Schema`.

## `apiClient.get` overload

```ts
export interface GetOptionsWithSchema<T> extends RequestOptions {
  schema: ZodType<T>;
}

export async function get<T>(path: string, opts?: RequestOptions): Promise<T>;
export async function get<T>(path: string, opts: GetOptionsWithSchema<T>): Promise<T>;
export async function get<T>(path: string, opts?: RequestOptions | GetOptionsWithSchema<T>) {
  const raw = await request<unknown>('GET', path, undefined, opts);
  if (opts && 'schema' in opts) {
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError({
        status: 0,
        code: 'malformed_response',
        message: `${path}: ${parsed.error.issues[0]?.message ?? 'response did not match schema'}`,
        retryable: false,
      });
    }
    return parsed.data;
  }
  return raw as T;
}
```

Same overload for `.post` (post/put/patch). The schema applies to the response, not the body — bodies are zod-validated server-side.

## Migration plan (callsite-by-callsite, not big bang)

Phase 10 backfills **all** read endpoints (decision B). Order:

1. New endpoints first (every new query in phase 10 ships with a schema from day one).
2. Critical-path endpoints: `useBot`, `useBattle`, `useTournament`, `useLeaderboard`, `useHomeSnapshot`.
3. Detail endpoints: `useBotRuns`, `useBotInputs`, `useBotAnalysis`, `useBotSnapshots`, `usePerInputLeaderboard`, `useInputs`, `useHallOfFame`, `useAchievementsCatalog`, `useMyBots`, `useBattles`, `useTournaments`, `useHeadToHead`.

Each callsite migration is mechanical: import the schema, pass it as `{schema}`, the inferred type still satisfies `apiClient.get<T>` so the rest of the call site is unchanged.

## Server-side adoption

Server tests `import { LeaderboardEntryStrictSchema } from '../../src/api/schemas.js'`. The current `expect(body).toMatchObject(...)` blocks become `LeaderboardEntryStrictSchema.parse(body.items[0])`. A bad shape throws and pinpoints the field — strictly better DX than `expect(body).toHaveProperty('items')`.

The server doesn't *re-parse* its own responses (that's expensive); it just uses the schema in tests. Production server code keeps doing `c.json(synthesizedShape)` — TS guarantees the shape matches at compile time via the type alias.

## Drift detection

A new test file `server/tests/contract-drift.test.ts` runs through every endpoint in `src/api/queries.ts`, fetches via `app.request()`, and asserts the response parses against the corresponding strict schema. One test per endpoint. New endpoints automatically become a TODO comment to add to this list.

This is the test that would have caught phase 8.

## What this does NOT solve

- MSW handlers can still drift from the real server (different code paths). Slice B4 separately fixes the 3 known drifts, plus a separate `references/msw-fidelity.md` snapshot mechanism (see slice B5).
- Frontend doesn't validate sub-fields it deeply navigates into. Mitigated by always parsing at the boundary, never accepting `unknown` past the parse line.

## Open question (won't block phase 10)

Generated zod from TS types? Tools like `ts-to-zod` exist. Today the schemas are the source of truth and TS infers from them — that's the recommended direction. Generating zod from existing TS would be a one-shot import for legacy types, but ongoing it inverts the flow.
