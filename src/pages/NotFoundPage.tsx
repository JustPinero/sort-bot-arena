import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-text-tertiary">404</p>
      <h1 className="mt-2 font-display text-4xl uppercase tracking-wide">
        Fighter not in the database
      </h1>
      <p className="mt-4 text-text-secondary">That route was never registered. Try the rankings.</p>
      <Button variant="combat" asChild className="mt-8">
        <Link to="/leaderboard">Back to Rankings</Link>
      </Button>
    </section>
  );
}
