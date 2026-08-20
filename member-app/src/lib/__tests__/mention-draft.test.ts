import { activeMention, applyMention, matchPeople } from '../mention-draft';

const people = [
  { id: 'aaaa1111-0000-4000-8000-000000000001', name: 'Alice Kumar' },
  { id: 'aaaa1111-0000-4000-8000-000000000002', name: 'Alfred Jones' },
  { id: 'aaaa1111-0000-4000-8000-000000000003', name: 'Bob Singh' },
  { id: 'aaaa1111-0000-4000-8000-000000000004', name: null },
];

describe('activeMention', () => {
  it('finds the @word the caret is inside', () => {
    expect(activeMention('nice one @ali', 13)).toEqual({ query: 'ali', start: 9 });
  });

  it('finds one that starts the comment', () => {
    expect(activeMention('@ali', 4)).toEqual({ query: 'ali', start: 0 });
  });

  it('opens on a bare @ so the picker appears before any typing', () => {
    expect(activeMention('hey @', 5)).toEqual({ query: '', start: 4 });
  });

  it('does not fire inside an email address', () => {
    // "alice@example.com" must not open a people picker.
    expect(activeMention('mail me at alice@example', 24)).toBeNull();
  });

  it('closes once a space is typed', () => {
    expect(activeMention('@alice went far', 15)).toBeNull();
  });

  it('is null when there is no @ before the caret', () => {
    expect(activeMention('just a comment', 14)).toBeNull();
  });

  it('ignores an @ after the caret', () => {
    expect(activeMention('hello @bob', 5)).toBeNull();
  });

  it('gives up on an absurdly long word', () => {
    expect(activeMention('@' + 'x'.repeat(40), 41)).toBeNull();
  });
});

describe('matchPeople', () => {
  it('matches anywhere in the name, not just the start', () => {
    expect(matchPeople(people, 'kumar').map((p) => p.name)).toEqual(['Alice Kumar']);
  });

  it('is case-insensitive', () => {
    expect(matchPeople(people, 'ALF').map((p) => p.name)).toEqual(['Alfred Jones']);
  });

  it('returns several when several match', () => {
    expect(matchPeople(people, 'al').map((p) => p.name)).toEqual(['Alice Kumar', 'Alfred Jones']);
  });

  it('skips people with no name — there is nothing to type', () => {
    expect(matchPeople(people, '').every((p) => p.name)).toBe(true);
  });

  it('caps the list so the picker cannot swallow the screen', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `id${i}`, name: `Alex ${i}` }));
    expect(matchPeople(many, 'alex', 5)).toHaveLength(5);
  });
});

describe('applyMention', () => {
  const alice = people[0];

  it('replaces the typed @word with a full marker', () => {
    const out = applyMention('nice one @ali', 9, 13, alice);
    expect(out.text).toBe(`nice one @[Alice Kumar](${alice.id}) `);
  });

  it('leaves the caret after the marker, not inside a uuid', () => {
    const out = applyMention('nice one @ali', 9, 13, alice);
    expect(out.caret).toBe(out.text.length);
  });

  it('keeps whatever came after the caret', () => {
    const out = applyMention('@ali went far', 0, 4, alice);
    expect(out.text).toBe(`@[Alice Kumar](${alice.id})  went far`);
  });

  it('strips brackets from a name so it cannot break the format', () => {
    const odd = { id: alice.id, name: 'Al[ice]' };
    const out = applyMention('@al', 0, 3, odd);
    expect(out.text).toBe(`@[Alice](${alice.id}) `);
  });
});
