import { useParams } from 'react-router-dom';

import { PlaceholderPage } from './PlaceholderPage';

export default function BattlePage() {
  const { battleId } = useParams<{ battleId: string }>();
  return (
    <PlaceholderPage
      title={`Battle ${battleId ?? '—'}`}
      phase={4}
      description="Pre-fight stare-down → live bout → decision graphic. SSE-driven."
    />
  );
}
