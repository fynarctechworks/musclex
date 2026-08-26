/** Deep links from a push payload are untrusted input. */
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { __safeRoute } from '../use-push-router';

describe('push deep-link safety', () => {
  it('accepts an in-app path', () => {
    expect(__safeRoute({ route: '/member/123' })).toBe('/member/123');
  });

  it.each([
    ['an external url', { route: 'https://evil.example/steal' }],
    ['a protocol-relative url', { route: '//evil.example' }],
    ['a non-string', { route: 42 }],
    ['a missing route', {}],
    ['null data', null],
  ])('rejects %s', (_label, data) => {
    expect(__safeRoute(data)).toBeNull();
  });
});
