import { breadcrumb } from '../../lib/sentry.js';

import { SortBotApiError, isTransient } from './error.js';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  windowMs: number;
  cooldownMs: number;
  now?: () => number;
}

export const DEFAULT_BREAKER: CircuitBreakerOptions = {
  failureThreshold: 5,
  windowMs: 10_000,
  cooldownMs: 30_000,
};

export type BreakerState = 'closed' | 'open' | 'half_open';

export class CircuitBreaker {
  private failures: number[] = [];
  private openedAt: number | null = null;
  private probeInFlight = false;
  private readonly cfg: CircuitBreakerOptions;

  constructor(opts: Partial<CircuitBreakerOptions> = {}) {
    this.cfg = { ...DEFAULT_BREAKER, ...opts };
  }

  private nowMs(): number {
    return (this.cfg.now ?? Date.now)();
  }

  state(): BreakerState {
    if (this.openedAt === null) return 'closed';
    return this.nowMs() - this.openedAt >= this.cfg.cooldownMs ? 'half_open' : 'open';
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const s = this.state();
    if (s === 'open') {
      throw this.openError();
    }
    if (s === 'half_open') {
      if (this.probeInFlight) throw this.openError();
      this.probeInFlight = true;
      try {
        return await this.execute(fn);
      } finally {
        this.probeInFlight = false;
      }
    }
    return this.execute(fn);
  }

  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      if (err instanceof SortBotApiError && (isTransient(err) || err.status === 0)) {
        this.recordFailure();
      }
      throw err;
    }
  }

  private openError(): SortBotApiError {
    return new SortBotApiError({
      status: 503,
      code: 'circuit_open',
      message: 'sort-bot-api circuit breaker is open',
    });
  }

  private recordSuccess(): void {
    this.failures = [];
    this.openedAt = null;
  }

  private recordFailure(): void {
    const now = this.nowMs();
    this.failures = this.failures.filter((t) => now - t < this.cfg.windowMs);
    this.failures.push(now);
    if (this.failures.length >= this.cfg.failureThreshold && this.openedAt === null) {
      this.openedAt = now;
      breadcrumb('breaker.open', 'circuit breaker tripped', {
        failures: this.failures.length,
        cooldown_ms: this.cfg.cooldownMs,
      });
    }
  }
}

export class BreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  constructor(private readonly opts: Partial<CircuitBreakerOptions> = {}) {}

  for(key: string): CircuitBreaker {
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = new CircuitBreaker(this.opts);
      this.breakers.set(key, breaker);
    }
    return breaker;
  }

  states(): Record<string, BreakerState> {
    const out: Record<string, BreakerState> = {};
    for (const [k, b] of this.breakers) out[k] = b.state();
    return out;
  }

  anyOpen(): boolean {
    for (const b of this.breakers.values()) {
      if (b.state() === 'open') return true;
    }
    return false;
  }
}
