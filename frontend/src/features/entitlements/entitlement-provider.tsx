'use client';

/**
 * EntitlementProvider — supplies plan-tier entitlement state to the authenticated tree.
 *
 * Mirrors the proven SubscriptionProvider, but for a DIFFERENT concern:
 *   - SubscriptionProvider  → billing STATE (paid vs unpaid → write lock + renewal modal)
 *   - EntitlementProvider   → plan TIER    (which modules the plan includes → upsell)
 * They compose; neither replaces the other (see audit §1.6, R5).
 *
 * Data source: the SAME `account-overview` query the app shell already fetches
 * (GET /settings/account). We reuse the identical queryKey so this adds ZERO extra
 * network round-trips — react-query dedupes to one request.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api';
import {
  AccountPayload,
  FeatureState,
  ResolvedPlan,
  UsageResource,
  UsageStatus,
  featureState,
  resolvePlan,
  usageStatus,
} from './engine';
import { trackUpsell } from './analytics';

interface UpgradeModalState {
  open: boolean;
  feature: string | null;
  source?: string;
}

interface EntitlementState {
  account: AccountPayload | null;
  plan: ResolvedPlan;
  loading: boolean;
  /** Access decision for a feature key. */
  state: (key: string) => FeatureState;
  isAvailable: (key: string) => boolean;
  /** Usage status for a metered resource (members/branches/staff). */
  usage: (resource: UsageResource) => UsageStatus | null;
  /** Open the shared upgrade modal for a feature. */
  openUpgrade: (feature: string, source?: string) => void;
  closeUpgrade: () => void;
  upgradeModal: UpgradeModalState;
}

const EntitlementContext = createContext<EntitlementState | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  const { data: account, isLoading } = useQuery<AccountPayload>({
    // MUST match app-layout.tsx's queryKey so the two share one request.
    queryKey: ['account-overview'],
    queryFn: () => apiClient.get('/settings/account'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!user,
  });

  const [upgradeModal, setUpgradeModal] = useState<UpgradeModalState>({
    open: false,
    feature: null,
  });

  const plan = useMemo(() => resolvePlan(account ?? null), [account]);

  const stateFn = useCallback(
    (key: string): FeatureState => featureState(account ?? null, key),
    [account],
  );

  const isAvailableFn = useCallback(
    (key: string): boolean => featureState(account ?? null, key) === 'available',
    [account],
  );

  const usageFn = useCallback(
    (resource: UsageResource) => usageStatus(account ?? null, resource),
    [account],
  );

  const openUpgrade = useCallback(
    (feature: string, source?: string) => {
      setUpgradeModal({ open: true, feature, source });
      trackUpsell('upgrade_modal_opened', {
        feature,
        current_plan: plan.rawPlan,
        source,
      });
    },
    [plan.rawPlan],
  );

  const closeUpgrade = useCallback(() => {
    setUpgradeModal((s) => ({ ...s, open: false }));
  }, []);

  const value = useMemo<EntitlementState>(
    () => ({
      account: account ?? null,
      plan,
      loading: isLoading,
      state: stateFn,
      isAvailable: isAvailableFn,
      usage: usageFn,
      openUpgrade,
      closeUpgrade,
      upgradeModal,
    }),
    [account, plan, isLoading, stateFn, isAvailableFn, usageFn, openUpgrade, closeUpgrade, upgradeModal],
  );

  return (
    <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
  );
}

export function useEntitlements(): EntitlementState {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    // Permissive default outside the provider (e.g. landing page): treat everything as
    // available so non-authed surfaces never show spurious locks.
    return {
      account: null,
      plan: { plan: 'free', rawPlan: 'free', features: {} },
      loading: false,
      state: () => 'available',
      isAvailable: () => true,
      usage: () => null,
      openUpgrade: () => {},
      closeUpgrade: () => {},
      upgradeModal: { open: false, feature: null },
    };
  }
  return ctx;
}

/** Convenience hook for a single feature. */
export function useEntitlement(key: string): {
  state: FeatureState;
  available: boolean;
  locked: boolean;
  openUpgrade: (source?: string) => void;
} {
  const { state, openUpgrade } = useEntitlements();
  const s = state(key);
  return {
    state: s,
    available: s === 'available',
    locked: s === 'locked',
    openUpgrade: (source?: string) => openUpgrade(key, source),
  };
}

/** Convenience hook for a metered resource. */
export function useUsageLimit(resource: UsageResource): UsageStatus | null {
  const { usage } = useEntitlements();
  return usage(resource);
}
