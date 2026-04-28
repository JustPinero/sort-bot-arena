import { ChampionBelt } from '@/components/design-system/ChampionBelt';
import { CornerColorBadge } from '@/components/design-system/CornerColorBadge';
import { HazardStripes } from '@/components/design-system/HazardStripes';
import { LEDDisplay } from '@/components/design-system/LEDDisplay';
import { RecordChip } from '@/components/design-system/RecordChip';
import { WeightClassChip } from '@/components/design-system/WeightClassChip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SURFACES = [
  ['surface-0', 'bg-surface-0'],
  ['surface-1', 'bg-surface-1'],
  ['surface-2', 'bg-surface-2'],
  ['surface-3', 'bg-surface-3'],
  ['surface-inset', 'bg-surface-inset'],
] as const;
const ACCENTS = [
  ['hazard', 'bg-hazard'],
  ['combat', 'bg-combat'],
  ['tech', 'bg-tech'],
  ['champion', 'bg-champion'],
  ['victory', 'bg-victory'],
] as const;
const TYPE_SCALE = [
  ['xs', 'text-xs'],
  ['sm', 'text-sm'],
  ['base', 'text-base'],
  ['lg', 'text-lg'],
  ['xl', 'text-xl'],
  ['2xl', 'text-2xl'],
  ['3xl', 'text-3xl'],
  ['4xl', 'text-4xl'],
  ['5xl', 'text-5xl'],
] as const;
const SAMPLE_BOT_IDS = ['bot_a', 'bot_b', 'bot_c', 'bot_d', 'bot_e', 'bot_f', 'bot_g', 'bot_h'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-8">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <HazardStripes thickness="thick" />
        <h1 className="mt-6 font-display text-4xl uppercase tracking-wide">Design System</h1>
        <p className="mt-2 text-text-secondary">
          Dev-only catalog of every token and primitive. Gated by VITE_ENABLE_VISUAL_REGRESSION.
        </p>
      </header>

      <Section title="Surface tiers">
        <div className="grid grid-cols-5 gap-2">
          {SURFACES.map(([name, cls]) => (
            <div key={name} className={`flex h-20 items-end p-2 border ${cls}`}>
              <span className="font-mono text-xs uppercase">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Accent colors">
        <div className="grid grid-cols-5 gap-2">
          {ACCENTS.map(([name, cls]) => (
            <div key={name} className={`flex h-20 items-end p-2 ${cls}`}>
              <span className="font-mono text-xs uppercase text-surface-0">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bot corner palette">
        <div className="flex flex-wrap gap-3">
          {SAMPLE_BOT_IDS.map((id) => (
            <div key={id} className="flex items-center gap-2">
              <CornerColorBadge botId={id} size="lg" />
              <span className="font-mono text-xs">{id}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <ul className="space-y-2">
          {TYPE_SCALE.map(([label, cls]) => (
            <li key={label} className={`${cls} font-display uppercase tracking-wide`}>
              <span className="mr-4 font-mono text-xs lowercase text-text-tertiary">{label}</span>
              The Quick Brown Fox
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="combat">Enter Arena</Button>
          <Button variant="combat-secondary">Decline</Button>
          <Button variant="champion">View Champion</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Retire</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>default</Badge>
          <Badge variant="hazard">hazard</Badge>
          <Badge variant="combat">combat</Badge>
          <Badge variant="champion">#1</Badge>
          <Badge variant="rookie">rookie</Badge>
          <Badge variant="record">12-3-1</Badge>
          <Badge variant="victory">win</Badge>
          <Badge variant="tech">live</Badge>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Default</CardTitle>
            </CardHeader>
            <CardContent>Soft 12px radius — data context.</CardContent>
          </Card>
          <Card variant="fighter" style={{ borderColor: 'var(--corner-1)' }}>
            <CardHeader>
              <CardTitle>Fighter</CardTitle>
            </CardHeader>
            <CardContent>Sharp combat radius — fight-card energy.</CardContent>
          </Card>
          <Card variant="featured">
            <CardHeader>
              <CardTitle>Featured</CardTitle>
            </CardHeader>
            <CardContent>Champion glow — reserved for #1.</CardContent>
          </Card>
        </div>
      </Section>

      <Section title="LED & chips">
        <div className="flex flex-wrap items-center gap-4">
          <LEDDisplay value="0:42" format="time" glow="hazard" label="round timer" />
          <LEDDisplay value="3" format="count" glow="tech" label="rounds" />
          <LEDDisplay value="12.4ms" format="score" glow="champion" label="time" />
          <RecordChip wins={12} losses={3} draws={1} />
          <RecordChip wins={0} losses={0} draws={0} />
          <WeightClassChip language="python" />
          <WeightClassChip language="go" />
          <WeightClassChip language="binary" />
          <ChampionBelt active />
          <ChampionBelt />
        </div>
      </Section>

      <Section title="Animations">
        <div className="grid grid-cols-3 gap-4">
          <div className="grid h-24 place-items-center bg-surface-2">
            <span className="animate-shake font-display text-xl">SHAKE</span>
          </div>
          <div className="grid h-24 place-items-center bg-surface-2">
            <span className="animate-pulse-broadcast font-display text-xl text-tech">LIVE</span>
          </div>
          <div className="grid h-24 place-items-center bg-surface-2">
            <span className="animate-slam-in font-display text-xl text-hazard">SLAM</span>
          </div>
        </div>
      </Section>

      <Section title="Patterns">
        <HazardStripes thickness="thick" className="mb-2 h-6 w-full" />
        <HazardStripes thickness="thin" className="mb-4 h-3 w-full" />
        <div className="grid-bg h-24 w-full" />
      </Section>
    </div>
  );
}
