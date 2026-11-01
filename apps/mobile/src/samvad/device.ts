import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { secureStorage } from '@/platform/secure-storage';

import { samvadApi, type SamvadDeviceContext } from './api';

const fingerprintStorageKey = 'connecto.samvad.device-fingerprint';

const createInstallFingerprint = () =>
  `install_${Date.now().toString(36)}_${Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2),
  ).join('_')}`;

export const getDeviceFingerprint = async () => {
  const existing = await secureStorage.getItemAsync(fingerprintStorageKey);
  if (existing !== null && existing.length >= 16) return existing;

  const created = createInstallFingerprint();
  await secureStorage.setItemAsync(fingerprintStorageKey, created);
  return created;
};

const hasNotificationPermission = (
  permission: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
) =>
  permission.granted ||
  permission.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
  permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL ||
  permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

export const getNativeNotificationToken = async () => {
  if (Platform.OS === 'web') return null;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!hasNotificationPermission(permission)) return null;
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' && token.data.length >= 16
      ? token.data
      : null;
  } catch {
    return null;
  }
};

export const getSamvadDeviceContext =
  async (): Promise<SamvadDeviceContext> => {
    const platform = ['android', 'ios', 'web'].includes(Platform.OS)
      ? (Platform.OS as 'android' | 'ios' | 'web')
      : 'unknown';
    const [deviceFingerprint, fcmToken] = await Promise.all([
      getDeviceFingerprint(),
      getNativeNotificationToken(),
    ]);

    return {
      deviceFingerprint,
      deviceName: `${Constants.expoConfig?.name ?? 'Connecto'} on ${Platform.OS}`,
      ...(fcmToken === null ? {} : { fcmToken }),
      platform,
    };
  };

export const requestAndRegisterNotificationToken = async (
  accessToken: string,
) => {
  if (Platform.OS === 'web') {
    throw new Error(
      'Push notifications are available in the Android and iOS apps.',
    );
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = hasNotificationPermission(current)
    ? current
    : await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
  if (!hasNotificationPermission(permission)) {
    throw new Error('Notification permission was not granted.');
  }
  const token = await getNativeNotificationToken();
  if (token === null) {
    throw new Error('This device did not provide a notification token.');
  }
  await samvadApi.registerDeviceToken(accessToken, token);
  return token;
};
