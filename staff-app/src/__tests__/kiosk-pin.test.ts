import { PIN_LENGTH, isValidPin } from '@/kiosk/pin';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(), getItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));

describe('isValidPin', () => {
  it(`accepts exactly ${PIN_LENGTH} digits`, () => {
    expect(isValidPin('1234')).toBe(true);
  });

  it.each([
    ['too short', '123'],
    ['too long', '12345'],
    ['letters', 'abcd'],
    ['mixed', '12a4'],
    ['empty', ''],
    ['spaces', '12 4'],
    ['leading sign', '+123'],
  ])('rejects %s', (_label, pin) => {
    expect(isValidPin(pin)).toBe(false);
  });

  it('accepts a PIN starting with zero', () => {
    // '0123' parsed as a number would lose the leading zero; it is a STRING.
    expect(isValidPin('0123')).toBe(true);
  });
});
