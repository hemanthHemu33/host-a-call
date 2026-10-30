import { z } from 'zod';

const environmentSchema = z.enum(['development', 'preview', 'production']);
const providerModeSchema = z.enum(['mock', 'staging', 'production']);

const parseBoolean = (value: string | undefined, fallback: boolean) =>
  value === 'true' ? true : value === 'false' ? false : fallback;

const optionalUrl = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0
    ? null
    : normalized;
};

export const parseMobileRuntimeConfig = (
  input: Record<string, string | undefined>,
) => {
  const environment = environmentSchema
    .catch('development')
    .parse(input.EXPO_PUBLIC_CONNECTO_ENV);
  const mockMode = parseBoolean(input.EXPO_PUBLIC_CONNECTO_MOCK_MODE, false);

  return {
    agoraAppId: input.EXPO_PUBLIC_CONNECTO_AGORA_APP_ID?.trim() || null,
    androidUpdateUrl: optionalUrl(
      input.EXPO_PUBLIC_CONNECTO_ANDROID_UPDATE_URL,
    ),
    apiBaseUrl: z
      .url()
      .parse(
        input.EXPO_PUBLIC_CONNECTO_API_BASE_URL?.trim() ||
          'http://10.0.2.2:4000/api/v1',
      ),
    deepLinkHost:
      input.EXPO_PUBLIC_CONNECTO_DEEP_LINK_HOST?.trim() || 'connecto.local',
    environment,
    featureFlags: {
      analytics: parseBoolean(
        input.EXPO_PUBLIC_CONNECTO_ENABLE_ANALYTICS,
        false,
      ),
      referrals: parseBoolean(
        input.EXPO_PUBLIC_CONNECTO_ENABLE_REFERRALS,
        true,
      ),
      rive: parseBoolean(input.EXPO_PUBLIC_CONNECTO_ENABLE_RIVE, true),
      skiaHeavyVisuals: parseBoolean(
        input.EXPO_PUBLIC_CONNECTO_ENABLE_SKIA_HEAVY_VISUALS,
        true,
      ),
      videoUpgrade: parseBoolean(
        input.EXPO_PUBLIC_CONNECTO_ENABLE_VIDEO_UPGRADE,
        true,
      ),
    },
    iosUpdateUrl: optionalUrl(input.EXPO_PUBLIC_CONNECTO_IOS_UPDATE_URL),
    mockMode,
    providerMode: mockMode
      ? 'mock'
      : providerModeSchema
          .catch('staging')
          .parse(input.EXPO_PUBLIC_CONNECTO_PROVIDER),
  } as const;
};

export const mobileRuntimeConfig = parseMobileRuntimeConfig(process.env);
