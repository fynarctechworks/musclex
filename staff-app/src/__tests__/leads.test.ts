import { LEAD_FUNNEL, describeLeadStatus, leadVariant, nextStatus } from '@/lib/leads';

describe('LEAD_FUNNEL', () => {
  it('is in PIPELINE order, not alphabetical', () => {
    // Alphabetical ("contacted, converted, lost, new, trial_scheduled") tells
    // a salesperson nothing; pipeline order reads as a story.
    expect(LEAD_FUNNEL).toEqual(['new', 'contacted', 'trial_scheduled', 'converted', 'lost']);
  });
});

describe('describeLeadStatus', () => {
  it('says what a gym says', () => {
    expect(describeLeadStatus('trial_scheduled')).toBe('Trial booked');
    expect(describeLeadStatus('converted')).toBe('Joined');
  });

  it('defaults an absent status to New', () => {
    expect(describeLeadStatus(null)).toBe('New');
  });

  it('degrades an unknown status rather than leaking the enum', () => {
    expect(describeLeadStatus('re_engaged')).toBe('re engaged');
  });
});

describe('leadVariant', () => {
  it('celebrates a conversion', () => {
    expect(leadVariant('converted')).toBe('success');
  });

  it('treats LOST as neutral, not an error', () => {
    // Most leads are lost — that is what a funnel is. Painting the common case
    // red makes the list a wall of failures instead of a work queue.
    expect(leadVariant('lost')).toBe('secondary');
  });
});

describe('nextStatus', () => {
  it('advances new → contacted → trial', () => {
    expect(nextStatus('new')).toBe('contacted');
    expect(nextStatus('contacted')).toBe('trial_scheduled');
  });

  it('treats an absent status as new', () => {
    expect(nextStatus(null)).toBe('contacted');
  });

  it('NEVER offers converted', () => {
    // Joining needs the convert endpoint, which creates the member record.
    // Flipping the status alone marks somebody joined with no membership.
    expect(nextStatus('trial_scheduled')).toBeNull();
    for (const s of ['new', 'contacted', 'trial_scheduled', 'converted', 'lost']) {
      expect(nextStatus(s)).not.toBe('converted');
    }
  });

  it('offers nothing beyond a finished lead', () => {
    expect(nextStatus('converted')).toBeNull();
    expect(nextStatus('lost')).toBeNull();
  });
});
