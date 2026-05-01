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

// --- Phase 9 / Slice 2 — 8-style portrait pool -------------------------
// Pick uniform random per generation. Each style ID is also persisted on
// `bot_personas.style` for analytics. Fragments are copied verbatim from
// references/leonardo-style-prompts.md — that doc is the source of truth.

export const STYLES = [
  'steampunk',
  'cyberpunk',
  'cartoony',
  'anime',
  'classic-battlebot',
  'kaiju',
  'medieval',
  'retro-arcade',
] as const;

export type Style = (typeof STYLES)[number];

interface StylePrompt {
  opener: string;
  details: string;
  lighting: string;
}

export const PROMPTS: Record<Style, StylePrompt> = {
  steampunk: {
    opener: 'Cinematic 3/4 portrait of a steampunk-inspired',
    details:
      'Brass-plated armor with riveted seams, copper steam pipes coiling along the limbs, exposed brass cogs at the joints, a glass pressure gauge embedded in the chestplate, dimly glowing filament eyes.',
    lighting:
      'Standing in a Victorian gas-lit fight hall, warm amber fog drifting past wrought iron lattice, dramatic side rim-light from oil lamps, weathered industrial palette of brass, copper, and oxblood.',
  },
  cyberpunk: {
    opener: 'Cinematic 3/4 portrait of a cyberpunk',
    details:
      'Slick chrome chassis with hot-pink and cyan neon trim, holographic visor showing scrolling data, hex-tile carbon-fiber panels, glowing fiber-optic cables threading through the spine, rain-slick metallic skin.',
    lighting:
      'Standing in a neon-soaked Tokyo back-alley arena at night, reflective wet pavement, kanji signage glowing in the bokeh, hard rim-light from a magenta street sign, teal-and-magenta key.',
  },
  cartoony: {
    opener: 'Saturday-morning-cartoon portrait of a',
    details:
      'Bold black outlines, exaggerated proportions with oversized shoulders and tiny waist, primary-color paint job, shiny rivets drawn as stars, smug grin built into the faceplate, mascot energy.',
    lighting:
      'Standing in a brightly lit cartoon arena with cheering geometric crowd silhouettes, comic-book speed lines radiating behind the bot, halftone dot shading, peppy primary color palette.',
  },
  anime: {
    opener: 'Mecha anime key-frame portrait of a',
    details:
      'Gundam-inspired plate armor with sharp panel-line detailing, glowing thruster vents, dynamic mid-action stance with one shoulder thrust forward, cel-shaded highlights, dramatic speed-lines streaking past.',
    lighting:
      'Standing in a holographic battle dojo, cherry-blossom petals drifting through warm sunset light, hard cel-shading with saturated reds and yellows, OVA-grade composition.',
  },
  'classic-battlebot': {
    opener: 'Documentary-style portrait of a competition',
    details:
      'Heavyweight combat robot built from welded steel plates and diamond-tread aluminum, a brutal kinetic weapon mounted up front (spinner, hammer, or wedge), scuffed paint with sponsorship decals, scorched battle scars across the armor.',
    lighting:
      'Posed in a chain-link arena pit under harsh white floodlights, sparks raining behind it, sawdust and debris on the floor, utilitarian palette of gunmetal and safety yellow.',
  },
  kaiju: {
    opener: 'Monster-movie poster portrait of a kaiju-scale',
    details:
      'Biomechanical hybrid of armor plating and exposed sinew, towering silhouette with hunched shoulders, rows of jagged teeth in a cooling vent maw, glowing reactor heart visible through cracked chestplate.',
    lighting:
      'Looming over a shattered cityscape at dusk, fires burning at its feet, lightning fork in the smoky sky, cinematic low-angle composition, deep oranges and bruised purples.',
  },
  medieval: {
    opener: 'Heroic-fantasy portrait of an armored knight',
    details:
      'Plate-mail bot with hammered iron pauldrons, heraldic banner draped across the chest, glowing rune sigils etched into the visor, gauntleted hand resting on a greatsword built into the arm assembly.',
    lighting:
      'Standing in a torchlit stone tournament hall, banners hanging from the rafters, warm flickering firelight, oil-painting texture, palette of deep red, burnished gold, and shadow.',
  },
  'retro-arcade': {
    opener: 'Pixel-art arcade-cabinet portrait of a',
    details:
      'Chunky pixel-cluster construction, dithered shading bands, big square joints and a CRT-screen face displaying a smug pixel expression, vector-style highlight rim, blocky 16-bit aesthetic.',
    lighting:
      'Standing in a high-score arena framed by glowing CRT scanlines, neon green and magenta cabinet lighting, starfield background, vaporwave color palette.',
  },
};

export function pickStyle(rng: () => number = Math.random): Style {
  const i = Math.floor(rng() * STYLES.length);
  // Defensive: clamp in case rng() returns 1.0 exactly.
  return STYLES[Math.min(i, STYLES.length - 1)]!;
}

export function buildPortraitPrompt(opts: {
  display_name: string;
  language: string;
  algorithm?: string | null;
  style?: Style;
}): { prompt: string; style: Style } {
  const style = opts.style ?? pickStyle();
  const p = PROMPTS[style];
  const algoBit = opts.algorithm ? `, themed around ${opts.algorithm}` : '';
  const prompt =
    `${p.opener} robot fighter named "${opts.display_name}"${algoBit}. ` +
    `${p.details} ${p.lighting} ` +
    `Highly detailed, no text, no logos, no watermark.`;
  return { prompt, style };
}
