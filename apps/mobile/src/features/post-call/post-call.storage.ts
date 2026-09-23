import { secureStorage } from '@/platform/secure-storage';
import {
  postCallPersistedStateSchema,
  type PostCallPersistedState,
} from './post-call.models';

const postCallStorageKey = 'connecto.post-call.state.v1';

let cachedPostCallState: PostCallPersistedState | null = null;

export const loadStoredPostCallState = async () => {
  if (cachedPostCallState !== null) {
    return cachedPostCallState;
  }

  const serialized = await secureStorage.getItemAsync(postCallStorageKey);

  if (serialized === null) {
    return null;
  }

  try {
    const parsed = postCallPersistedStateSchema.parse(JSON.parse(serialized));
    cachedPostCallState = parsed;
    return parsed;
  } catch {
    await secureStorage.deleteItemAsync(postCallStorageKey);
    cachedPostCallState = null;
    return null;
  }
};

export const persistStoredPostCallState = async (
  state: PostCallPersistedState,
) => {
  const parsed = postCallPersistedStateSchema.parse(state);
  cachedPostCallState = parsed;
  await secureStorage.setItemAsync(postCallStorageKey, JSON.stringify(parsed));
};

export const clearStoredPostCallState = async () => {
  cachedPostCallState = null;
  await secureStorage.deleteItemAsync(postCallStorageKey);
};

export const resetPostCallStateCache = () => {
  cachedPostCallState = null;
};
