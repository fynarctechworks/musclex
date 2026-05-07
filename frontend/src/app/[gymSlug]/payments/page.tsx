"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function PaymentsRedirectPage() {
  const router = useRouter();
  const { gymPath } = useGymSlug();

  useEffect(() => {
    router.replace(gymPath("/finance/payments"));
  }, [router, gymPath]);

  return null;
}
