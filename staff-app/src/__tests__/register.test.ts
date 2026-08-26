import { mergeAttendance, sortRegister, stillUnmarked } from '@/lib/register';
import type { ClassBooking, SessionAttendance } from '@/api/types';

const b = (id: string, member: string): ClassBooking =>
  ({ id, member_id: member, booking_status: 'booked',
     member: { id: member, full_name: member } } as ClassBooking);

const att = (rows: Array<[string, string]>): SessionAttendance => ({
  session_id: 's1',
  attendance: rows.map(([member_id, attendance_status]) => ({ member_id, attendance_status })),
});

/**
 * The join that was missing. Without it a mark saved to the database while the
 * row on screen still read "Not marked" — verified against the real API before
 * this existed.
 */
describe('mergeAttendance', () => {
  it('puts a saved mark onto the matching booking', () => {
    const out = mergeAttendance([b('1', 'm1')], att([['m1', 'present']]));
    expect(out[0].attendance_status).toBe('present');
  });

  it('leaves a booking with no attendance row untouched', () => {
    const out = mergeAttendance([b('1', 'm1'), b('2', 'm2')], att([['m1', 'present']]));
    expect(out[1].attendance_status).toBeUndefined();
  });

  it('matches by member, not by list position', () => {
    // The two endpoints order independently — bookings by booked_at,
    // attendance by created_at — so position is never a safe key.
    const out = mergeAttendance(
      [b('1', 'm1'), b('2', 'm2'), b('3', 'm3')],
      att([['m3', 'no_show'], ['m1', 'late']]),
    );
    expect(out.map((x) => x.attendance_status)).toEqual(['late', undefined, 'no_show']);
  });

  it('returns the roster unchanged when nobody is marked yet', () => {
    const roster = [b('1', 'm1')];
    expect(mergeAttendance(roster, att([]))).toEqual(roster);
  });

  it('survives attendance not having loaded', () => {
    const roster = [b('1', 'm1')];
    expect(mergeAttendance(roster, undefined)).toEqual(roster);
  });

  it('ignores an attendance row for somebody not booked', () => {
    // A member can be marked then have their booking cancelled.
    const out = mergeAttendance([b('1', 'm1')], att([['ghost', 'present']]));
    expect(out).toHaveLength(1);
    expect(out[0].attendance_status).toBeUndefined();
  });

  it('does not mutate the bookings it was given', () => {
    const roster = [b('1', 'm1')];
    mergeAttendance(roster, att([['m1', 'present']]));
    expect(roster[0].attendance_status).toBeUndefined();
  });
});

describe('stillUnmarked', () => {
  it('counts a booking with no attendance', () => {
    expect(stillUnmarked([b('1', 'm1')])).toHaveLength(1);
  });

  it('does not count present, late or no_show', () => {
    const marked = ['present', 'late', 'no_show'].map((s, i) => ({
      ...b(String(i), `m${i}`), attendance_status: s,
    }));
    expect(stillUnmarked(marked)).toHaveLength(0);
  });

  it("counts 'registered' as unmarked", () => {
    // The server writes 'registered' at booking time. Treating it as a
    // decision would show a complete register before the class started.
    expect(stillUnmarked([{ ...b('1', 'm1'), attendance_status: 'registered' }])).toHaveLength(1);
  });
});

describe('sortRegister', () => {
  const withName = (id: string, name: string): ClassBooking =>
    ({ id, member_id: id, booking_status: 'booked',
       member: { id, full_name: name } } as ClassBooking);

  it('orders by name, not by the order the API returned', () => {
    // The API orders by booked_at; a class booked in one batch has ties it
    // breaks arbitrarily, so rows jumped between fetches.
    const out = sortRegister([
      withName('3', 'Suresh Reddy'),
      withName('1', 'Arjun Sharma'),
      withName('2', 'Meera Nair'),
    ]);
    expect(out.map((b) => b.member?.full_name)).toEqual([
      'Arjun Sharma', 'Meera Nair', 'Suresh Reddy',
    ]);
  });

  it('is stable for two members with the SAME name', () => {
    // Not hypothetical — duplicate names are the case a register most needs
    // to handle without reshuffling.
    const a = withName('aaa', 'Pooja Menon');
    const b = withName('bbb', 'Pooja Menon');
    expect(sortRegister([b, a]).map((x) => x.id)).toEqual(['aaa', 'bbb']);
    expect(sortRegister([a, b]).map((x) => x.id)).toEqual(['aaa', 'bbb']);
  });

  it('does not drop anybody', () => {
    const list = [withName('1', 'B'), withName('2', 'A'), withName('3', 'C')];
    expect(sortRegister(list)).toHaveLength(3);
  });

  it('does not mutate its input', () => {
    const list = [withName('1', 'B'), withName('2', 'A')];
    sortRegister(list);
    expect(list.map((x) => x.id)).toEqual(['1', '2']);
  });

  it('tolerates a missing member name', () => {
    const nameless = { id: 'x', member_id: 'x', booking_status: 'booked' } as ClassBooking;
    expect(() => sortRegister([nameless, withName('1', 'A')])).not.toThrow();
  });
});
