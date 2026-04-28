import { useParams } from 'react-router-dom';

import { PlaceholderPage } from './PlaceholderPage';

export default function PerInputLeaderboardPage() {
  const { inputId } = useParams<{ inputId: string }>();
  return (
    <PlaceholderPage
      title={`Per-Input Rankings — ${inputId ?? '—'}`}
      phase={3}
      description="Ranked by performance on a single input."
    />
  );
}
