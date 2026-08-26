/**
 * A release build with no API URL must fail LOUDLY.
 *
 * `eas.json` sets EXPO_PUBLIC_API_BASE_URL on the `development` profile only,
 * so `preview` and `production` builds have none. The old fallback pointed
 * them at `http://localhost:4002` — on a tester's phone, the phone itself. The
 * app would not look misconfigured; it would look broken, on every screen.
 */
describe('API base URL', () => {
  const OLD_ENV = process.env.EXPO_PUBLIC_API_BASE_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = OLD_ENV;
    // @ts-expect-error — __DEV__ is a global injected by the RN bundler.
    global.__DEV__ = true;
    jest.resetModules();
  });

  function loadClient() {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../api/client');
  }

  it('refuses to send a request in a release build with no URL configured', async () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    // @ts-expect-error — simulate a release bundle.
    global.__DEV__ = false;

    const { request } = loadClient();
    await expect(request('/members')).rejects.toThrow(/EXPO_PUBLIC_API_BASE_URL is not set/);
  });

  it('still falls back to localhost in development', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    // @ts-expect-error — simulate a dev bundle.
    global.__DEV__ = true;

    const { API_BASE_URL } = loadClient();
    expect(API_BASE_URL).toBe('http://localhost:4002/api/v1');
  });

  it('uses the configured URL when one is set', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test/api/v1';
    // @ts-expect-error — a release bundle with a real URL is the shipping case.
    global.__DEV__ = false;

    const { API_BASE_URL } = loadClient();
    expect(API_BASE_URL).toBe('https://api.example.test/api/v1');
  });
});
