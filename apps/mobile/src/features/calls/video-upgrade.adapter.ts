import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';

import {
  callPreconnectRuntimeConfig,
  type CallRuntimeConfig,
} from './call.preconnect';

export type VideoUpgradeCameraPermissionState = 'denied' | 'granted' | 'prompt';

export interface VideoUpgradePermissionAdapter {
  getCameraPermission(): Promise<VideoUpgradeCameraPermissionState>;
  openSettings(): Promise<void>;
  requestCameraPermission(): Promise<
    Exclude<VideoUpgradeCameraPermissionState, 'prompt'>
  >;
}

const cameraPermissionFromNative = (
  permission: Awaited<ReturnType<typeof ImagePicker.getCameraPermissionsAsync>>,
): VideoUpgradeCameraPermissionState => {
  if (permission.granted) {
    return 'granted';
  }

  return permission.canAskAgain ? 'prompt' : 'denied';
};

export const createMockVideoUpgradePermissionAdapter = ({
  runtimeConfig,
}: {
  runtimeConfig: CallRuntimeConfig;
}): VideoUpgradePermissionAdapter => ({
  getCameraPermission: () => Promise.resolve(runtimeConfig.cameraPermission),
  openSettings: () => Promise.resolve(),
  requestCameraPermission: () =>
    Promise.resolve(runtimeConfig.cameraRequestOutcome),
});

export const createNativeVideoUpgradePermissionAdapter =
  (): VideoUpgradePermissionAdapter => ({
    getCameraPermission: async () =>
      cameraPermissionFromNative(await ImagePicker.getCameraPermissionsAsync()),
    openSettings: async () => {
      await Linking.openURL('app-settings:');
    },
    requestCameraPermission: async () => {
      const permission = cameraPermissionFromNative(
        await ImagePicker.requestCameraPermissionsAsync(),
      );

      return permission === 'prompt' ? 'denied' : permission;
    },
  });

export const videoUpgradePermissionAdapter =
  callPreconnectRuntimeConfig.providerMode === 'mock'
    ? createMockVideoUpgradePermissionAdapter({
        runtimeConfig: callPreconnectRuntimeConfig,
      })
    : createNativeVideoUpgradePermissionAdapter();
