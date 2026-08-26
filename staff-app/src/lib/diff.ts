/**
 * Which fields actually changed.
 *
 * A mobile edit form shows four fields; the member record has thirty. Sending
 * the whole form back would blank everything the phone never displayed — date
 * of birth, address, emergency contact — quietly destroying data the web app
 * collected. So the request carries ONLY what the staffer actually altered,
 * and an unchanged form produces an empty patch rather than a no-op write.
 *
 * Trimming happens before comparison, so adding and removing a trailing space
 * is not an edit.
 */
export function changedFields<T extends Record<string, string | undefined | null>>(
  original: T,
  edited: T,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const key of Object.keys(edited)) {
    const before = norm(original[key]);
    const after = norm(edited[key]);
    if (before !== after) out[key] = after;
  }

  return out;
}

function norm(v: string | undefined | null): string {
  return (v ?? '').trim();
}
