"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function MembershipsRedirectPage() {
  const router = useRouter();
  const { gymPath } = useGymSlug();

  useEffect(() => {
    router.replace(gymPath("/memberships/plans"));
  }, [router, gymPath]);

  return null;
}
