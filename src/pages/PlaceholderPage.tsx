interface PlaceholderPageProps {
  title: string;
  phase: number;
  description?: string;
}

export function PlaceholderPage({ title, phase, description }: PlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="hazard-stripes-thin h-2 w-full" aria-hidden="true" />
      <h1 className="mt-6 font-display text-3xl uppercase tracking-wide">{title}</h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-tertiary">
        Phase {phase} — coming soon
      </p>
      {description ? <p className="mt-4 text-text-secondary">{description}</p> : null}
    </section>
  );
}
