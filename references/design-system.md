# sort-arena-web — Design Tokens & Visual System

> The single source of truth for color, typography, spacing, motion, and component aesthetics across the frontend. The actual implementation lives in `src/styles/tokens.css` and `tailwind.config.ts`, both included verbatim at the end of this document.

## Design philosophy

**The reference is BattleBots × UFC.** Industrial, broadcast-quality, slightly grimy. Two fighters meet in an arena. Stats matter. Records matter. The production values are themselves the product. Every visual decision asks: *would this look at home on a Saturday night Pay-Per-View graphic?*

**Three guiding principles:**

1. **Sharp where it matters, soft where it reads.** Combat surfaces (fight cards, KO graphics, arena panels) take zero radius — they read as forged metal. Data surfaces (leaderboard rows, profile cards, settings panels) take soft 8px radius — they read as polished broadcast consoles. The contrast between them is itself a design signal.

2. **Earn every glow.** Shadows don't render on dark backgrounds. Emphasis comes from colored borders and outer-glow drop-shadows in accent colors. A glow means "this is hot." Use sparingly — when everything glows, nothing does.

3. **Champion gold is sacred.** Reserved exclusively for the #1 ranked bot, championship belts, and all-time records. Never used decoratively. When you see gold, you know something extraordinary is happening.

---

## Color system

### Surface tiers (dark mode)

```
--surface-0:  #0a0a0a   /* page background — pitch black with subtle grid overlay */
--surface-1:  #171717   /* primary panels — fighter cards, leaderboard rows */
--surface-2:  #1f1f1f   /* elevated panels — modals, popovers, tooltips */
--surface-3:  #262626   /* deepest emphasis — featured cards, active selection */
--surface-inset: #0d0d0d /* insets — code editor, scoreboard frames */
```

### Surface tiers (light mode — data pages only)

Light mode applies to data-heavy routes (`/leaderboard`, `/bots/:id`, `/stats`, `/tournaments` list). Combat routes (`/arena`, `/arena/:battleId`, `/submit`, KO graphics) are always dark — the broadcast metaphor demands it.

```
--surface-0:  #fafaf9   /* page background — warm off-white */
--surface-1:  #ffffff   /* primary panels */
--surface-2:  #f5f5f4   /* elevated panels */
--surface-3:  #e7e5e4   /* deepest emphasis */
--surface-inset: #1c1917 /* insets stay dark even in light mode (code, scoreboards) */
```

### Border colors

Borders never use blue-grey. Always warm-grey to keep the industrial feel.

```
/* dark mode */
--border-default:    #262626
--border-emphasis:   #404040
--border-strong:     #525252

/* light mode */
--border-default:    #e7e5e4
--border-emphasis:   #d6d3d1
--border-strong:     #a8a29e
```

### Text colors

```
/* dark mode */
--text-primary:     #fafaf9   /* default body text */
--text-secondary:   #a3a3a3   /* labels, secondary info */
--text-tertiary:    #737373   /* captions, metadata */
--text-disabled:    #525252

/* light mode */
--text-primary:     #1c1917
--text-secondary:   #57534e
--text-tertiary:    #78716c
--text-disabled:    #a8a29e
```

### Combat accent colors

