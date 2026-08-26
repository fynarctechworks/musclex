import type { ClassBooking, SessionAttendance } from '@/api/types';

/**
 * Merge the register onto the roster.
 *
 * `class_bookings` records who signed up; `class_attendance` records who
 * turned up. They are separate tables and separate endpoints, so a screen
 * showing "who is booked, and did they come?" has to join them here.
 *
 * Skipping this is not a cosmetic bug: the mark saves correctly, the row still
 * reads "Not marked", and the trainer marks the same person again — or worse,
 * concludes the app is not saving and stops using it.
 */
export function mergeAttendance(
  bookings: ClassBooking[],
  attendance: SessionAttendance | undefined,
): ClassBooking[] {
  const byMember = new Map<string, string>();
  for (const a of attendance?.attendance ?? []) {
    if (a.member_id && a.attendance_status) byMember.set(a.member_id, a.attendance_status);
  }

  if (byMember.size === 0) return bookings;

  return bookings.map((b) => {
    const status = byMember.get(b.member_id);
    return status ? { ...b, attendance_status: status } : b;
  });
}

/**
 * Order the register the way a person reads one: by name.
 *
 * The API orders by `booked_at`, and a class booked in one batch has ties it
 * breaks arbitrarily — so the same roster comes back in a different order on
 * each fetch and rows jump under the trainer's finger mid-register. Sorting
 * here makes the order stable AND findable, which booking time never was:
 * nobody looks somebody up by when they signed up.
 */
export function sortRegister(bookings: ClassBooking[]): ClassBooking[] {
  return [...bookings].sort((a, b) => {
    const an = a.member?.full_name ?? '';
    const bn = b.member?.full_name ?? '';
    const byName = an.localeCompare(bn);
    // Same name happens (two Pooja Menons is exactly the case the desk
    // struggles with). Fall back to a stable key so the order still settles.
    return byName !== 0 ? byName : a.id.localeCompare(b.id);
  });
}

/**
 * Who the trainer still has to account for.
 *
 * 'registered' counts as UNMARKED. The server writes it when a booking is
 * created, so treating it as a decision would show a full register before the
 * class has even started.
 */
export function stillUnmarked(bookings: ClassBooking[]): ClassBooking[] {
  return bookings.filter(
    (b) => !b.attendance_status || b.attendance_status === 'registered',
  );
}
