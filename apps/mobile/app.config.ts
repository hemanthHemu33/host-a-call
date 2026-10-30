import type { ExpoConfig } from 'expo/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const parseBoolean = (value: string | undefined, fallback: boolean) =>
  value === 'true' ? true : value === 'false' ? false : fallback;
const optionalUrl = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0
    ? null
    : normalized;
};
const parseMobileRuntimeConfig = (
  input: Record<string, string | undefined>,
) => {
  const environment = ['development', 'preview', 'production'].includes(
    input.EXPO_PUBLIC_CONNECTO_ENV ?? '',
  )
    ? (input.EXPO_PUBLIC_CONNECTO_ENV as
        'development' | 'preview' | 'production')
    : 'development';
  const mockMode = parseBoolean(input.EXPO_PUBLIC_CONNECTO_MOCK_MODE, false);
  const apiBaseUrl =
    input.EXPO_PUBLIC_CONNECTO_API_BASE_URL?.trim() ||
    'http://10.0.2.2:4000/api/v1';

  new URL(apiBaseUrl);

  return {
    apiBaseUrl,
    deepLinkHost:
      input.EXPO_PUBLIC_CONNECTO_DEEP_LINK_HOST?.trim() || 'connecto.local',
    environment,
    iosUpdateUrl: optionalUrl(input.EXPO_PUBLIC_CONNECTO_IOS_UPDATE_URL),
    mockMode,
    providerMode: mockMode
      ? 'mock'
      : input.EXPO_PUBLIC_CONNECTO_PROVIDER === 'production'
        ? 'production'
        : 'staging',
    androidUpdateUrl: optionalUrl(
      input.EXPO_PUBLIC_CONNECTO_ANDROID_UPDATE_URL,
    ),
  } as const;
};

const runtimeConfig = parseMobileRuntimeConfig(process.env);
const androidGoogleServicesFile = './google-services.json';
const iosGoogleServicesFile = './GoogleService-Info.plist';
const hasAndroidGoogleServices = existsSync(
  join(__dirname, androidGoogleServicesFile),
);
const hasIosGoogleServices = existsSync(join(__dirname, iosGoogleServicesFile));

if (!runtimeConfig.mockMode && !hasAndroidGoogleServices) {
  throw new Error(
    'Samvad phone authentication requires apps/mobile/google-services.json from the configured Firebase project.',
  );
}

const firebasePlugins =
  hasAndroidGoogleServices || hasIosGoogleServices
    ? [
        '@react-native-firebase/app',
        '@react-native-firebase/auth',
        './plugins/with-compatible-firebase-android-bom',
      ]
    : [];

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
    ['expo-router', { root: './src/samvad-app' }],
    'expo-dev-client',
    ...firebasePlugins,
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
    ...(hasIosGoogleServices
      ? { googleServicesFile: iosGoogleServicesFile }
      : {}),
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
    ...(hasAndroidGoogleServices
      ? { googleServicesFile: androidGoogleServicesFile }
      : {}),
  },
  extra: {
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    environment: runtimeConfig.environment,
    mockMode: runtimeConfig.mockMode,
    provider: runtimeConfig.providerMode,
  },
};

export default config;