These are the heart of the system. Used identically in both light and dark modes (they're vibrant enough to work on both).

```
--hazard-yellow:    #facc15   /* primary CTA, warning, hazard stripes, "live" */
--combat-red:       #dc2626   /* KOs, losses, danger, "fighter in trouble" */
--tech-cyan:        #06b6d4   /* live data, telemetry, broadcast overlays */
--champion-gold:    #fbbf24   /* RESERVED: #1 rank, belts, all-time records */
--victory-green:    #22c55e   /* wins, success states, positive deltas */
```

**Tinted variants** (used for muted backgrounds with these colors as accents):

```
--hazard-yellow-bg:    rgba(250, 204, 21, 0.08)
--combat-red-bg:       rgba(220, 38, 38, 0.08)
--tech-cyan-bg:        rgba(6, 182, 212, 0.10)
--champion-gold-bg:    rgba(251, 191, 36, 0.10)
--victory-green-bg:    rgba(34, 197, 94, 0.08)
```

### Bot corner colors

Each bot gets a deterministic personal accent color via hash-modulo on `bot.id`. Used for "red corner / blue corner" energy across the app — same bot always has the same color. Pool of 8 distinct combat-flavored colors:

```
--corner-1:  #ef4444   /* fire red */
--corner-2:  #06b6d4   /* tech cyan */
--corner-3:  #84cc16   /* radioactive green */
--corner-4:  #a855f7   /* electric violet */
--corner-5:  #f97316   /* warning orange */
--corner-6:  #ec4899   /* hot pink */
--corner-7:  #14b8a6   /* arctic teal */
--corner-8:  #fbbf24   /* hazard amber */
```

```ts
// src/lib/cornerColor.ts
export function cornerColor(botId: string): string {
  let hash = 0;
  for (let i = 0; i < botId.length; i++) {
    hash = ((hash << 5) - hash) + botId.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % 8;
  return `var(--corner-${idx + 1})`;
}
```

---

## Typography

### Three-font system

**Display (Bebas Neue)** — nicknames, fight callouts, scoreboards, the dramatic moments.

```
font-family: 'Bebas Neue', system-ui, sans-serif;
font-weight: 400; /* Bebas Neue is single-weight by design */
letter-spacing: 0.02em; /* slight track for legibility at large sizes */
```

**Body (Inter)** — everything readable, all UI chrome.

```
font-family: 'Inter', system-ui, -apple-system, sans-serif;
font-feature-settings: "cv11", "ss01", "ss03"; /* alternate forms for cleaner i/I distinction */
```

For all numerical UI (stat cards, leaderboard, records), apply `font-feature-settings: "tnum"` so numerals have equal width — the leaderboard rank changes don't shift columns.

**Monospace (JetBrains Mono)** — code editor, telemetry, structured data.

```
font-family: 'JetBrains Mono', 'Menlo', monospace;
font-feature-settings: "tnum", "calt";
```

**Optional 4th font: DSEG7 Classic** for true segment-display look on live timers and scores. Free at https://www.keshikan.net/fonts-e.html. If included, scope to `.led-display` class only — overuse breaks the typographic hierarchy.

### Type scale

```
text-xs:    12px / 16px line-height  /* metadata, captions */
text-sm:    14px / 20px              /* secondary UI */
text-base:  16px / 24px              /* default body */
text-lg:    18px / 28px              /* emphasized body */
text-xl:    24px / 32px              /* card titles */
text-2xl:   32px / 40px              /* page titles, scoreboards */
text-3xl:   48px / 56px              /* nicknames, fight headers */
text-4xl:   72px / 80px              /* dramatic moments */
text-5xl:   96px / 100px             /* KO graphics, championship reveals */
```

The 72px and 96px sizes exist *specifically* for the moments that need to dominate the screen. Don't use them on regular pages.

### Type recipes — combat-specific treatments

The aesthetic relies on a few consistent text patterns:

**Fight callout** (used in pre-fight title cards, KO graphics, championship banners):
```css
font-family: 'Bebas Neue';
font-size: 96px;
line-height: 1;
letter-spacing: 0.04em;
text-transform: uppercase;
color: var(--text-primary);
text-shadow: 0 0 40px rgba(250, 204, 21, 0.4);
```

**Nickname display** (Tale of the Tape, profile hero):
```css
font-family: 'Bebas Neue';
font-size: 48px;
line-height: 1.1;
letter-spacing: 0.02em;
text-transform: uppercase;
```

**Stat label** (under records, above values):
```css
font-family: 'Inter';
font-size: 11px;
font-weight: 500;
letter-spacing: 0.16em;
text-transform: uppercase;
color: var(--text-tertiary);
```

**LED scoreboard** (live timers, round counters, current scores):
```css
font-family: 'JetBrains Mono', monospace;
/* OR: font-family: 'DSEG7 Classic Mini', monospace; */
font-feature-settings: "tnum";
font-size: 32px;
font-weight: 700;
letter-spacing: 0.02em;
color: var(--hazard-yellow);
text-shadow: 0 0 12px rgba(250, 204, 21, 0.6);
```

**Record chip** (W-L-D display):
```css
font-family: 'JetBrains Mono';
font-size: 14px;
font-weight: 700;
font-feature-settings: "tnum";
letter-spacing: 0.05em;
```

---

## Spacing scale

Standard 4px-grid system. Use these tokens — never raw pixel values.

```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   24px
--space-6:   32px
--space-8:   48px
--space-10:  64px
--space-12:  96px
--space-16:  128px
```

Component-internal padding and gaps use 8/12/16px. Section spacing uses 32/48/64px. Page-level breathing room uses 96/128px. The arena page specifically uses tighter spacing (24px page padding) to maximize the broadcast-feed feel.

---

## Border radius — the mixed system

This is the design's most distinctive token decision. Two radius scales, applied based on surface intent.

### Combat surfaces — sharp (zero radius)

Used on: arena page panels, fight cards, KO graphics, scoreboards, championship overlays, stat slam-ins, hazard-bordered elements.

```
--radius-combat: 0
```

### Data surfaces — soft

Used on: leaderboard rows, profile cards, settings panels, modals, dropdowns, buttons (in data contexts), input fields.

```
--radius-sm:    4px   /* small chips, tags, badges */
--radius-md:    8px   /* default — buttons, inputs, dropdowns */
--radius-lg:    12px  /* cards, panels */
--radius-xl:    16px  /* hero cards, featured items */
--radius-full:  9999px /* pills, avatars */
```

**Practical rule:** if the component represents a fighter, a fight, a moment of combat, or a status state — sharp. If it represents data ABOUT those things (a row in a list, a setting, a navigation element) — soft.

---

## Border weights

```
--border-1:  1px   /* default */
--border-2:  2px   /* emphasized panels, hover states */
--border-4:  4px   /* combat panels, KO graphics, championship borders */
```

Hazard stripes use a custom diagonal-pattern background, not borders. See *Patterns* below.

---

## Motion

### Timing

```
--motion-snap:    100ms   /* hover states, button presses */
--motion-quick:   200ms   /* state changes, simple transitions */
--motion-smooth:  400ms   /* page transitions, modal opens */
--motion-dramatic: 600ms  /* KO graphics, scorecard slam-ins, championship reveals */
```

### Easing

```
--ease-snap:      cubic-bezier(0.5, 0, 0.1, 1)     /* sharper exit — "broadcast graphic SLAM" */
--ease-out:       cubic-bezier(0.16, 1, 0.3, 1)    /* default for entrances */
--ease-in:        cubic-bezier(0.7, 0, 0.84, 0)    /* default for exits */
--ease-bounce:    cubic-bezier(0.68, -0.55, 0.27, 1.55) /* dramatic moments only */
```

### Animation primitives

These get implemented as Framer Motion variants in `src/lib/motion.ts`:

- **slamIn**: scale 1.4 → 1, opacity 0 → 1, ease-snap, 400ms. Used for stat overlays during fights.
- **shake**: x ±8px four times in 200ms. Used for damage reactions.
- **walkout**: translateX from offscreen, ease-out, 600ms. Used for fighter entrances.
- **knockout**: scale 1 → 1.2 with red flash, then fade. 600ms total. Used for KO graphics.
- **pulse**: scale 1 ↔ 1.04, opacity 1 ↔ 0.7, infinite. Used for "live" indicators.
- **glow-cycle**: box-shadow color animates between accent colors at 2s interval. Used for #1 rank emphasis.

### Hover and focus

Every interactive element gets:
- 100ms transition on background, border, color
- 2px accent-colored outline on focus (no rounded outlines on sharp elements — use box-shadow inset)
- `transform: scale(0.98)` on click for tactile feedback

---

## Shadows and glows

Traditional drop shadows don't read on the dark base. Emphasis comes from colored glows.

```
--glow-hazard:     0 0 24px rgba(250, 204, 21, 0.30)
--glow-combat:     0 0 24px rgba(220, 38, 38, 0.30)
--glow-tech:       0 0 24px rgba(6, 182, 212, 0.35)
--glow-champion:   0 0 32px rgba(251, 191, 36, 0.45)
--glow-victory:    0 0 20px rgba(34, 197, 94, 0.30)

/* For light mode — use real shadows */
--shadow-sm:       0 1px 2px rgba(0,0,0,0.05)
--shadow-md:       0 4px 8px rgba(0,0,0,0.08)
--shadow-lg:       0 12px 24px rgba(0,0,0,0.12)
```

Glows are reserved for *active* or *featured* state. A button doesn't glow on hover; a button glows when it's the primary action on a fight-night card.

---

## Patterns

### Hazard stripes

The recurring motif. Used as section dividers, warning state borders, and decorative accents on the home page hero.

```css
.hazard-stripes {
  background-image: repeating-linear-gradient(
    -45deg,
    var(--hazard-yellow) 0px,
    var(--hazard-yellow) 16px,
    #0a0a0a 16px,
    #0a0a0a 32px
  );
}

.hazard-stripes-thin {
  background-image: repeating-linear-gradient(
    -45deg,
    var(--hazard-yellow) 0px,
    var(--hazard-yellow) 8px,
    #0a0a0a 8px,
    #0a0a0a 16px
  );
}
```

Two thicknesses: thick (32px period) for full dividers, thin (16px period) for accents within components.

### Grid overlay (background texture)

Pure SVG repeating pattern for the page background. Subtle — 4% opacity. Catches the eye only on close inspection.

```css
.grid-bg {
  background-color: var(--surface-0);
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### Scan lines (arena page only)

For the broadcast-feed feel on combat surfaces. Apply sparingly — only on `/arena` and `/arena/:battleId`. Heavy elsewhere kills readability.

```css
.scan-lines {
  position: relative;
}
.scan-lines::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    180deg,
    transparent 0px,
    transparent 2px,
    rgba(0,0,0,0.10) 2px,
    rgba(0,0,0,0.10) 3px
  );
  mix-blend-mode: multiply;
}
```

---

## Component-level tokens

### Buttons

Three flavors mapped to combat semantics.

**Primary action (combat).** Hazard yellow background, black text, sharp corners, glow on hover, scale-0.98 on press. Used for: "FIGHT," "SUBMIT BOT," "ENTER ARENA."

```
height: 48px
padding: 0 24px
background: var(--hazard-yellow)
color: #0a0a0a
font: 'Bebas Neue', 24px, letter-spacing 0.04em, uppercase
border-radius: 0 (combat surface)
hover: box-shadow var(--glow-hazard), transform translateY(-1px)
active: transform scale(0.98)
```

**Secondary action.** Transparent background, white text, 1px border in `--border-emphasis`, soft 8px corners. Used for normal navigation, secondary actions.

```
height: 40px
padding: 0 16px
background: transparent
color: var(--text-primary)
border: 1px solid var(--border-emphasis)
border-radius: 8px
hover: background var(--surface-2), border-color var(--text-secondary)
```

**Destructive action.** Combat red border + text on transparent, fills on hover. Used for delete, retire, decline.

### Cards

**Fighter card (Tale of the Tape).** Sharp combat surface. Black background, 4px border in the bot's corner color, hazard stripe header strip. The card IS the broadcast graphic.

**Profile card (data context).** Soft 12px radius, surface-1 background, 1px border. Standard data presentation.

**Featured card.** Soft 16px radius, gold-tinted border, champion glow shadow. Reserved for #1 rank, current champion, headline matchups.

### Chips (W-L-D, weight class, achievements)

```
height: 24px
padding: 0 10px
font: JetBrains Mono, 12px, weight 700, tracking 0.05em, uppercase
border-radius: 4px (data context) or 0 (combat context)
display: inline-flex, gap: 6px
```

Variants by semantic color: default (surface-2 bg, text-primary), success (victory-green-bg, victory-green text), danger (combat-red-bg, combat-red text), highlight (hazard-yellow-bg, hazard-yellow text), champion (champion-gold-bg, champion-gold text + glow).

### LED scoreboard frame

```css
.led-frame {
  background: var(--surface-inset);
  border: 2px solid var(--border-strong);
  padding: 12px 20px;
  border-radius: 0;
  box-shadow:
    inset 0 0 24px rgba(0,0,0,0.6),
    inset 0 1px 0 rgba(255,255,255,0.05);
}
```

Inset shadow gives the recessed-display feel. The contents (timer, score) glow outward via text-shadow.

---

## Page-level theming policy

| Route pattern | Theme behavior |
|---|---|
| `/arena`, `/arena/:battleId` | Force dark, scan-lines enabled |
| `/submit`, `/debut` | Force dark, no scan-lines |
| `/leaderboard`, `/leaderboard/*` | Respect system preference |
| `/bots/:id`, `/bots/:id/*` | Respect system preference |
| `/tournaments`, `/tournaments/:id` | Respect system preference (data); dark when bracket is "live" |
| `/stats`, `/events` | Respect system preference |
| `/` (home) | Force dark — the homepage IS the broadcast feed |

Implementation: a small `<ThemeContext>` reads system preference, but pages with `forceTheme="dark"` prop on their layout override it for that route only.

---

## File structure

```
src/styles/
├── tokens.css           # all CSS custom properties
├── fonts.css            # @font-face for Bebas Neue, Inter, JetBrains Mono
├── globals.css          # body resets, default text styles
├── patterns.css         # hazard-stripes, grid-bg, scan-lines utilities
└── animations.css       # keyframes for shake, slamIn, etc. (Framer Motion handles most)

src/lib/
├── cornerColor.ts       # deterministic bot color hash
├── motion.ts            # Framer Motion variants
└── theme.ts             # theme context + forced-theme hooks
```

---

## Implementation: tokens.css

```css
/* src/styles/tokens.css */

