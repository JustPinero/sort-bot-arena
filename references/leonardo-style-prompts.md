# Leonardo style prompts for randomized bot portraits

Phase 8 used a single prompt template (`server/src/persona/leonardo.ts buildPortraitPrompt`). Phase 9 picks one of 8 styles via RNG (uniform random per generation), each with its own tuned fragment. First-gen-is-final per product spec — no re-roll, so consistency-per-bot doesn't matter; what matters is that each individual portrait nails its style.

## Model — keep current

Using `b24e16ff-06e3-43eb-8d33-4416c2d75876` (Lucid Origin) for all 8 styles. It handles cinematic concept-art across art directions well enough; switching models per style would multiply cost + complexity for minimal payoff at demo scale.

Locked params (same as today):

```
num_images: 1
width:      512
height:     768
guidance_scale: 7
public:     false
alchemy:    false
```

## Common prompt scaffold

Every prompt has the same skeleton — only the **style block** changes. This keeps language/algorithm anchoring consistent across styles so the same bot still feels like the same fighter.

```
{STYLE_OPENER} robot fighter named "{display_name}"{ALGORITHM_BIT}.
{STYLE_VISUAL_DETAILS}
{STYLE_LIGHTING_AND_SETTING}
Highly detailed, no text, no logos, no watermark.
```

Where `{ALGORITHM_BIT}` is `, themed around {algorithm}` if available, else empty. Same `display_name` as today — sort-bot-api's display_name field.

## The 8 styles

Pick uniform random with `Math.random()` (seedable in tests). Each style ID is also stored on `bot_personas.style` for analytics, even though we don't surface it in the UI yet.

### `steampunk`

```
STYLE_OPENER:        Cinematic 3/4 portrait of a steampunk-inspired
STYLE_VISUAL_DETAILS:
  Brass-plated armor with riveted seams, copper steam pipes coiling
  along the limbs, exposed brass cogs at the joints, a glass pressure
  gauge embedded in the chestplate, dimly glowing filament eyes.
STYLE_LIGHTING_AND_SETTING:
  Standing in a Victorian gas-lit fight hall, warm amber fog drifting
  past wrought iron lattice, dramatic side rim-light from oil lamps,
  weathered industrial palette of brass, copper, and oxblood.
```

### `cyberpunk`

```
STYLE_OPENER:        Cinematic 3/4 portrait of a cyberpunk
STYLE_VISUAL_DETAILS:
  Slick chrome chassis with hot-pink and cyan neon trim,
  holographic visor showing scrolling data, hex-tile carbon-fiber
  panels, glowing fiber-optic cables threading through the spine,
  rain-slick metallic skin.
STYLE_LIGHTING_AND_SETTING:
  Standing in a neon-soaked Tokyo back-alley arena at night,
  reflective wet pavement, kanji signage glowing in the bokeh,
  hard rim-light from a magenta street sign, teal-and-magenta key.
```

### `cartoony`

```
STYLE_OPENER:        Saturday-morning-cartoon portrait of a
STYLE_VISUAL_DETAILS:
  Bold black outlines, exaggerated proportions with oversized
  shoulders and tiny waist, primary-color paint job, shiny rivets
  drawn as stars, smug grin built into the faceplate, mascot
  energy.
STYLE_LIGHTING_AND_SETTING:
  Standing in a brightly lit cartoon arena with cheering geometric
  crowd silhouettes, comic-book speed lines radiating behind the
  bot, halftone dot shading, peppy primary color palette.
```

### `anime`

```
STYLE_OPENER:        Mecha anime key-frame portrait of a
STYLE_VISUAL_DETAILS:
  Gundam-inspired plate armor with sharp panel-line detailing,
  glowing thruster vents, dynamic mid-action stance with one
  shoulder thrust forward, cel-shaded highlights, dramatic
  speed-lines streaking past.
STYLE_LIGHTING_AND_SETTING:
  Standing in a holographic battle dojo, cherry-blossom petals
  drifting through warm sunset light, hard cel-shading with
  saturated reds and yellows, OVA-grade composition.
```

### `classic-battlebot`

