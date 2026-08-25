import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with later ones winning on conflict.
 * Same helper, same semantics as frontend/src/lib/utils.ts — keeping the two
 * apps' component internals recognisably the same is the point.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