:root {
  /* dark mode is default — light mode overrides below */

  /* surfaces */
  --surface-0: #0a0a0a;
  --surface-1: #171717;
  --surface-2: #1f1f1f;
  --surface-3: #262626;
  --surface-inset: #0d0d0d;

  /* borders */
  --border-default: #262626;
  --border-emphasis: #404040;
  --border-strong: #525252;

  /* text */
  --text-primary: #fafaf9;
  --text-secondary: #a3a3a3;
  --text-tertiary: #737373;
  --text-disabled: #525252;

  /* combat accents (mode-invariant) */
  --hazard-yellow: #facc15;
  --combat-red: #dc2626;
  --tech-cyan: #06b6d4;
  --champion-gold: #fbbf24;
  --victory-green: #22c55e;

  /* tinted backgrounds */
  --hazard-yellow-bg: rgba(250, 204, 21, 0.08);
  --combat-red-bg: rgba(220, 38, 38, 0.08);
  --tech-cyan-bg: rgba(6, 182, 212, 0.10);
  --champion-gold-bg: rgba(251, 191, 36, 0.10);
  --victory-green-bg: rgba(34, 197, 94, 0.08);

  /* corner colors */
  --corner-1: #ef4444;
  --corner-2: #06b6d4;
  --corner-3: #84cc16;
  --corner-4: #a855f7;
  --corner-5: #f97316;
  --corner-6: #ec4899;
  --corner-7: #14b8a6;
  --corner-8: #fbbf24;

  /* spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --space-10: 64px;
  --space-12: 96px;
  --space-16: 128px;

  /* radius */
  --radius-combat: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* borders */
  --border-1: 1px;
  --border-2: 2px;
  --border-4: 4px;

  /* motion */
  --motion-snap: 100ms;
  --motion-quick: 200ms;
  --motion-smooth: 400ms;
  --motion-dramatic: 600ms;
  --ease-snap: cubic-bezier(0.5, 0, 0.1, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.27, 1.55);

  /* glows (dark mode emphasis) */
  --glow-hazard: 0 0 24px rgba(250, 204, 21, 0.30);
  --glow-combat: 0 0 24px rgba(220, 38, 38, 0.30);
  --glow-tech: 0 0 24px rgba(6, 182, 212, 0.35);
  --glow-champion: 0 0 32px rgba(251, 191, 36, 0.45);
  --glow-victory: 0 0 20px rgba(34, 197, 94, 0.30);
}

