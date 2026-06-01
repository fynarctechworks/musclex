import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from '../../api/endpoints';

/**
 * Request push permission, get the device token, and register it with the BFF
 * (POST /notifications/device-tokens). The contract expects an FCM token +
 * platform; we use Expo's device push token (FCM on Android / APNs on iOS).
 */
export async function enablePush(): Promise<'granted' | 'denied' | 'error'> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'denied';

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await api.registerDeviceToken(String(tokenResp.data), platform);
    return 'granted';
  } catch {
    return 'error';
  }
}
