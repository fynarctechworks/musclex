import { phoneTail } from '../contacts';

/**
 * The normalisation that decides whether contact matching finds anybody.
 * Our own `phone` column holds the same person both with and without a country
 * code, so this has to collapse those to one key or half of every match is lost.
 */
describe('phoneTail', () => {
  it('collapses the same number written several ways', () => {
    const forms = ['9877000111', '+919877000111', '919877000111', '098770 00111', '+91 98770-00111'];
    const tails = new Set(forms.map(phoneTail));
    expect(tails.size).toBe(1);
    expect([...tails][0]).toBe('9877000111');
  });

  it('strips spaces, dashes, brackets and plus signs', () => {
    expect(phoneTail('(987) 700-0111')).toBe('9877000111');
  });

  it('rejects anything too short to be a phone number', () => {
    // A three-digit "contact" would otherwise hash and match somebody.
    expect(phoneTail('123')).toBeNull();
    expect(phoneTail('')).toBeNull();
    expect(phoneTail('abc')).toBeNull();
  });

  it('keeps the last ten digits of a longer international number', () => {
    expect(phoneTail('+1 415 555 0123')).toBe('4155550123');
  });
});
