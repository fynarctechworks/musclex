import type { Member } from '@/api/types';

/**
 * Local member search, for when the server cannot be reached.
 *
 * The server is normally the authority here — it searches columns the phone
 * never holds and applies the gym's own matching rules. This exists only so
 * that a front desk with no uplink can still FIND the person standing in front
 * of them, which is the precondition for queueing their check-in at all. An
 * offline queue is worthless if you cannot reach the member to fill it.
 *
 * Matching mirrors what the desk actually types: part of a name, the tail of a
 * phone number, or a member code.
 */

/**
 * Two different minimums, because two different kinds of string.
 *
 * A NAME fragment is distinctive at two characters — "ne" narrows a gym
 * meaningfully. An IDENTIFIER fragment is not: member codes share a prefix and
 * a run of zeroes, so "00" is a substring of almost every code and phone in
 * the building. Matching those loosely returns the whole roster, which is the
 * same as returning nothing useful while looking like it worked.
 */
const MIN_NAME = 2;
const MIN_IDENTIFIER = 3;

export function filterMembers(members: Member[], term: string): Member[] {
  const q = term.trim().toLowerCase();
  if (q.length < MIN_NAME) return [];

  const digits = q.replace(/\D/g, '');

  return members.filter((m) => {
    if ((m.full_name ?? '').toLowerCase().includes(q)) return true;

    if (q.length >= MIN_IDENTIFIER && (m.member_code ?? '').toLowerCase().includes(q)) {
      return true;
    }

    // Phones are typed, stored and printed with different punctuation, so
    // compare digits only. Staff read out the last few digits rather than the
    // country code, so a substring match is right — just not a short one.
    if (digits.length >= MIN_IDENTIFIER) {
      const phone = (m.phone ?? '').replace(/\D/g, '');
      if (phone.includes(digits)) return true;
    }

    return false;
  });
}
