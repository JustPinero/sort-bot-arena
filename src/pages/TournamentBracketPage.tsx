import { useParams } from 'react-router-dom';

import { PlaceholderPage } from './PlaceholderPage';

export default function TournamentBracketPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <PlaceholderPage
      title={`Tournament ${id ?? '—'}`}
      phase={5}
      description="UFC fight-card bracket with live SSE-driven advancement."
    />
  );
}
