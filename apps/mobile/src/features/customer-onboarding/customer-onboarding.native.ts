import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { createApiError, FrontendApiError } from '@connecto/domain';

import type { CustomerOnboardingImageDraft } from '@/store/auth.store';

import type {
  CustomerOnboardingDevicePermissionResult,
  CustomerOnboardingLocationPermissionResult,
  CustomerOnboardingNotificationPermissionResult,
} from './customer-onboarding.models';

type NotificationsPermissionStatus = Awaited<
  ReturnType<typeof Notifications.getPermissionsAsync>
>;

const asFrontendApiError = (input: {
  code: 'server' | 'validation';
  message: string;
  retryable?: boolean;
}) =>
  new FrontendApiError(
    createApiError({
      code: input.code,
      message: input.message,
      ...(input.retryable === undefined ? {} : { retryable: input.retryable }),
    }),
  );

const hasMediaLibraryAccess = (
  permission: Awaited<
    ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>
  >,
) => permission.granted || permission.accessPrivileges === 'limited';

const fileNameFromAsset = (asset: {
  fileName?: string | null;
  uri: string;
}) => {
  if (asset.fileName !== null && asset.fileName !== undefined) {
    return asset.fileName;
  }

  const segments = asset.uri.split('/');
  return segments.at(-1) ?? 'profile-image.jpg';
};

const toOnboardingImageDraft = (
  asset: ImagePicker.ImagePickerAsset,
): CustomerOnboardingImageDraft => ({
  cropLabel: `Square crop ready - ${String(asset.width)}x${String(asset.height)}`,
  localUri: asset.uri,
  previewUri: asset.uri,
  sourceName: fileNameFromAsset(asset),
});

const allowsNotifications = (permissions: NotificationsPermissionStatus) =>
  permissions.granted ||
  permissions.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
  permissions.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL ||
  permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

const permissionFallbackMs = 12_000;
const locationReadFallbackMs = 5_000;

const requestWithCurrentStateFallback = async <T>(
  requestPermission: () => Promise<T>,
  readCurrentPermission: () => Promise<T>,
) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fallbackSignal = Symbol('permission-timeout');
  const fallback = new Promise<typeof fallbackSignal>((resolve) => {
    timeout = setTimeout(() => {
      resolve(fallbackSignal);
    }, permissionFallbackMs);
  });

  const result = await Promise.race([requestPermission(), fallback]);

  if (timeout !== undefined) {
    clearTimeout(timeout);
  }

  if (result === fallbackSignal) {
    return readCurrentPermission();
  }

  return result;
};

const ensureMediaLibraryPermission = async () => {
  if (Platform.OS === 'web') {
    return;
  }

  const current = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (hasMediaLibraryAccess(current)) {
    return;
  }

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!hasMediaLibraryAccess(requested)) {
    throw asFrontendApiError({
      code: 'validation',
      message: 'Allow photo library access to choose a profile image.',
      retryable: false,
    });
  }
};

export const selectNativeOnboardingProfileImage =
  async (): Promise<CustomerOnboardingImageDraft | null> => {
    await ensureMediaLibraryPermission();

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];

    if (asset === undefined) {
      throw asFrontendApiError({
        code: 'server',
        message: 'The selected image could not be read.',
      });
    }

    return toOnboardingImageDraft(asset);
  };

export const updateNativeOnboardingProfileImageCrop = async () =>
  selectNativeOnboardingProfileImage();

export const requestNativeNotificationPermission =
  async (): Promise<CustomerOnboardingNotificationPermissionResult> => {
    const requestedAtIso = new Date().toISOString();

    try {
      const currentPermissions = await Notifications.getPermissionsAsync();

      if (allowsNotifications(currentPermissions)) {
        return {
          requestedAtIso,
          status: 'granted',
        };
      }

      const nextPermissions = !currentPermissions.canAskAgain
        ? currentPermissions
        : await requestWithCurrentStateFallback(
            () =>
              Notifications.requestPermissionsAsync({
                ios: {
                  allowAlert: true,
                  allowBadge: true,
                  allowSound: true,
                },
              }),
            Notifications.getPermissionsAsync,
          );

      return {
        requestedAtIso,
        status: allowsNotifications(nextPermissions) ? 'granted' : 'not-now',
      };
    } catch {
      return {
        requestedAtIso,
        status: 'not-now',
      };
    }
  };

const cameraPermissionGranted = (
  permission: Awaited<ReturnType<typeof ImagePicker.getCameraPermissionsAsync>>,
) => permission.granted;

const microphonePermissionGranted = (
  permission: Awaited<ReturnType<typeof getRecordingPermissionsAsync>>,
) => permission.granted;