```
STYLE_OPENER:        Documentary-style portrait of a competition
STYLE_VISUAL_DETAILS:
  Heavyweight combat robot built from welded steel plates and
  diamond-tread aluminum, a brutal kinetic weapon mounted up front
  (spinner, hammer, or wedge), scuffed paint with sponsorship
  decals, scorched battle scars across the armor.
STYLE_LIGHTING_AND_SETTING:
  Posed in a chain-link arena pit under harsh white floodlights,
  sparks raining behind it, sawdust and debris on the floor,
  utilitarian palette of gunmetal and safety yellow.
```

### `kaiju`

```
STYLE_OPENER:        Monster-movie poster portrait of a kaiju-scale
STYLE_VISUAL_DETAILS:
  Biomechanical hybrid of armor plating and exposed sinew, towering
  silhouette with hunched shoulders, rows of jagged teeth in a
  cooling vent maw, glowing reactor heart visible through cracked
  chestplate.
STYLE_LIGHTING_AND_SETTING:
  Looming over a shattered cityscape at dusk, fires burning at its
  feet, lightning fork in the smoky sky, cinematic low-angle
  composition, deep oranges and bruised purples.
```

### `medieval`

```
STYLE_OPENER:        Heroic-fantasy portrait of an armored knight
STYLE_VISUAL_DETAILS:
  Plate-mail bot with hammered iron pauldrons, heraldic banner
  draped across the chest, glowing rune sigils etched into the
  visor, gauntleted hand resting on a greatsword built into the
  arm assembly.
STYLE_LIGHTING_AND_SETTING:
  Standing in a torchlit stone tournament hall, banners hanging
  from the rafters, warm flickering firelight, oil-painting
  texture, palette of deep red, burnished gold, and shadow.
```

### `retro-arcade`

```
STYLE_OPENER:        Pixel-art arcade-cabinet portrait of a
STYLE_VISUAL_DETAILS:
  Chunky pixel-cluster construction, dithered shading bands, big
  square joints and a CRT-screen face displaying a smug pixel
  expression, vector-style highlight rim, blocky 16-bit aesthetic.
STYLE_LIGHTING_AND_SETTING:
  Standing in a high-score arena framed by glowing CRT scanlines,
  neon green and magenta cabinet lighting, starfield background,
  vaporwave color palette.
```

## Server-side selection logic

Lives in `server/src/persona/leonardo.ts`. Pseudocode:

```ts
const STYLES = [
  'steampunk', 'cyberpunk', 'cartoony', 'anime',
  'classic-battlebot', 'kaiju', 'medieval', 'retro-arcade',
] as const;
type Style = (typeof STYLES)[number];

const PROMPTS: Record<Style, { opener; details; lighting }> = { /* see above */ };

function pickStyle(rng: () => number = Math.random): Style {
  return STYLES[Math.floor(rng() * STYLES.length)]!;
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
```

## Schema impact

`bot_personas` gets a `style` column (TEXT, nullable for legacy rows). New migration `0006_bot_personas_style`:

```sql
ALTER TABLE bot_personas ADD COLUMN style TEXT;
```

`PersonaService.generatePortrait` writes `style` alongside `portrait_url` on success. Persisting it lets us later answer "show me only steampunk fighters" or audit RNG distribution.

## Testing

- `pickStyle` uses a deterministic `rng` injection in unit tests — assert uniform-ish distribution over 8000 calls.
- `buildPortraitPrompt` snapshot test per style asserts the prompt string contains the bot name, algorithm bit (when present), and a style-distinctive token (e.g. "brass-plated", "neon-soaked", "pixel-cluster") so a future copy-edit can't silently drift.
- Live smoke (manual): generate one portrait per style on the deployed server and eyeball the output. ~8 Leonardo credits total.

## Cost note

Lucid Origin generations are roughly 1 credit each at our settings. With aggressive backfill (slice 1.b) firing on every list endpoint with a 3-concurrent semaphore, worst-case for a fresh deploy is `total_bots × 1` credits over the next few minutes of traffic — bounded, recoverable. No re-roll button means we don't burn more than that in steady state.
