import type { ExpoConfig } from 'expo/config';

import { parseMobileRuntimeConfig } from '@connecto/domain';

const runtimeConfig = parseMobileRuntimeConfig(process.env);

const config: ExpoConfig = {
  name: 'Connecto',
  slug: 'connecto',
  scheme: 'connecto',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  experiments: {
    typedRoutes: true,
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-status-bar',
    'expo-font',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Connecto to access your photos so you can choose a profile image during onboarding.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Connecto to use your camera after you request a video upgrade during a live call.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow Connecto to detect your city or region from this phone for safer matching.',
      },
    ],
    [
      'expo-notifications',
      {
        mode:
          runtimeConfig.environment === 'production'
            ? 'production'
            : 'development',
      },
    ],
    [
      'expo-audio',
      {
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
        microphonePermission:
          'Allow Connecto to use your microphone for voice calls after you start a call.',
        recordAudioAndroid: true,
      },
    ],
    'expo-asset',
    'expo-secure-store',
  ],
  ios: {
    associatedDomains: [`applinks:${runtimeConfig.deepLinkHost}`],
    bundleIdentifier: 'com.connecto.mobile',
    supportsTablet: false,
  },
  android: {
    intentFilters: [
      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          {
            host: runtimeConfig.deepLinkHost,
            scheme: 'https',
          },
        ],
      },
    ],
    package: 'com.connecto.mobile',
  },
  extra: {
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    environment: runtimeConfig.environment,
    mockMode: runtimeConfig.mockMode,
    provider: runtimeConfig.providerMode,
  },
};

export default config;
