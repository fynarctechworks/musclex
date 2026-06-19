"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";
import { SubscriptionProvider, SubscriptionRenewalModal } from "@/features/subscription";
import { EntitlementProvider, UpgradeModal } from "@/features/entitlements";
import { ensureStudioScopedToken } from "@/services/api-client";

export default function GymSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const gymSlug = params.gymSlug as string;

  const user = useAuthStore((s) => s.user);
  const studio = useAuthStore((s) => s.studio);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // If auth is already loaded in the store, skip the spinner entirely
  const alreadyReady = isAuthenticated && !!user && (user.onboarding_step === "complete" || !user.onboarding_step);
  const [checked, setChecked] = useState(alreadyReady);

  // Self-heal a stale onboarding token (no studio_id → backend can't resolve
  // gym_id → tenant-scoped writes 400). Runs once on mount; refreshes in the
  // background so there's no spinner regression for the common case.
  useEffect(() => {
    if (!isAuthenticated) return;
    ensureStudioScopedToken().catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const step = user.onboarding_step;
    if (step && step !== "complete") {
      const stepRoutes: Record<string, string> = {
        verify_email: "/onboarding/verify",
        select_plan: "/onboarding/plans",
        setup_studio: "/onboarding/setup",
      };
      router.replace(stepRoutes[step] || "/onboarding");
      return;
    }

    if (studio?.slug && gymSlug !== studio.slug) {
      router.replace(`/${studio.slug}/dashboard`);
      return;
    }

    setChecked(true);
  }, [isAuthenticated, user, studio, gymSlug, router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SubscriptionProvider>
      <EntitlementProvider>
        {children}
        <SubscriptionRenewalModal />
        <UpgradeModal />
      </EntitlementProvider>
    </SubscriptionProvider>
  );
}
