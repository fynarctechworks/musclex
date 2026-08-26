import React from 'react';
import { View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/auth/SessionProvider';
import { can, type Action, type Module } from '@/rbac/permissions';
import { featureState, requiredPlanFor, type FeatureKey } from '@/rbac/entitlements';

/**
 * <Can> — ROLE gate. Renders nothing when the role lacks the permission.
 *
 * Hiding is correct here: a staffer should never see a module their role
 * cannot access. Contrast with <PlanGate>, which SHOWS a locked state.
 *
 * ⚠️ UX only. The backend guard is the real boundary — never rely on this to
 * protect data (plan §8).
 */
export function Can({
  module, action = 'view', anyOf, children, fallback = null,
}: {
  module: Module;
  action?: Action;
  /**
   * Satisfied by ANY of these actions, mirroring the backend's
   * `@AnyPermissions`. Needed where a narrow action was introduced alongside a
   * broad one: recording a measurement accepts `members.measure` OR
   * `members.edit`, so a trainer and an owner both see the button.
   */
  anyOf?: Action[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { session } = useSession();
  const allowed = anyOf?.length
    ? anyOf.some((a) => can(session?.user, module, a))
    : can(session?.user, module, action);
  return <>{allowed ? children : fallback}</>;
}

/** Imperative form, for computing lists (e.g. deriving nav tabs). */
export function useCan() {
  const { session } = useSession();
  return React.useCallback(
    (module: Module, action: Action = 'view') => can(session?.user, module, action),
    [session],
  );
}

/**
 * <PlanGate> — PLAN gate. Renders children when entitled; otherwise renders a
 * LOCKED placeholder, never nothing.
 *
 * This asymmetry with <Can> is deliberate and load-bearing: the locked state is
 * the upsell. Hiding plan-gated features instead would silently delete the
 * upgrade path, which is how the gym never learns the feature exists.
 */
export function PlanGate({
  feature, children, locked,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
  /** Custom locked rendering. Defaults to <LockedNotice>. */
  locked?: React.ReactNode;
}) {
  const { session } = useSession();
  const state = featureState(feature, session?.studio?.subscription_plan);
  if (state === 'available') return <>{children}</>;
  return <>{locked ?? <LockedNotice feature={feature} />}</>;
}

export function useFeatureState(feature: FeatureKey) {
  const { session } = useSession();
  return featureState(feature, session?.studio?.subscription_plan);
}

/** The default locked presentation: says what it is and what unlocks it. */
export function LockedNotice({ feature }: { feature: FeatureKey }) {
  const plan = requiredPlanFor(feature);
  return (
    <View className="items-center gap-2 rounded-lg border border-border bg-card px-4 py-6">
      <Lock size={20} color="#888888" />
      <Text className="text-base font-medium text-foreground">Not on your plan</Text>
      {plan ? (
        <Badge variant="secondary">
          <Text>Available on {plan}</Text>
        </Badge>
      ) : null}
      <Text className="text-center text-sm text-muted-foreground">
        Upgrade on the web app to switch this on.
      </Text>
    </View>
  );
}

/** Small inline marker for locked nav entries. */
export function PremiumTag({ feature }: { feature: FeatureKey }) {
  const plan = requiredPlanFor(feature);
  if (!plan || plan === 'free') return null;
  return (
    <Badge variant="secondary">
      <Text>{plan}</Text>
    </Badge>
  );
}
