/**
 * Push registration — the properties that matter are all about NOT leaking a
 * handset between people, and about push never being able to break sign-in.
 */
import { Platform } from 'react-native';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } }, deviceName: 'Front Desk iPad' },
}));

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetToken = jest.fn();
const mockNotificationsModule = {
  getPermissionsAsync: (...a: unknown[]) => mockGetPermissions(...a),
  requestPermissionsAsync: (...a: unknown[]) => mockRequestPermissions(...a),
  getExpoPushTokenAsync: (...a: unknown[]) => mockGetToken(...a),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
};
/** null models a build without the native module — see notifications-module.ts. */
let mockAvailableModule: unknown = mockNotificationsModule;
jest.mock('@/push/notifications-module', () => ({
  getNotifications: () => mockAvailableModule,
  __resetNotificationsModule: jest.fn(),
}));

const mockPost = jest.fn();
jest.mock('@/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a) } }));
jest.mock('@/observability/sentry', () => ({ reportHandled: jest.fn() }));

import {
  __resetPushRegistration,
  currentPushToken,
  registerForPush,
  unregisterForPush,
} from '../push-registration';

const TOKEN = 'ExponentPushToken[abc123]';

beforeEach(() => {
  jest.clearAllMocks();
  __resetPushRegistration();
  Platform.OS = 'ios';
  mockAvailableModule = mockNotificationsModule;
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mockGetToken.mockResolvedValue({ data: TOKEN });
  mockPost.mockResolvedValue({ registered: true });
});

describe('registerForPush', () => {
  it('registers the device token for the current gym', async () => {
    await expect(registerForPush()).resolves.toBe(TOKEN);
    expect(mockPost).toHaveBeenCalledWith('/staff-push/register', {
      token: TOKEN,
      platform: 'ios',
      device_name: 'Front Desk iPad',
    });
  });

  it('asks for permission only when it has not already been granted', async () => {
    await registerForPush();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('prompts when permission is undetermined', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ granted: true });
    await expect(registerForPush()).resolves.toBe(TOKEN);
    expect(mockRequestPermissions).toHaveBeenCalled();
  });

  it('gives up quietly when permission is denied — never throws', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(registerForPush()).resolves.toBeNull();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('gives up quietly when the OS token call throws (simulator)', async () => {
    mockGetToken.mockRejectedValue(new Error('must be a physical device'));
    await expect(registerForPush()).resolves.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('does not prompt more than once for concurrent calls', async () => {
    const [a, b] = await Promise.all([registerForPush(), registerForPush()]);
    expect(a).toBe(TOKEN);
    expect(b).toBe(TOKEN);
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a build without the native module — never a red screen', async () => {
    mockAvailableModule = null;
    await expect(registerForPush()).resolves.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('keeps the OS token when the server call fails, so sign-out can still clear it', async () => {
    mockPost.mockRejectedValue(new Error('offline'));
    await expect(registerForPush()).resolves.toBeNull();
    expect(currentPushToken()).toBe(TOKEN);
  });
});

describe('unregisterForPush', () => {
  it('clears the token server-side', async () => {
    await registerForPush();
    await unregisterForPush();
    expect(mockPost).toHaveBeenLastCalledWith(
      '/staff-push/unregister',
      { token: TOKEN },
      { timeoutMs: 5_000 },
    );
  });

  it('forgets the token locally even when the network call fails', async () => {
    await registerForPush();
    mockPost.mockRejectedValue(new Error('offline'));
    await expect(unregisterForPush()).resolves.toBeUndefined();
    expect(currentPushToken()).toBeNull();
  });

  it('is a no-op when nothing was ever registered', async () => {
    await unregisterForPush();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
