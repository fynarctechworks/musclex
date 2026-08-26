import { filterMembers } from '@/lib/search';
import type { Member } from '@/api/types';

const m = (over: Partial<Member>): Member => ({
  id: 'x', member_code: 'TG1000', full_name: 'Neha Patel', phone: '9810000021',
  status: 'active', branch_id: 'b', ...over,
} as Member);

const roster = [
  m({ id: '1', full_name: 'Neha Patel', member_code: 'TG1001', phone: '+91 98100 00021' }),
  m({ id: '2', full_name: 'Rahul Sharma', member_code: 'TG1002', phone: '9820000022' }),
  m({ id: '3', full_name: 'Arjun Patel', member_code: 'TG1003', phone: '9830000023' }),
];

describe('filterMembers', () => {
  it('finds by partial first name', () => {
    expect(filterMembers(roster, 'neh').map((x) => x.id)).toEqual(['1']);
  });

  it('finds every match on a shared surname', () => {
    expect(filterMembers(roster, 'patel').map((x) => x.id)).toEqual(['1', '3']);
  });

  it('is case-insensitive', () => {
    expect(filterMembers(roster, 'RAHUL').map((x) => x.id)).toEqual(['2']);
  });

  it('finds by member code', () => {
    expect(filterMembers(roster, 'tg1002').map((x) => x.id)).toEqual(['2']);
  });

  it('finds by phone despite punctuation differences', () => {
    // Stored as '+91 98100 00021', typed as a bare run of digits.
    expect(filterMembers(roster, '9810000021').map((x) => x.id)).toEqual(['1']);
  });

  it('finds by the last few digits, which is how staff read a number out', () => {
    expect(filterMembers(roster, '00022').map((x) => x.id)).toEqual(['2']);
  });

  it('ignores a single character, which would match most of the gym', () => {
    // '2' is a substring of nearly every member code and phone number.
    expect(filterMembers(roster, '2')).toEqual([]);
  });

  it('does not let two stray digits match a code or phone', () => {
    // Every member code shares a prefix and a run of zeroes, so a loose match
    // on '00' would return the whole roster.
    expect(filterMembers(roster, '00').map((x) => x.id)).toEqual([]);
  });

  it('still matches a two-letter NAME fragment', () => {
    // Names are distinctive where identifiers are not — hence two minimums.
    expect(filterMembers(roster, 'ne').map((x) => x.id)).toEqual(['1']);
  });

  it('returns nothing for an empty term', () => {
    expect(filterMembers(roster, '   ')).toEqual([]);
  });

  it('returns nothing rather than throwing on members with missing fields', () => {
    const sparse = [{ id: '9' } as Member];
    expect(filterMembers(sparse, 'neha')).toEqual([]);
  });
});
