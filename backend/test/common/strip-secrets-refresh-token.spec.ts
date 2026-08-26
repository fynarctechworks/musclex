import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import { StripSecretsInterceptor } from '../../src/common/interceptors/strip-secrets.interceptor';

/**
 * `refresh_token` is stripped everywhere EXCEPT the endpoints that mint one.
 *
 * It was on the global strip list with no exemption, so the login response —
 * whose entire job is to hand back a session — arrived without it. The mobile
 * client therefore could not refresh silently and had to sign the user out on
 * every 401, which is why long sessions kept dying mid-shift.
 */
describe('StripSecretsInterceptor — refresh_token', () => {
  const interceptor = new StripSecretsInterceptor();

  function run(url: string, body: unknown, role = 'owner') {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ url, originalUrl: url, user: { role } }),
        getResponse: () => ({ headersSent: false }),
      }),
    } as never;
    return firstValueFrom(
      interceptor.intercept(context, { handle: () => of(body) } as never),
    );
  }

  const SESSION = { access_token: 'a', refresh_token: 'r', user: { id: 'u' } };

  describe('on a session-minting route', () => {
    it.each([
      ['/api/v1/auth/login'],
      ['/api/v1/auth/refresh'],
      ['/api/v1/auth/2fa/login'],
      ['/api/v1/auth/select-workspace'],
    ])('%s keeps the refresh token', async (url) => {
      const out = (await run(url, SESSION)) as Record<string, unknown>;
      expect(out.refresh_token).toBe('r');
      expect(out.access_token).toBe('a');
    });

    it('ignores a query string when matching', async () => {
      const out = (await run('/api/v1/auth/login?next=%2Fhome', SESSION)) as Record<string, unknown>;
      expect(out.refresh_token).toBe('r');
    });

    it('still strips OTHER secrets on that route', async () => {
      // The exemption is for refresh_token alone, not a blanket pass.
      const out = (await run('/api/v1/auth/login', {
        ...SESSION, password_hash: 'x', two_factor_secret: 's',
      })) as Record<string, unknown>;
      expect(out.refresh_token).toBe('r');
      expect(out.password_hash).toBeUndefined();
      expect(out.two_factor_secret).toBeUndefined();
    });
  });

  describe('everywhere else', () => {
    it.each([
      ['/api/v1/members'],
      ['/api/v1/staff'],
      ['/api/v1/auth/sessions'],
      ['/api/v1/auth/login-history'],
    ])('%s still strips the refresh token', async (url) => {
      const out = (await run(url, SESSION)) as Record<string, unknown>;
      expect(out.refresh_token).toBeUndefined();
      expect(out.access_token).toBe('a');
    });

    it('strips it from NESTED rows too', async () => {
      // A staff or member row that happens to carry one must never go out.
      const out = (await run('/api/v1/staff', {
        data: [{ id: 's1', refresh_token: 'leak' }],
      })) as { data: Array<Record<string, unknown>> };
      expect(out.data[0].refresh_token).toBeUndefined();
    });

    it('does not match a route that merely CONTAINS the word login', async () => {
      const out = (await run('/api/v1/auth/login-history', SESSION)) as Record<string, unknown>;
      expect(out.refresh_token).toBeUndefined();
    });
  });
});
