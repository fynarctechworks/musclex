import { initialsOf, membershipState } from '../features/MemberRow';
import type { Member } from '../api/types';

const NOW = new Date('2026-08-26T12:00:00');

const member = (end: string | null, extra: Partial<Member> = {}): Member => ({
  id: 'm1', member_code: 'TG1000', full_name: 'Rahul Sharma', phone: '9800000000',
  status: 'active', branch_id: 'b1',
  memberships: end === null ? [] : [{ id: 'ms1', status: 'active', end_date: end }],
  ...extra,
});

/**
 * Membership state is DERIVED, not taken from `member.status`. The API's status
 * describes the member record (active/inactive); staff need to know whether the
 * PLAN is live. A member can be "active" with a long-expired plan.
 */
describe('membershipState', () => {
  it('reports an active plan', () => {
    expect(membershipState(member('2026-12-01'), NOW).label).toBe('Active');
  });

  it('flags a plan expiring within two weeks', () => {
    // Matches the web app's renewal window.
    expect(membershipState(member('2026-09-02'), NOW).label).toBe('Expiring');
    expect(membershipState(member('2026-09-09'), NOW).label).toBe('Expiring');
  });

  it('flags an expired plan', () => {
    expect(membershipState(member('2026-08-01'), NOW).label).toBe('Expired');
  });

  it('does not call an inactive member "Active" just because status says so', () => {
    const m = member('2026-01-01', { status: 'active' });
    expect(membershipState(m, NOW).label).toBe('Expired');
  });

  it('says "No active plan", never "No plan", when the array is empty', () => {
    // GET /members only includes ACTIVE memberships, so a lapsed member arrives
    // with []. "No plan" would tell the desk there is nothing to renew.
    expect(membershipState(member(null), NOW).label).toBe('No active plan');
  });

  it('handles an unparseable end date without throwing', () => {
    expect(membershipState(member('not-a-date'), NOW).label).toBe('No active plan');
  });

  it('uses destructive/warning/success variants so the badge colour carries meaning', () => {
    expect(membershipState(member('2026-08-01'), NOW).variant).toBe('destructive');
    expect(membershipState(member('2026-09-02'), NOW).variant).toBe('warning');
    expect(membershipState(member('2026-12-01'), NOW).variant).toBe('success');
  });
});

describe('initialsOf', () => {
  it('takes the first two words', () => {
    expect(initialsOf('Rahul Sharma')).toBe('RS');
    expect(initialsOf('Anita Kumar Reddy')).toBe('AK');
  });
  it('handles a single name and blank input', () => {
    expect(initialsOf('Prince')).toBe('P');
    expect(initialsOf('   ')).toBe('?');
  });
});
