import { useParams } from 'react-router-dom';

import { PlaceholderPage } from './PlaceholderPage';

export default function HeadToHeadPage() {
  const { a, b } = useParams<{ a: string; b: string }>();
  return (
    <PlaceholderPage
      title={`${a ?? '?'} vs ${b ?? '?'}`}
      phase={2}
      description="Head-to-head Tale of the Tape with shared-input performance comparison."
    />
  );
}
