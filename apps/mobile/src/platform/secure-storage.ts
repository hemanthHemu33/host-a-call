import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type SecureStorageLike = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

const memoryStorage = new Map<string, string>();

const getBrowserStorage = () => {
  if (Platform.OS !== 'web' || typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  try {
    const probeKey = 'connecto.storage.probe';
    globalThis.localStorage.setItem(probeKey, probeKey);
    globalThis.localStorage.removeItem(probeKey);
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

const webStorage: SecureStorageLike = {
  deleteItemAsync: (key) => {
    const browserStorage = getBrowserStorage();

    if (browserStorage === null) {
      memoryStorage.delete(key);
      return Promise.resolve();
    }

    browserStorage.removeItem(key);
    return Promise.resolve();
  },
  getItemAsync: (key) => {
    const browserStorage = getBrowserStorage();

    if (browserStorage === null) {
      return Promise.resolve(memoryStorage.get(key) ?? null);
    }

    return Promise.resolve(browserStorage.getItem(key));
  },
  setItemAsync: (key, value) => {
    const browserStorage = getBrowserStorage();

    if (browserStorage === null) {
      memoryStorage.set(key, value);
      return Promise.resolve();
    }

    browserStorage.setItem(key, value);
    return Promise.resolve();
  },
};

export const secureStorage: SecureStorageLike =
  Platform.OS === 'web' ? webStorage : SecureStore;
