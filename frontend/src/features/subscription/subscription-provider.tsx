'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { setMutationAllowed } from '@/services/api-client';
import { subscriptionApi } from './api';
import type {
  SubscriptionContext,
  SubscriptionLifecycleStatus,
  SubscriptionStatusResponse,
} from './types';

interface SubscriptionState {
  /** Current resolved subscription context (null until first load). */
  subscription: SubscriptionContext | null;
  /** Full status payload (plan + timeline + amount due). */
  status: SubscriptionStatusResponse | null;
  /** Initial fetch in-flight. */
  loading: boolean;
  /** True only for ACTIVE. False for GRACE_PERIOD, LOCKED, and SUSPENDED — */
  /** writes resume only after a paid renewal flips status back to active. */
  canMutate: boolean;
  /** Manual refresh — call after a renewal. */
  refresh: () => Promise<void>;
  /** Programmatically open the renewal modal. */
  openRenewModal: () => void;
  /** Suppress the auto-modal for this session (e.g. after dismiss). */
  dismissModal: () => void;
  /** Whether the modal should be visible right now. */
  modalOpen: boolean;
}

const SubscriptionStateContext = createContext<SubscriptionState | null>(null);

const POLL_INTERVAL_MS = 60_000;
const STALE_MS = 30_000;

/**
 * Provides current subscription lifecycle state to the entire authenticated
 * tree. Source of truth: backend GET /subscription/status (polled every 60s).
 *
 * Auto-opens the renewal modal on:
 *   - first auth load if status != active
 *   - any client-side transition from active → grace_period / locked / suspended
 *   - any 403 SUBSCRIPTION_LOCKED API response (via window event from api-client)
 *
 * Stays out of the way on signup/onboarding (no studio_id yet).
 */
export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const studioId = useAuthStore((s) => s.user?.studio_id);
  const queryClient = useQueryClient();

  // Track previous status so we can detect transitions.
  const prevStatus = useRef<SubscriptionLifecycleStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDismissedAt, setModalDismissedAt] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['subscription', 'status', studioId ?? null],
    queryFn: () => subscriptionApi.getStatus(),
    enabled: isAuthenticated && !!studioId,
    staleTime: STALE_MS,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    // Don't retry hard on 5xx — auth/onboarding edge cases can hit this briefly.
    retry: 1,
  });

  const subscription = data?.subscription ?? null;
  const status = data ?? null;
  const canMutate = subscription?.can_mutate ?? true; // optimistic until first load

  // Keep the API-client write gate in sync with backend truth. This is how
  // every mutation across the app becomes read-only without per-page changes:
  // POST/PUT/PATCH/DELETE short-circuit with a 403 + renewal modal.
  useEffect(() => {
    setMutationAllowed(canMutate, subscription as unknown as Record<string, unknown> | null);
  }, [canMutate, subscription]);

  // ── Modal auto-open logic ─────────────────────────────────
  useEffect(() => {
    if (!subscription) return;
    const next = subscription.status;
    const prev = prevStatus.current;
    prevStatus.current = next;

    // First load → open if anything non-active or expiring within 5 days.
    if (prev === null) {
      const expiringSoon =
        subscription.days_until_expiry !== null &&
        subscription.days_until_expiry <= 5 &&
        subscription.days_until_expiry > 0;
      if (next !== 'active' || expiringSoon) {
        setModalOpen(true);
      }
      return;
    }

    // Real transition into a worse state → reopen (even if dismissed).
    if (
      (prev === 'active' && next !== 'active') ||
      (prev === 'grace_period' && next === 'locked') ||
      next === 'suspended'
    ) {
      setModalDismissedAt(null);
      setModalOpen(true);
    }
  }, [subscription]);

  // ── Auto-reopen daily even if user dismissed ──────────────
  useEffect(() => {
    if (!modalDismissedAt) return;
    const HOURS_4 = 4 * 60 * 60 * 1000;
    const timer = setTimeout(() => {
      if (subscription && subscription.status !== 'active') {
        setModalOpen(true);
        setModalDismissedAt(null);
      }
    }, HOURS_4);
    return () => clearTimeout(timer);
  }, [modalDismissedAt, subscription]);

  // ── External triggers ─────────────────────────────────────
  useEffect(() => {
    // api-client dispatches 'subscription-locked' on 403 SUBSCRIPTION_LOCKED.
    const handler = () => {
      setModalDismissedAt(null);
      setModalOpen(true);
      // Bust cache so the modal shows fresh numbers.
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('subscription-locked', handler);
      return () => window.removeEventListener('subscription-locked', handler);
    }
  }, [queryClient]);

  // Reset state on logout so a new tenant's modal isn't stuck.
  useEffect(() => {
    if (!isAuthenticated) {
      prevStatus.current = null;
      setModalOpen(false);
      setModalDismissedAt(null);
    }
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const openRenewModal = useCallback(() => {
    setModalDismissedAt(null);
    setModalOpen(true);
  }, []);

  const dismissModal = useCallback(() => {
    // Any non-active status (grace_period, locked, suspended) cannot be
    // permanently dismissed — re-opens in 4h. Grace is read-only too now,
    // so the renewal nudge persists until payment goes through.
    if (subscription?.status && subscription.status !== 'active') {
      setModalOpen(false);
      setModalDismissedAt(Date.now());
      return;
    }
    setModalOpen(false);
  }, [subscription?.status]);

  const value = useMemo<SubscriptionState>(
    () => ({
      subscription,
      status,
      loading: isLoading,
      canMutate,
      refresh,
      openRenewModal,
      dismissModal,
      modalOpen,
    }),
    [
      subscription,
      status,
      isLoading,
      canMutate,
      refresh,
      openRenewModal,
      dismissModal,
      modalOpen,
    ],
  );

  return (
    <SubscriptionStateContext.Provider value={value}>
      {children}
    </SubscriptionStateContext.Provider>
  );
}

export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionStateContext);
  if (!ctx) {
    // Permissive default for components that render outside the provider
    // (e.g. landing page). They get a "fully active" stub.
    return {
      subscription: null,
      status: null,
      loading: false,
      canMutate: true,
      refresh: async () => {},
      openRenewModal: () => {},
      dismissModal: () => {},
      modalOpen: false,
    };
  }
  return ctx;
}

/**
 * Convenience hook used at every mutation site to enable/disable write UI.
 *
 * Returns { canMutate, reason, openRenewModal } so callers can:
 *   <Button disabled={!canMutate} onClick={canMutate ? handleCreate : openRenewModal}>
 */
export function useCanMutate(): {
  canMutate: boolean;
  reason: SubscriptionLifecycleStatus | 'active';
  openRenewModal: () => void;
} {
  const { subscription, canMutate, openRenewModal } = useSubscription();
  return {
    canMutate,
    reason: subscription?.status ?? 'active',
    openRenewModal,
  };
}
