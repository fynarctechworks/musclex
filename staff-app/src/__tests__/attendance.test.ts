import type { ClassBooking } from '@/api/types';

/**
 * The register's one derived rule: who still needs finding.
 *
 * A trainer reads this screen to answer "who have I not seen yet", so an
 * unmarked row and a marked one must never be confused. `attendance_status` is
 * absent until somebody marks it — not an empty string, and not 'cancelled'.
 */
function unmarked(bookings: ClassBooking[]): ClassBooking[] {
  return bookings.filter((b) => !b.attendance_status);
}

const b = (over: Partial<ClassBooking>): ClassBooking => ({
  id: 'b1', member_id: 'm1', booking_status: 'booked', ...over,
} as ClassBooking);

describe('who is still unmarked', () => {
  it('counts a booking with no attendance_status', () => {
    expect(unmarked([b({})])).toHaveLength(1);
  });

  it('counts a booking whose status is explicitly null', () => {
    expect(unmarked([b({ attendance_status: null })])).toHaveLength(1);
  });

  it('does NOT count somebody already marked present', () => {
    expect(unmarked([b({ attendance_status: 'present' })])).toHaveLength(0);
  });

  it('does not count a no-show — absent is still a decision', () => {
    // The trainer has answered the question for this member.
    expect(unmarked([b({ attendance_status: 'no_show' })])).toHaveLength(0);
  });

  it('separates a mixed register correctly', () => {
    const list = [
      b({ id: '1', attendance_status: 'present' }),
      b({ id: '2' }),
      b({ id: '3', attendance_status: 'late' }),
      b({ id: '4', attendance_status: null }),
    ];
    expect(unmarked(list).map((x) => x.id)).toEqual(['2', '4']);
  });

  it('is empty for an empty class', () => {
    expect(unmarked([])).toEqual([]);
  });
});
