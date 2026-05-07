"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

/**
 * Legacy route — the standalone "new expense" form is gone.
 * We redirect to the main expenses timeline with compose mode so the
 * QuickAddBar receives focus.
 */
export default function NewExpenseRedirect() {
  const router = useRouter();
  const { gymPath } = useGymSlug();
  useEffect(() => {
    router.replace(gymPath("/finance/expenses?compose=1"));
  }, [router, gymPath]);
  return null;
}
