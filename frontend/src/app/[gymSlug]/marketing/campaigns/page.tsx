"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function CampaignsRedirectPage() {
  const router = useRouter();
  const { gymPath } = useGymSlug();

  useEffect(() => {
    router.replace(gymPath("/marketing"));
  }, [router, gymPath]);

  return null;
}