/* light mode override — only applies on data routes */
[data-theme="light"] {
  --surface-0: #fafaf9;
  --surface-1: #ffffff;
  --surface-2: #f5f5f4;
  --surface-3: #e7e5e4;
  /* surface-inset stays dark even in light mode (code/scoreboards) */

  --border-default: #e7e5e4;
  --border-emphasis: #d6d3d1;
  --border-strong: #a8a29e;

  --text-primary: #1c1917;
  --text-secondary: #57534e;
  --text-tertiary: #78716c;
  --text-disabled: #a8a29e;

  /* shadows replace glows in light mode */
  --glow-hazard: 0 4px 12px rgba(250, 204, 21, 0.25);
  --glow-combat: 0 4px 12px rgba(220, 38, 38, 0.25);
  --glow-tech: 0 4px 12px rgba(6, 182, 212, 0.25);
  --glow-champion: 0 6px 20px rgba(251, 191, 36, 0.35);
  --glow-victory: 0 4px 12px rgba(34, 197, 94, 0.25);
}

/* Forced dark — used on combat routes regardless of preference */
[data-theme="force-dark"] {
  /* explicitly re-asserts dark values to override system preference */
  color-scheme: dark;
}
```

---

## Implementation: tailwind.config.ts

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          inset: 'var(--surface-inset)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          emphasis: 'var(--border-emphasis)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
        },
        hazard: {
          DEFAULT: 'var(--hazard-yellow)',
          bg: 'var(--hazard-yellow-bg)',
        },
        combat: {
          DEFAULT: 'var(--combat-red)',
          bg: 'var(--combat-red-bg)',
        },
        tech: {
          DEFAULT: 'var(--tech-cyan)',
          bg: 'var(--tech-cyan-bg)',
        },
        champion: {
          DEFAULT: 'var(--champion-gold)',
          bg: 'var(--champion-gold-bg)',
        },
        victory: {
          DEFAULT: 'var(--victory-green)',
          bg: 'var(--victory-green-bg)',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        led: ['DSEG7 Classic Mini', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '28px'],
        xl: ['24px', '32px'],
        '2xl': ['32px', '40px'],
        '3xl': ['48px', '56px'],
        '4xl': ['72px', '80px'],
        '5xl': ['96px', '100px'],
      },
      letterSpacing: {
        tight: '-0.02em',
        normal: '0',
        wide: '0.02em',
        wider: '0.04em',
        widest: '0.16em',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      borderRadius: {
        combat: 'var(--radius-combat)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      borderWidth: {
        DEFAULT: 'var(--border-1)',
        2: 'var(--border-2)',
        4: 'var(--border-4)',
      },
      transitionTimingFunction: {
        snap: 'var(--ease-snap)',
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        bounce: 'var(--ease-bounce)',
      },
      transitionDuration: {
        snap: 'var(--motion-snap)',
        quick: 'var(--motion-quick)',
        smooth: 'var(--motion-smooth)',
        dramatic: 'var(--motion-dramatic)',
      },
      boxShadow: {
        'glow-hazard': 'var(--glow-hazard)',
        'glow-combat': 'var(--glow-combat)',
        'glow-tech': 'var(--glow-tech)',
        'glow-champion': 'var(--glow-champion)',
        'glow-victory': 'var(--glow-victory)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        },
        'slam-in': {
          '0%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'glow-cycle': {
          '0%, 100%': { boxShadow: '0 0 24px rgba(251, 191, 36, 0.45)' },
          '50%': { boxShadow: '0 0 32px rgba(250, 204, 21, 0.55)' },
        },
      },
      animation: {
        shake: 'shake 200ms var(--ease-snap)',
        pulse: 'pulse 2s var(--ease-in) infinite',
        'slam-in': 'slam-in 400ms var(--ease-snap) forwards',
        'glow-cycle': 'glow-cycle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
} satisfies Config;
```

