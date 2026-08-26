/**
 * Lead vocabulary.
 *
 * The funnel order matters: a status list shown alphabetically ("contacted,
 * converted, lost, new, trial_scheduled") tells a salesperson nothing. In
 * pipeline order it reads as a story.
 */

export const LEAD_FUNNEL = ['new', 'contacted', 'trial_scheduled', 'converted', 'lost'] as const;
export type LeadStatus = (typeof LEAD_FUNNEL)[number];

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  trial_scheduled: 'Trial booked',
  converted: 'Joined',
  lost: 'Lost',
};

export function describeLeadStatus(status?: string | null): string {
  if (!status) return 'New';
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/**
 * Tone per status.
 *
 * `lost` is NEUTRAL, not destructive. Most leads are lost — that is what a
 * funnel is — and painting the common case red makes the list look like a
 * wall of failures instead of a work queue.
 */
export function leadVariant(
  status?: string | null,
): 'default' | 'secondary' | 'success' | 'warning' {
  switch (status) {
    case 'converted': return 'success';
    case 'trial_scheduled': return 'warning';
    case 'lost': return 'secondary';
    default: return 'default';
  }
}

/**
 * The next step for a lead, or null when there is nothing to advance to.
 *
 * `converted` is never offered: joining requires the dedicated convert
 * endpoint, which creates the member record. Flipping the status alone would
 * mark somebody joined with no membership behind them.
 */
export function nextStatus(status?: string | null): LeadStatus | null {
  switch (status ?? 'new') {
    case 'new': return 'contacted';
    case 'contacted': return 'trial_scheduled';
    default: return null;
  }
}
