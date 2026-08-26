import { changedFields } from '../lib/diff';

/**
 * The rule this protects: a four-field phone form must never overwrite the
 * twenty-six fields it did not show.
 */
describe('changedFields', () => {
  const original = { full_name: 'Neha Patel', phone: '9810000021', email: 'neha@example.com' };

  it('returns nothing when nothing changed', () => {
    expect(changedFields(original, { ...original })).toEqual({});
  });

  it('returns only the field that changed', () => {
    const out = changedFields(original, { ...original, phone: '9810000099' });
    expect(out).toEqual({ phone: '9810000099' });
  });

  it('never includes a field the form did not carry', () => {
    // date_of_birth is absent from the edited object, so it must not appear —
    // this is what stops the phone blanking web-collected data.
    const out = changedFields(original, { ...original, full_name: 'Neha S Patel' });
    expect(Object.keys(out)).toEqual(['full_name']);
  });

  it('does not treat a trailing space as an edit', () => {
    expect(changedFields(original, { ...original, full_name: 'Neha Patel  ' })).toEqual({});
  });

  it('trims the value it does send', () => {
    expect(changedFields(original, { ...original, full_name: '  Neha S Patel  ' }))
      .toEqual({ full_name: 'Neha S Patel' });
  });

  it('treats clearing a field as a change to empty', () => {
    expect(changedFields(original, { ...original, email: '' })).toEqual({ email: '' });
  });

  it('treats null and undefined and empty alike on the original side', () => {
    // A member with no email on record must not look "changed" when the form
    // renders that absence as an empty input.
    expect(changedFields({ email: null } as any, { email: '' } as any)).toEqual({});
    expect(changedFields({ email: undefined } as any, { email: '' } as any)).toEqual({});
  });

  it('reports several changes at once', () => {
    const out = changedFields(original, { full_name: 'X', phone: 'Y', email: 'Z' });
    expect(out).toEqual({ full_name: 'X', phone: 'Y', email: 'Z' });
  });
});