type LocationModule = typeof Location;
type ForegroundLocationPermission = Awaited<
  ReturnType<LocationModule['getForegroundPermissionsAsync']>
>;

const locationPermissionGranted = (permission: ForegroundLocationPermission) =>
  permission.granted;

const formatLocationPlaceLabel = (
  address: Location.LocationGeocodedAddress | undefined,
) => {
  if (address === undefined) {
    return null;
  }

  const parts = [
    address.city,
    address.district,
    address.subregion,
    address.region,
    address.country,
  ].filter((part): part is string => part !== null && part.trim().length > 0);
  const uniqueParts = [...new Set(parts.map((part) => part.trim()))];

  return uniqueParts.length === 0 ? null : uniqueParts.slice(0, 3).join(', ');
};

const formatCoordinatePlaceLabel = (coords: {
  latitude: number;
  longitude: number;
}) => `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;

const getCurrentLocationWithTimeout = async (Location: LocationModule) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutSignal = Symbol('location-timeout');
  const fallback = new Promise<typeof timeoutSignal>((resolve) => {
    timeout = setTimeout(() => {
      resolve(timeoutSignal);
    }, locationReadFallbackMs);
  });

  const result = await Promise.race([
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: false,
    }),
    fallback,
  ]);

  if (timeout !== undefined) {
    clearTimeout(timeout);
  }

  if (result !== timeoutSignal) {
    return result;
  }

  return Location.getLastKnownPositionAsync({
    maxAge: 30 * 60 * 1000,
    requiredAccuracy: 10000,
  });
};

export const requestNativeLocationPermission =
  async (): Promise<CustomerOnboardingLocationPermissionResult> => {
    const requestedAtIso = new Date().toISOString();

    try {
      const currentPermissions = await Location.getForegroundPermissionsAsync();
      const nextPermissions = locationPermissionGranted(currentPermissions)
        ? currentPermissions
        : await requestWithCurrentStateFallback(
            () => Location.requestForegroundPermissionsAsync(),
            () => Location.getForegroundPermissionsAsync(),
          );

      if (!locationPermissionGranted(nextPermissions)) {
        return {
          accuracyMeters: null,
          latitude: null,
          longitude: null,
          placeLabel: null,
          requestedAtIso,
          status: 'not-now',
        };
      }

      const position = await getCurrentLocationWithTimeout(Location);

      if (position === null) {
        return {
          accuracyMeters: null,
          latitude: null,
          longitude: null,
          placeLabel: null,
          requestedAtIso,
          status: 'not-now',
        };
      }

      let placeLabel: string | null = formatCoordinatePlaceLabel(
        position.coords,
      );

      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        placeLabel = formatLocationPlaceLabel(addresses[0]) ?? placeLabel;
      } catch {
        placeLabel = formatCoordinatePlaceLabel(position.coords);
      }

      return {
        accuracyMeters: position.coords.accuracy,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        placeLabel,
        requestedAtIso,
        status: 'granted',
      };
    } catch {
      return {
        accuracyMeters: null,
        latitude: null,
        longitude: null,
        placeLabel: null,
        requestedAtIso,
        status: 'not-now',
      };
    }
  };

export const requestNativeMicrophonePermission =
  async (): Promise<CustomerOnboardingDevicePermissionResult> => {
    const requestedAtIso = new Date().toISOString();

    try {
      const currentPermissions = await getRecordingPermissionsAsync();
      const nextPermissions = microphonePermissionGranted(currentPermissions)
        ? currentPermissions
        : await requestWithCurrentStateFallback(
            requestRecordingPermissionsAsync,
            getRecordingPermissionsAsync,
          );

      return {
        requestedAtIso,
        status: microphonePermissionGranted(nextPermissions)
          ? 'granted'
          : 'not-now',
      };
    } catch {
      return {
        requestedAtIso,
        status: 'not-now',
      };
    }
  };

export const requestNativeCameraPermission =
  async (): Promise<CustomerOnboardingDevicePermissionResult> => {
    const requestedAtIso = new Date().toISOString();

    try {
      const currentPermissions = await ImagePicker.getCameraPermissionsAsync();
      const nextPermissions = cameraPermissionGranted(currentPermissions)
        ? currentPermissions
        : await requestWithCurrentStateFallback(
            ImagePicker.requestCameraPermissionsAsync,
            ImagePicker.getCameraPermissionsAsync,
          );

      return {
        requestedAtIso,
        status: cameraPermissionGranted(nextPermissions)
          ? 'granted'
          : 'not-now',
      };
    } catch {
      return {
        requestedAtIso,
        status: 'not-now',
      };
    }
  };
