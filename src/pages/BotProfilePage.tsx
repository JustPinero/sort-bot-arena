import { useParams } from 'react-router-dom';

import { PlaceholderPage } from './PlaceholderPage';

export default function BotProfilePage() {
  const { botId } = useParams<{ botId: string }>();
  return (
    <PlaceholderPage
      title={`Bot ${botId ?? '—'}`}
      phase={2}
      description="Tale of the Tape hero + tabs for Fight History / Performance / Scouting Report / Achievements."
    />
  );
}
