/**
 * ────────────────────────────────────────────────────────────────
 * SPORT TYPES
 * ────────────────────────────────────────────────────────────────
 *
 * The list a member picks from when recording. Read off Strava's own picker so
 * an imported activity keeps its type instead of collapsing to "Workout", and
 * grouped the same way because that grouping is how people look for their sport.
 *
 * `distanceBased` decides what the UI leads with: a run is a distance with a
 * pace, a weight-training session is a duration with a heart rate. Getting this
 * wrong shows a member "0.00 km" after an hour of squats.
 */

export interface SportType {
  key: string;
  label: string;
  group: string;
  /** Distance and pace are the headline numbers; otherwise duration is. */
  distanceBased: boolean;
  /** Recorded with a GPS track by default. */
  gps: boolean;
}

export const SPORT_TYPES: readonly SportType[] = [
  // Foot
  { key: 'run', label: 'Run', group: 'Foot Sports', distanceBased: true, gps: true },
  { key: 'trail_run', label: 'Trail Run', group: 'Foot Sports', distanceBased: true, gps: true },
  { key: 'walk', label: 'Walk', group: 'Foot Sports', distanceBased: true, gps: true },
  { key: 'hike', label: 'Hike', group: 'Foot Sports', distanceBased: true, gps: true },
  { key: 'wheelchair', label: 'Wheelchair', group: 'Foot Sports', distanceBased: true, gps: true },

  // Cycle
  { key: 'ride', label: 'Ride', group: 'Cycle Sports', distanceBased: true, gps: true },
  { key: 'mountain_bike_ride', label: 'Mountain Bike Ride', group: 'Cycle Sports', distanceBased: true, gps: true },
  { key: 'gravel_ride', label: 'Gravel Ride', group: 'Cycle Sports', distanceBased: true, gps: true },
  { key: 'e_bike_ride', label: 'E-Bike Ride', group: 'Cycle Sports', distanceBased: true, gps: true },
  { key: 'e_mountain_bike_ride', label: 'E-Mountain Bike Ride', group: 'Cycle Sports', distanceBased: true, gps: true },
  { key: 'handcycle', label: 'Handcycle', group: 'Cycle Sports', distanceBased: true, gps: true },
  { key: 'velomobile', label: 'Velomobile', group: 'Cycle Sports', distanceBased: true, gps: true },

  // Strength — the group where we are already deeper than Strava, which
  // records these as nothing but a stopwatch.
  { key: 'weight_training', label: 'Weight Training', group: 'Strength', distanceBased: false, gps: false },
  { key: 'workout', label: 'Workout', group: 'Strength', distanceBased: false, gps: false },
  { key: 'hiit', label: 'HIIT', group: 'Strength', distanceBased: false, gps: false },
  { key: 'crossfit', label: 'Crossfit', group: 'Strength', distanceBased: false, gps: false },
  { key: 'physiotherapy', label: 'Physiotherapy', group: 'Strength', distanceBased: false, gps: false },
  { key: 'pilates', label: 'Pilates', group: 'Strength', distanceBased: false, gps: false },
  { key: 'yoga', label: 'Yoga', group: 'Strength', distanceBased: false, gps: false },

  // Water
  { key: 'swim', label: 'Swim', group: 'Water Sports', distanceBased: true, gps: false },
  { key: 'kayaking', label: 'Kayaking', group: 'Water Sports', distanceBased: true, gps: true },
  { key: 'rowing', label: 'Rowing', group: 'Water Sports', distanceBased: true, gps: true },
  { key: 'stand_up_paddling', label: 'Stand Up Paddling', group: 'Water Sports', distanceBased: true, gps: true },
  { key: 'surfing', label: 'Surfing', group: 'Water Sports', distanceBased: false, gps: true },

  // Racket
  { key: 'tennis', label: 'Tennis', group: 'Racket Sports', distanceBased: false, gps: false },
  { key: 'padel', label: 'Padel', group: 'Racket Sports', distanceBased: false, gps: false },
  { key: 'pickleball', label: 'Pickleball', group: 'Racket Sports', distanceBased: false, gps: false },
  { key: 'racquetball', label: 'Racquetball', group: 'Racket Sports', distanceBased: false, gps: false },
  { key: 'squash', label: 'Squash', group: 'Racket Sports', distanceBased: false, gps: false },
  { key: 'badminton', label: 'Badminton', group: 'Racket Sports', distanceBased: false, gps: false },
  { key: 'table_tennis', label: 'Table Tennis', group: 'Racket Sports', distanceBased: false, gps: false },

  // Winter
  { key: 'alpine_ski', label: 'Alpine Ski', group: 'Winter Sports', distanceBased: true, gps: true },
  { key: 'backcountry_ski', label: 'Backcountry Ski', group: 'Winter Sports', distanceBased: true, gps: true },
  { key: 'nordic_ski', label: 'Nordic Ski', group: 'Winter Sports', distanceBased: true, gps: true },
  { key: 'snowboard', label: 'Snowboard', group: 'Winter Sports', distanceBased: true, gps: true },
  { key: 'snowshoe', label: 'Snowshoe', group: 'Winter Sports', distanceBased: true, gps: true },
  { key: 'ice_skate', label: 'Ice Skate', group: 'Winter Sports', distanceBased: true, gps: true },

  // Other
  { key: 'elliptical', label: 'Elliptical', group: 'Other', distanceBased: false, gps: false },
  { key: 'stair_stepper', label: 'Stair-Stepper', group: 'Other', distanceBased: false, gps: false },
  { key: 'inline_skate', label: 'Inline Skate', group: 'Other', distanceBased: true, gps: true },
  { key: 'rock_climbing', label: 'Rock Climbing', group: 'Other', distanceBased: false, gps: false },
  { key: 'golf', label: 'Golf', group: 'Other', distanceBased: true, gps: true },
  { key: 'soccer', label: 'Football (Soccer)', group: 'Other', distanceBased: true, gps: true },
  { key: 'sail', label: 'Sail', group: 'Other', distanceBased: true, gps: true },
  { key: 'skateboard', label: 'Skateboard', group: 'Other', distanceBased: true, gps: true },
  { key: 'windsurf', label: 'Windsurf', group: 'Other', distanceBased: true, gps: true },
  { key: 'kitesurf', label: 'Kitesurf', group: 'Other', distanceBased: true, gps: true },
] as const;

export const SPORT_KEYS: readonly string[] = SPORT_TYPES.map((s) => s.key);

const BY_KEY = new Map(SPORT_TYPES.map((s) => [s.key, s]));

export function sportType(key: string): SportType | undefined {
  return BY_KEY.get(key);
}

export function isSportKey(key: string): boolean {
  return BY_KEY.has(key);
}
