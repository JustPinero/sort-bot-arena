// Stateless-ish translator from sort-bot-api's 4 battle events to the
// 8-event vocabulary the frontend BattleViewer expects.
//
// Sort-bot-api emits (verified live): battle_start, run_start,
// run_complete, battle_complete. Frontend expects: walkout, fight_start,
// round_start, round_progress, round_end, fighter_downed, commentary,
// fight_end. (See src/api/types.ts in the frontend.)
//
// Stateless caveat: round numbers come from the position of the run's
// input_id within the battle's inputs[] array. The caller must remember
// the inputs[] from battle_start and pass it back in via ctx; we don't
// hold any module-level state.

export type BackendBattleEvent =
  | {
      type: 'battle_start';
      data: { battle_id: string; bot_a: string; bot_b: string; inputs: number[] };
    }
  | { type: 'run_start'; data: { battle_id: string; input_id: number } }
  | {
      type: 'run_complete';
      data: {
        battle_id: string;
        input_id: number;
        bot_a_status: string;
        bot_b_status: string;
        bot_a_duration_ms: number | null;
        bot_b_duration_ms: number | null;
        winner_bot_id: string;
      };
    }
  | {
      type: 'battle_complete';
      data: {
        battle_id: string;
        winner_bot_id: string;
        bot_a_wins: number;
        bot_b_wins: number;
        ties: number;
      };
    };

export type FrontendBattleEvent =
  | { type: 'walkout'; bot_id: string; ts: string }
  | { type: 'fight_start'; ts: string }
  | {
      type: 'round_start';
      round: number;
      input_id: string;
      input_name: string;
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
  | {
      type: 'fight_end';
      winner_bot_id: string | null;
      outcome: 'a_decision' | 'b_decision' | 'a_ko' | 'b_ko' | 'draw';
      a_rounds_won: number;
      b_rounds_won: number;
      ts: string;
    };

export interface TranslateContext {
  inputs: number[];
  bot_a: string;
  bot_b: string;
  ts?: string;
}

export interface TranslateResult {
  events: FrontendBattleEvent[];
  // Updated context that callers should thread through to subsequent calls.
  // Battle_start populates the inputs/bot ids for later events.
  next: TranslateContext;
}

export function translateBackendEvent(
  event: BackendBattleEvent,
  ctx: TranslateContext,
): TranslateResult {
  const ts = ctx.ts ?? new Date().toISOString();
  switch (event.type) {
    case 'battle_start': {
      const next: TranslateContext = {
        inputs: event.data.inputs,
        bot_a: event.data.bot_a,
        bot_b: event.data.bot_b,
        ...(ctx.ts !== undefined && { ts: ctx.ts }),
      };
      return {
        events: [
          { type: 'walkout', bot_id: event.data.bot_a, ts },
          { type: 'walkout', bot_id: event.data.bot_b, ts },
          { type: 'fight_start', ts },
        ],
        next,
      };
    }
    case 'run_start': {
      const round = roundOf(ctx.inputs, event.data.input_id);
      return {
        events: [
          {
            type: 'round_start',
            round,
            input_id: String(event.data.input_id),
            input_name: `Input #${event.data.input_id}`,
            ts,
          },
        ],
        next: ctx,
      };
    }
    case 'run_complete': {
      const round = roundOf(ctx.inputs, event.data.input_id);
      const out: FrontendBattleEvent[] = [];
      const aDown = downedReason(event.data.bot_a_status);
      const bDown = downedReason(event.data.bot_b_status);
      if (aDown) out.push({ type: 'fighter_downed', bot_id: ctx.bot_a, reason: aDown, ts });
      if (bDown) out.push({ type: 'fighter_downed', bot_id: ctx.bot_b, reason: bDown, ts });
      const aMs = event.data.bot_a_duration_ms ?? 0;
      const bMs = event.data.bot_b_duration_ms ?? 0;
      out.push({
        type: 'round_end',
        round,
        winner_bot_id: event.data.winner_bot_id,
        a_time_seconds: aMs / 1000,
        b_time_seconds: bMs / 1000,
        delta_seconds: Math.abs(aMs - bMs) / 1000,
        ts,
      });
      return { events: out, next: ctx };
    }
    case 'battle_complete': {
      const aWins = event.data.bot_a_wins;
      const bWins = event.data.bot_b_wins;
      const winner = event.data.winner_bot_id || null;
      type Outcome = 'a_decision' | 'b_decision' | 'a_ko' | 'b_ko' | 'draw';
      let outcome: Outcome;
      if (winner === ctx.bot_a) outcome = bWins === 0 ? 'a_ko' : 'a_decision';
      else if (winner === ctx.bot_b) outcome = aWins === 0 ? 'b_ko' : 'b_decision';
      else outcome = 'draw';
      return {
        events: [
          {
            type: 'fight_end',
            winner_bot_id: winner,
            outcome,
            a_rounds_won: aWins,
            b_rounds_won: bWins,
            ts,
          },
        ],
        next: ctx,
      };
    }
  }
}

function roundOf(inputs: number[], inputId: number): number {
  const idx = inputs.indexOf(inputId);
  return idx === -1 ? 0 : idx + 1;
}

function downedReason(
  status: string,
): 'timeout' | 'crash' | 'oom' | null {
  switch (status) {
    case 'timeout':
    case 'time_limit':
      return 'timeout';
    case 'memory_limit':
    case 'oom':
      return 'oom';
    case 'crash':
    case 'runtime_error':
    case 'wrong_answer':
    case 'invalid_output':
      return 'crash';
    default:
      return null;
  }
}
