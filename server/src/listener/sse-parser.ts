// Minimal SSE event parser, line-buffered.
//
// Converts a raw byte stream of `event: <type>\ndata: <json>\n\n` frames into
// structured `{ type, data }` objects. Handles fragmented chunks (an event
// boundary may straddle two reads) by buffering until a blank-line terminator
// is seen.
//
// We deliberately keep this in its own file (not inlined in the listener
// or `routes/battles-sse.ts`) so the same parser is unit-testable in
// isolation and can be reused by both the per-battle proxy and the global
// listener. The two consumers differ only in their event-type taxonomies;
// payloads stay opaque (`Record<string, unknown>`) at the parser layer.

export interface ParsedEvent {
  type: string;
  data: Record<string, unknown>;
}

export class SseLineParser {
  private buf = '';
  private pendingType = '';
  private pendingData = '';
  private decoder = new TextDecoder();

  // Append a chunk; returns any complete events that became available.
  push(chunk: Uint8Array | string): ParsedEvent[] {
    const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
    this.buf += text;
    const out: ParsedEvent[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx).replace(/\r$/, '');
      this.buf = this.buf.slice(idx + 1);
      if (line === '') {
        const ev = this.flush();
        if (ev) out.push(ev);
      } else if (line.startsWith('event:')) {
        this.pendingType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        this.pendingData = (this.pendingData ? this.pendingData + '\n' : '') + line.slice(5).trim();
      }
      // Other SSE fields (id:, retry:, comments) are intentionally ignored.
    }
    return out;
  }

  private flush(): ParsedEvent | null {
    const type = this.pendingType;
    const dataStr = this.pendingData;
    this.pendingType = '';
    this.pendingData = '';
    if (!type || !dataStr) return null;
    try {
      const data = JSON.parse(dataStr) as Record<string, unknown>;
      return { type, data };
    } catch {
      return null;
    }
  }
}