---

## shadcn integration

shadcn components are imported and themed via the CSS variables above. The `globals.css` should include:

```css
@layer base {
  :root {
    /* shadcn maps to our tokens */
    --background: var(--surface-0);
    --foreground: var(--text-primary);
    --card: var(--surface-1);
    --card-foreground: var(--text-primary);
    --popover: var(--surface-2);
    --popover-foreground: var(--text-primary);
    --primary: var(--hazard-yellow);
    --primary-foreground: #0a0a0a;
    --secondary: var(--surface-2);
    --secondary-foreground: var(--text-primary);
    --muted: var(--surface-2);
    --muted-foreground: var(--text-secondary);
    --accent: var(--tech-cyan);
    --accent-foreground: #0a0a0a;
    --destructive: var(--combat-red);
    --destructive-foreground: var(--text-primary);
    --border: var(--border-default);
    --input: var(--border-default);
    --ring: var(--hazard-yellow);
    --radius: 8px;
  }
}
```

**Components that need custom variants beyond shadcn defaults:**
- `Button` — add `variant="combat"` (the hazard-yellow primary), `variant="combat-secondary"` (outlined hazard), `variant="champion"` (gold glow).
- `Card` — add `variant="fighter"` (sharp corners, corner-color border, hazard-stripe header), `variant="featured"` (gold-tinted, glow-champion shadow).
- `Badge` — add `variant="hazard"`, `variant="combat"`, `variant="champion"`, `variant="rookie"`, plus the `record` variant (mono font, tabular numerals).

