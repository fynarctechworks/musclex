import { extractMessage } from '../api/client';

/**
 * The backend speaks two error dialects. Getting this wrong shows the user
 * "[object Object]" on any form validation failure — verified against the real
 * API: POST /auth/login with a short password returns a message ARRAY.
 */
describe('extractMessage', () => {
  it('reads a plain string message (thrown HttpException)', () => {
    expect(extractMessage({ message: 'Invalid credentials' })).toBe('Invalid credentials');
  });

  it('reads the ValidationPipe array and lists each field error', () => {
    expect(
      extractMessage({ message: ['password must be longer than or equal to 8 characters'] }),
    ).toBe('password must be longer than or equal to 8 characters');
    expect(extractMessage({ message: ['a', 'b'] })).toBe('a\nb');
  });

  it('returns null for shapes it cannot read, so callers use their fallback', () => {
    expect(extractMessage({})).toBeNull();
    expect(extractMessage({ message: [] })).toBeNull();
    expect(extractMessage({ message: 42 })).toBeNull();
    expect(extractMessage(null)).toBeNull();
    expect(extractMessage('boom')).toBeNull();
  });
});
