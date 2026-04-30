// Anthropic Messages API for the bot's trash talk one-liner.

const URL = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5';

export interface AnthropicConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class AnthropicClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly cfg: AnthropicConfig) {
    this.fetchImpl = cfg.fetchImpl ?? ((u, i) => globalThis.fetch(u, i));
  }

  async generateTrashTalk(opts: {
    display_name: string;
    nickname: string;
    language: string;
    algorithm: string | null;
  }): Promise<string> {
    const algoBit = opts.algorithm
      ? `It is built around the algorithm: ${opts.algorithm}.`
      : '';
    const prompt = `You are writing pre-fight smack talk for a sorting-algorithm BattleBots / UFC mashup.

The fighter:
- display_name: ${opts.display_name}
- nickname: "${opts.nickname}"
- language: ${opts.language}
${algoBit}

Write ONE swaggering, taunting one-liner this fighter would say to a rival sorting bot.
- Maximum 110 characters.
- Sounds like a UFC pre-fight callout meets BattleBots taunting.
- May reference sorting / algorithms / data, but must read naturally.
- No surrounding quotes, no preamble, no explanation. Just the line.`;

    const res = await this.fetchImpl(URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.cfg.apiKey,
        'anthropic-version': VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`anthropic ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = body.content?.find((c) => c.type === 'text')?.text;
    if (!text) throw new Error('anthropic: empty content');
    return clean(text);
  }
}

function clean(s: string): string {
  let out = s.trim();
  // Strip surrounding quotes if Claude added them despite instructions.
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1).trim();
  }
  // First line only (defense in depth).
  const nl = out.indexOf('\n');
  if (nl !== -1) out = out.slice(0, nl).trim();
  if (out.length > 140) out = out.slice(0, 137) + '...';
  return out;
}
