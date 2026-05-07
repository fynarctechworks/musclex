/**
 * Centralized application defaults.
 *
 * These values are used as fallbacks when the studio/branch/organization
 * does not have its own configured value. Keep them in one place so they
 * can be changed without hunting through 20+ files.
 */

/** Default timezone when no studio/branch timezone is set. */
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata';

/** Default currency code when no studio/branch currency is set. */
export const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'INR';

/** Default locale for date/number formatting. */
export const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || 'en-IN';

/** Default pagination limit for list endpoints. */
export const DEFAULT_PAGE_LIMIT = 50;

/** Default subscription plan assigned to new studios. */
export const DEFAULT_PLAN = 'free';
