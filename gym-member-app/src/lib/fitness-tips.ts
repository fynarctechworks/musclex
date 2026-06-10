/**
 * Static, evergreen fitness tips shown on the public home (Phase 7.2). Kept on
 * the client (no network) and rotated deterministically by day so the "tip of the
 * day" is stable across refetches.
 */
export const FITNESS_TIPS: { title: string; body: string }[] = [
  { title: 'Protein at every meal', body: 'Aim for a palm-sized portion of protein per meal to support muscle repair.' },
  { title: 'Hydrate first', body: 'Start your day with a glass of water — most people wake up mildly dehydrated.' },
  { title: 'Progressive overload', body: 'Add a little weight or one more rep each week to keep getting stronger.' },
  { title: 'Sleep is training', body: '7–9 hours of sleep does more for recovery than any supplement.' },
  { title: 'Walk daily', body: 'A 20-minute walk improves recovery, mood, and daily calorie burn.' },
  { title: 'Warm up smart', body: '5 minutes of light cardio + mobility cuts injury risk and improves lifts.' },
  { title: 'Consistency > intensity', body: 'Three solid sessions a week beats one brutal workout you can’t repeat.' },
  { title: 'Track to improve', body: 'Logging weight and workouts makes progress visible and keeps you honest.' },
  { title: 'Don’t skip legs', body: 'Lower-body training drives the biggest strength and metabolic gains.' },
  { title: 'Rest between sets', body: 'For strength, rest 2–3 minutes between heavy sets — it’s not wasted time.' },
];
