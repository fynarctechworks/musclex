/**
 * Bundled stock fitness photography (from `asserts/mobile`, copied into
 * `assets/photos`). Static `require`s so Metro bundles them.
 *
 * ⚠️ These originals are LARGE (8–18 MB each). Fine for dev preview, but they MUST
 * be downscaled/compressed (target ≤ ~300 KB, ~1080px) before shipping — see the
 * note in the work report. Swap the files in place; these keys stay stable.
 */
export const PHOTOS = {
  workoutHome: require('../../assets/photos/img-1.jpg'), // kettlebell at home
  walking: require('../../assets/photos/img-2.jpg'), // park walk
  meals: require('../../assets/photos/img-3.jpg'), // food / nutrition
  cycling: require('../../assets/photos/img-4.jpg'), // road cycling
  hydration: require('../../assets/photos/img-5.jpg'), // drinking water
  homeGym: require('../../assets/photos/img-6.jpg'), // elliptical at home
} as const;

export type PhotoKey = keyof typeof PHOTOS;
