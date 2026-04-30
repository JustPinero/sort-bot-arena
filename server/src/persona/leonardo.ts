// Leonardo.ai REST client for bot portraits. Two-step async flow:
// (1) POST /generations kicks off → returns generationId
// (2) GET /generations/{id} polls until status="COMPLETE" → urls
//
// We never block on (2); the orchestrator schedules the wait as a
// background job so /api/v1/bots POST returns fast.

const BASE = 'https://cloud.leonardo.ai/api/rest/v1';
// Lucid Origin: cheap, fast, good portrait quality.
const MODEL_ID = 'b24e16ff-06e3-43eb-8d33-4416c2d75876';

export interface LeonardoConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface LeonardoGenerationResult {
  generation_id: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  image_url: string | null;
}

export class LeonardoClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly cfg: LeonardoConfig) {
    this.fetchImpl = cfg.fetchImpl ?? ((u, i) => globalThis.fetch(u, i));
  }

  async startGeneration(prompt: string): Promise<{ generation_id: string }> {
    const res = await this.fetchImpl(`${BASE}/generations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.cfg.apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        prompt,
        modelId: MODEL_ID,
        num_images: 1,
        width: 512,
        height: 768,
        guidance_scale: 7,
        public: false,
        alchemy: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`leonardo start ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { sdGenerationJob?: { generationId?: string } };
    const id = body.sdGenerationJob?.generationId;
    if (!id) throw new Error('leonardo start: missing generationId in response');
    return { generation_id: id };
  }

  async getGeneration(id: string): Promise<LeonardoGenerationResult> {
    const res = await this.fetchImpl(`${BASE}/generations/${id}`, {
      headers: {
        authorization: `Bearer ${this.cfg.apiKey}`,
        accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`leonardo poll ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      generations_by_pk?: {
        status?: string;
        generated_images?: Array<{ url?: string }>;
      };
    };
    const gen = body.generations_by_pk;
    const upstreamStatus = (gen?.status ?? 'PENDING').toUpperCase();
    let status: LeonardoGenerationResult['status'] = 'PENDING';
    if (upstreamStatus === 'COMPLETE') status = 'COMPLETE';
    else if (upstreamStatus === 'FAILED') status = 'FAILED';
    const image_url = gen?.generated_images?.[0]?.url ?? null;
    return { generation_id: id, status, image_url };
  }
}

export function buildPortraitPrompt(opts: {
  display_name: string;
  language: string;
  algorithm?: string | null;
}): string {
  const lang = opts.language;
  const algoBit = opts.algorithm ? ` themed around ${opts.algorithm}` : '';
  return [
    `Cinematic 3/4 portrait of a futuristic mech-style robot fighter named "${opts.display_name}"${algoBit}.`,
    `Inspired by ${lang} programming aesthetics — sleek armor, glowing visor, weathered battle-scars.`,
    `Standing in a darkened arena, dramatic rim lighting, low-key teal-and-orange color palette.`,
    `Highly detailed concept art, 8k, no text, no logos, no watermark.`,
  ].join(' ');
}
