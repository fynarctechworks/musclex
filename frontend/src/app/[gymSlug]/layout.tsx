"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";

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
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait for hydration
    if (!isAuthenticated || !user) {
      return;
    }

    // If onboarding not complete, redirect to onboarding
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

    // If the slug in the URL doesn't match the user's studio slug,
    // redirect them to their own workspace
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

  return <>{children}</>;
}
