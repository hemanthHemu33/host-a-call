import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultReferralUiState,
  referralUiStateSchema,
  type ReferralUiState,
} from './referral.models';

const referralUiStorageKey = 'connecto.referrals.ui-state.v1';

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

const storage: AsyncStorageLike = AsyncStorage;

let cachedReferralUiState: ReferralUiState | null = null;

export const loadReferralUiState = async () => {
  if (cachedReferralUiState !== null) {
    return cachedReferralUiState;
  }

  const raw = await storage.getItem(referralUiStorageKey);

  if (raw === null) {
    cachedReferralUiState = defaultReferralUiState;
    return cachedReferralUiState;
  }

  try {
    const parsed = referralUiStateSchema.parse(JSON.parse(raw) as unknown);
    cachedReferralUiState = parsed;
    return parsed;
  } catch {
    await storage.removeItem(referralUiStorageKey);
    cachedReferralUiState = defaultReferralUiState;
    return cachedReferralUiState;
  }
};

export const persistReferralUiState = async (state: ReferralUiState) => {
  const parsed = referralUiStateSchema.parse(state);
  cachedReferralUiState = parsed;
  await storage.setItem(referralUiStorageKey, JSON.stringify(parsed));
  return parsed;
};

export const markReferralCelebrationSeen = async (referralId: string) => {
  const current = await loadReferralUiState();
  if (current.celebratedRewardIds.includes(referralId)) {
    return current;
  }

  return persistReferralUiState({
    celebratedRewardIds: [...current.celebratedRewardIds, referralId],
  });
};

export const clearReferralUiState = async () => {
  cachedReferralUiState = null;
  await storage.removeItem(referralUiStorageKey);
};

export const resetReferralUiStateCache = () => {
  cachedReferralUiState = null;
};
