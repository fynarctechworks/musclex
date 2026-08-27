import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge classNames, letting later Tailwind utilities win over earlier ones in
 * the same group. Every React Native Reusables component expects this helper at
 * this path — it is named in components.json under aliases.utils.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
