// Persona orchestrator. Idempotent and fail-safe — every external call
// is wrapped in try/catch so a Leonardo or Anthropic outage never
// breaks our /api/v1/bots POST flow.

import { log } from '../lib/log.js';

import { buildPortraitPrompt } from './leonardo.js';
import { nicknameFor } from './nicknames.js';
import {
  ensurePersonaRow,
  getPersona,
  setLeonardoGenerationId,
  setPortrait,
  setPortraitFailed,
  setTrashTalk,
  setTrashTalkFailed,
  type BotPersonaRow,
} from './store.js';

import type { AnthropicClient } from './anthropic.js';
import type { LeonardoClient } from './leonardo.js';
import type { Client } from '@libsql/client';

export interface PersonaServiceConfig {
  db: Client;
  leonardo?: LeonardoClient | undefined;
  anthropic?: AnthropicClient | undefined;
  // Polling cadence for Leonardo's async generation. Tests can shorten.
  pollIntervalMs?: number;
  pollMaxAttempts?: number;
}

export interface BotIdentity {
  bot_id: string;
  display_name: string;
  language: string;
  algorithm?: string | null;
}

export class PersonaService {
  constructor(private readonly cfg: PersonaServiceConfig) {}

  async get(botId: string): Promise<BotPersonaRow | null> {
    return getPersona(this.cfg.db, botId);
  }

  // Kicks off generation in the background and returns immediately.
  // Safe to call repeatedly; existing rows are not regenerated.
  startBackgroundGeneration(bot: BotIdentity): void {
    void this.generate(bot).catch((err) => {
      log.warn(
        { bot_id: bot.bot_id, err: err instanceof Error ? err.message : String(err) },
        'persona generation failed',
      );
    });
  }

  // Same logic, awaitable — used in tests + for synchronous flows.
  async generate(bot: BotIdentity): Promise<BotPersonaRow | null> {
    await ensurePersonaRow(this.cfg.db, bot.bot_id);
    await Promise.allSettled([this.generatePortrait(bot), this.generateTrashTalk(bot)]);
    return getPersona(this.cfg.db, bot.bot_id);
  }

  private async generatePortrait(bot: BotIdentity): Promise<void> {
    if (!this.cfg.leonardo) return;
    const existing = await getPersona(this.cfg.db, bot.bot_id);
    if (existing?.portrait_url || existing?.portrait_status === 'in_flight') return;

    try {
      const start = await this.cfg.leonardo.startGeneration(
        buildPortraitPrompt({
          display_name: bot.display_name,
          language: bot.language,
          ...(bot.algorithm !== undefined && { algorithm: bot.algorithm }),
        }),
      );
      await setLeonardoGenerationId(this.cfg.db, bot.bot_id, start.generation_id);

      const interval = this.cfg.pollIntervalMs ?? 5_000;
      const max = this.cfg.pollMaxAttempts ?? 24; // ~2 minutes
      for (let i = 0; i < max; i++) {
        await sleep(interval);
        const result = await this.cfg.leonardo.getGeneration(start.generation_id);
        if (result.status === 'COMPLETE' && result.image_url) {
          await setPortrait(this.cfg.db, bot.bot_id, result.image_url);
          return;
        }
        if (result.status === 'FAILED') {
          await setPortraitFailed(this.cfg.db, bot.bot_id);
          return;
        }
      }
      await setPortraitFailed(this.cfg.db, bot.bot_id);
    } catch (err) {
      log.warn(
        { bot_id: bot.bot_id, err: err instanceof Error ? err.message : String(err) },
        'leonardo portrait generation failed',
      );
      await setPortraitFailed(this.cfg.db, bot.bot_id);
    }
  }

  private async generateTrashTalk(bot: BotIdentity): Promise<void> {
    if (!this.cfg.anthropic) return;
    const existing = await getPersona(this.cfg.db, bot.bot_id);
    if (existing?.trash_talk) return;
    try {
      const text = await this.cfg.anthropic.generateTrashTalk({
        display_name: bot.display_name,
        nickname: nicknameFor(bot.bot_id),
        language: bot.language,
        algorithm: bot.algorithm ?? null,
      });
      await setTrashTalk(this.cfg.db, bot.bot_id, text);
    } catch (err) {
      log.warn(
        { bot_id: bot.bot_id, err: err instanceof Error ? err.message : String(err) },
        'anthropic trash-talk generation failed',
      );
      await setTrashTalkFailed(this.cfg.db, bot.bot_id);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
