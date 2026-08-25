import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider } from '../auth/SessionProvider';
import { Can, PlanGate } from '../rbac/Gate';
import { Text } from '../components/ui/text';
import * as store from '../auth/session-store';
import type { Session } from '../auth/types';

function makeSession(role: string, plan?: string): Session {
  return {
    user: { id: 'u1', email: 'a@b.c', full_name: 'A', role, branch_ids: [] },
    studio: { id: 'g1', name: 'Gym', slug: 'gym', subscription_plan: plan },
    accessToken: 't', refreshToken: 'r', activeBranchId: null,
  };
}

function renderWith(session: Session | null, ui: React.ReactElement) {
  jest.spyOn(store, 'getSession').mockReturnValue(session);
  jest.spyOn(store, 'isLoaded').mockReturnValue(true);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider>{ui}</SessionProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => jest.restoreAllMocks());

/**
 * The asymmetry tested here is load-bearing and easy to invert:
 *   role restriction -> HIDE     plan restriction -> SHOW LOCKED
 * Inverting it either leaks modules across roles or deletes the upsell path.
 */
describe('<Can> hides on role restriction', () => {
  it('renders children when the role permits', async () => {
    await renderWith(makeSession('front_desk'), <Can module="members"><Text>Members</Text></Can>);
    expect(screen.getByText('Members')).toBeTruthy();
  });

  it('renders NOTHING when the role does not permit', async () => {
    await renderWith(makeSession('trainer'), <Can module="payments"><Text>Payments</Text></Can>);
    expect(screen.queryByText('Payments')).toBeNull();
  });

  it('hides when signed out', async () => {
    await renderWith(null, <Can module="members"><Text>Members</Text></Can>);
    expect(screen.queryByText('Members')).toBeNull();
  });
});

describe('<PlanGate> shows a LOCKED state, never nothing', () => {
  it('renders children when the plan entitles', async () => {
    await renderWith(makeSession('owner', 'pro'), <PlanGate feature="ai_advisor"><Text>AI</Text></PlanGate>);
    expect(screen.getByText('AI')).toBeTruthy();
  });

  it('renders a locked notice — not an empty space — when the plan does not', async () => {
    // This is the upsell. Hiding it would silently delete the upgrade path.
    await renderWith(makeSession('owner', 'free'), <PlanGate feature="ai_advisor"><Text>AI</Text></PlanGate>);
    expect(screen.queryByText('AI')).toBeNull();
    expect(screen.getByText('Not on your plan')).toBeTruthy();
    expect(screen.getByText(/Available on pro/)).toBeTruthy();
  });
});
