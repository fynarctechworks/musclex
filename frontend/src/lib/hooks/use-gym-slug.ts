"use client";

import { useParams } from "next/navigation";

/**
 * Returns the gym slug from the URL and a helper to build gym-scoped paths.
 * Use inside any page under /[gymSlug]/...
 */
export function useGymSlug() {
  const params = useParams();
  const gymSlug = params.gymSlug as string;

  /** Prepend the gym slug to a relative path: gymPath("/dashboard") → "/my-gym/dashboard" */
  const gymPath = (path: string) => `/${gymSlug}${path}`;

  return { gymSlug, gymPath };
}
