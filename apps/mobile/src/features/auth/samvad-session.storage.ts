import { secureStorage } from '@/platform/secure-storage';

import type { SamvadTokens } from './samvad-auth.api';

const samvadTokensStorageKey = 'connecto.samvad.tokens';

let cachedTokens: SamvadTokens | null = null;

const isSamvadTokens = (value: unknown): value is SamvadTokens => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SamvadTokens>;
  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === 'string' &&
    candidate.refreshToken.length > 0 &&
    candidate.tokenType === 'Bearer'
  );
};

export const loadSamvadTokens = async (): Promise<SamvadTokens | null> => {
  if (cachedTokens !== null) {
    return cachedTokens;
  }

  const raw = await secureStorage.getItemAsync(samvadTokensStorageKey);

  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isSamvadTokens(parsed)) {
      throw new Error('Stored Samvad tokens are invalid.');
    }

    cachedTokens = parsed;
    return cachedTokens;
  } catch {
    await secureStorage.deleteItemAsync(samvadTokensStorageKey);
    return null;
  }
};

export const saveSamvadTokens = async (tokens: SamvadTokens) => {
  cachedTokens = tokens;
  await secureStorage.setItemAsync(samvadTokensStorageKey, JSON.stringify(tokens));
  return tokens;
};

export const clearSamvadTokens = async () => {
  cachedTokens = null;
  await secureStorage.deleteItemAsync(samvadTokensStorageKey);
};