---

## Quick reference cheat sheet

| Need | Token | Tailwind class |
|---|---|---|
| Page background | `--surface-0` | `bg-surface-0` |
| Card background | `--surface-1` | `bg-surface-1` |
| Default text | `--text-primary` | `text-text-primary` |
| Muted text | `--text-secondary` | `text-text-secondary` |
| Primary CTA | `--hazard-yellow` | `bg-hazard text-surface-0` |
| Live indicator | `--tech-cyan` | `text-tech` |
| Champion accent | `--champion-gold` | `text-champion` |
| Combat panel radius | 0 | `rounded-combat` |
| Data panel radius | 8/12px | `rounded-md` / `rounded-lg` |
| Nickname | Bebas Neue 48px | `font-display text-3xl tracking-wide uppercase` |
| Stat label | Inter 11px | `font-sans text-xs tracking-widest uppercase text-text-tertiary` |
| Live timer | JetBrains Mono | `font-mono text-2xl text-hazard` (with glow text-shadow) |
| Hover transition | 100ms snap | `transition-all duration-snap ease-snap` |
| Slam-in stat overlay | 400ms slam | `animate-slam-in` |
| KO graphic glow | hazard glow | `shadow-glow-hazard` |
| Champion border | gold + cycle | `border-champion shadow-glow-champion animate-glow-cycle` |

---

## Final notes

- **Test the design in motion.** The static screenshots will look fine. The tokens earn their keep when the slam-ins and shakes and glows fire in sequence. Build the LED scoreboard component first; if it doesn't immediately read as "broadcast graphic," the typography or the glow values need adjustment.
- **Resist adding new accent colors.** Five combat colors plus eight corner colors is already a lot. Every additional color dilutes the meaning of the existing ones.
- **Champion gold goes last.** Build the entire UI in dark + hazard + combat + tech + victory before adding champion gold anywhere. When you finally introduce it, it should feel earned.
- **The light mode is for the daytime user.** Don't try to make the arena page look good in light mode — it isn't supposed to. Light mode is for the leaderboard scroll on a Tuesday afternoon at the office.
