// Generic concurrency-limiting semaphore. Pure (no I/O), unit-testable.
// Used by PersonaService to cap simultaneous Leonardo/Anthropic calls so
// a fresh DB hitting a list endpoint doesn't fan out 50 generations at once.
//
// Behavior:
// - acquire() resolves with a release fn when a slot is free.
// - When at capacity, acquire() queues. Release dequeues the oldest waiter.
// - Queue depth is bounded by maxQueue (default 30). When full, acquire()
//   resolves with `null` so callers can treat it as "drop with warn" rather
//   than throwing.

export const DEFAULT_MAX_QUEUE = 30;

export class Semaphore {
  private inUse = 0;
  private waiters: Array<() => void> = [];
  private readonly maxQueue: number;

  constructor(
    private readonly capacity: number,
    opts?: { maxQueue?: number },
  ) {
    if (capacity < 1) throw new Error('Semaphore capacity must be >= 1');
    this.maxQueue = opts?.maxQueue ?? DEFAULT_MAX_QUEUE;
  }

  // Returns a release fn on success, or `null` when the queue is full.
  async acquire(): Promise<(() => void) | null> {
    if (this.inUse < this.capacity) {
      this.inUse++;
      return () => this.release();
    }
    if (this.waiters.length >= this.maxQueue) {
      return null;
    }
    return new Promise<() => void>((resolve) => {
      this.waiters.push(() => {
        this.inUse++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.inUse--;
    const next = this.waiters.shift();
    if (next) next();
  }

  pendingCount(): number {
    return this.waiters.length;
  }

  inUseCount(): number {
    return this.inUse;
  }
}
