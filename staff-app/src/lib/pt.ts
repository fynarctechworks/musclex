/**
 * PT session vocabulary.
 *
 * The API stores snake_case enums; staff read prose. Kept separate from the
 * screen so the mapping is testable and so an unknown value degrades to
 * readable text rather than leaking `rehab_session` onto the page.
 */

const TYPE_LABELS: Record<string, string> = {
  personal_training: 'Personal training',
  group_training: 'Group training',
  rehab_session: 'Rehab',
  assessment: 'Assessment',
};

export function describePtType(type?: string | null): string {
  if (!type) return 'Session';
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

/**
 * Badge tone per status.
 *
 * `no_show` is NOT destructive-red. A missed session is a normal fact of gym
 * life that the trainer records, not an error they made — and a screen that
 * shouts at them every time somebody oversleeps gets ignored.
 */
export function ptStatusVariant(
  status: string,
): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'completed': return 'success';
    case 'scheduled': return 'default';
    case 'no_show': return 'warning';
    case 'cancelled': return 'secondary';
    default: return 'secondary';
  }
}
