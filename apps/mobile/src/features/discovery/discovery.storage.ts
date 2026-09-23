import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultDiscoveryPreferences,
  discoveryPreferencesSchema,
  type DiscoveryPreferences,
} from './discovery.models';

const discoveryPreferencesStorageKey = 'connecto.discovery.preferences';

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const storage: AsyncStorageLike = AsyncStorage;

export const loadDiscoveryPreferences =
  async (): Promise<DiscoveryPreferences> => {
    const raw = await storage.getItem(discoveryPreferencesStorageKey);

    if (raw === null) {
      return defaultDiscoveryPreferences;
    }

    try {
      return discoveryPreferencesSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      return defaultDiscoveryPreferences;
    }
  };

export const persistDiscoveryPreferences = async (
  preferences: DiscoveryPreferences,
) => {
  const parsed = discoveryPreferencesSchema.parse(preferences);
  await storage.setItem(discoveryPreferencesStorageKey, JSON.stringify(parsed));

  return parsed;
};
