import React from 'react';
import { render, cleanup, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DataList } from '@/ui/DataList';

afterEach(cleanup);

const row = ({ item }: { item: string }) => <Text>{item}</Text>;

/**
 * The precedence rule — data > error > empty — written down as tests, because
 * offline caching makes getting it wrong actively harmful: a failed refetch
 * would otherwise blank a list that was working fine a second ago.
 */
describe('DataList state precedence', () => {
  it('surrenders to the error state only when there is nothing to show', async () => {
    await render(<DataList data={[]} error={new Error('boom')} renderItem={row} />);
    expect(screen.queryByTestId('stale-banner')).toBeNull();
  });

  it('KEEPS cached rows when a refetch fails', async () => {
    await render(<DataList data={['Neha Patel']} error={new Error('offline')} renderItem={row} />);
    expect(screen.getByText('Neha Patel')).toBeTruthy();
  });

  it('marks those kept rows as saved data', async () => {
    // Cached-and-failing must never render identically to live.
    await render(<DataList data={['Neha Patel']} error={new Error('offline')} renderItem={row} />);
    expect(screen.getByTestId('stale-banner')).toBeTruthy();
  });

  it('does not mark live rows as stale', async () => {
    await render(<DataList data={['Neha Patel']} renderItem={row} />);
    expect(screen.queryByTestId('stale-banner')).toBeNull();
  });

  it('shows empty — not error — when the gym genuinely has no rows', async () => {
    await render(
      <DataList data={[]} isLoading={false} emptyTitle="No members yet" renderItem={row} />,
    );
    expect(screen.getByText('No members yet')).toBeTruthy();
  });

  it('keeps a screen header alongside the stale banner', async () => {
    // The banner is injected via ListHeaderComponent; it must not displace it.
    await render(
      <DataList
        data={['Neha Patel']}
        error={new Error('offline')}
        ListHeaderComponent={<Text>Members</Text>}
        renderItem={row}
      />,
    );
    expect(screen.getByText('Members')).toBeTruthy();
    expect(screen.getByTestId('stale-banner')).toBeTruthy();
  });
});
