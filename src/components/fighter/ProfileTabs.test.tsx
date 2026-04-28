import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ProfileTabs } from './ProfileTabs';

const TABS = [
  { key: 'history' as const, label: 'Fight History', content: <p>HIST</p> },
  { key: 'performance' as const, label: 'Performance', content: <p>PERF</p> },
  { key: 'scouting' as const, label: 'Scouting', content: <p>SCOUT</p> },
  { key: 'achievements' as const, label: 'Achievements', content: <p>ACH</p> },
];

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.search}</output>;
}

describe('<ProfileTabs />', () => {
  it('shows the default tab when no query param is set', () => {
    render(
      <MemoryRouter>
        <ProfileTabs tabs={TABS} />
      </MemoryRouter>,
    );
    expect(screen.getByText('HIST')).toBeVisible();
  });

  it('honors the query param on initial render', () => {
    render(
      <MemoryRouter initialEntries={['/?tab=performance']}>
        <ProfileTabs tabs={TABS} />
      </MemoryRouter>,
    );
    expect(screen.getByText('PERF')).toBeVisible();
  });

  it('writes the param when the tab changes', async () => {
    render(
      <MemoryRouter>
        <ProfileTabs tabs={TABS} />
        <LocationProbe />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('tab', { name: /scouting/i }));
    expect(screen.getByTestId('loc').textContent).toMatch(/tab=scouting/);
  });

  it('falls back to default for an unknown tab param', () => {
    render(
      <MemoryRouter initialEntries={['/?tab=nonsense']}>
        <ProfileTabs tabs={TABS} />
      </MemoryRouter>,
    );
    expect(screen.getByText('HIST')).toBeVisible();
  });
});
