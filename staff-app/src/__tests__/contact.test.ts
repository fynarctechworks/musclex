import { normalisePhone } from '../lib/contact';

describe('normalisePhone', () => {
  it('strips formatting', () => {
    expect(normalisePhone('98 100-00021')).toBe('9810000021');
    expect(normalisePhone(' (981) 000 0021 ')).toBe('9810000021');
  });

  it('keeps a leading + for international numbers', () => {
    // Dropping the + turns an international number into a local one, which
    // silently dials the wrong person.
    expect(normalisePhone('+91 98100 00021')).toBe('+919810000021');
  });

  it('does not invent a + that was not there', () => {
    expect(normalisePhone('919810000021')).toBe('919810000021');
  });
});
