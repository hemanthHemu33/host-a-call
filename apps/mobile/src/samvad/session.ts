import { secureStorage } from '@/platform/secure-storage';

import { isUnauthorized, samvadApi, type SamvadTokens } from './api';

const storageKey = 'connecto.samvad.tokens';
let cachedTokens: SamvadTokens | null = null;

const isTokens = (value: unknown): value is SamvadTokens => {
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

export const loadSamvadTokens = async () => {
  if (cachedTokens !== null) {
    return cachedTokens;
  }

  const value = await secureStorage.getItemAsync(storageKey);

  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isTokens(parsed)) {
      throw new Error('Invalid token payload.');
    }

    cachedTokens = parsed;
    return cachedTokens;
  } catch {
    await secureStorage.deleteItemAsync(storageKey);
    return null;
  }
};

export const saveSamvadTokens = async (tokens: SamvadTokens) => {
  cachedTokens = tokens;
  await secureStorage.setItemAsync(storageKey, JSON.stringify(tokens));
};

export const clearSamvadTokens = async () => {
  cachedTokens = null;
  await secureStorage.deleteItemAsync(storageKey);
};

export const withSamvadTokenRefresh = async <T>(
  tokens: SamvadTokens,
  request: (accessToken: string) => Promise<T>,
) => {
  try {
    return { result: await request(tokens.accessToken), tokens };
  } catch (caught: unknown) {
    if (!isUnauthorized(caught)) {
      throw caught;
    }

    let refreshedTokens: SamvadTokens;

    try {
      refreshedTokens = await samvadApi.refresh(tokens.refreshToken);
    } catch (refreshError: unknown) {
      if (isUnauthorized(refreshError)) {
        await clearSamvadTokens();
      }
      throw refreshError;
    }

    await saveSamvadTokens(refreshedTokens);

    return {
      result: await request(refreshedTokens.accessToken),
      tokens: refreshedTokens,
    };
  }
};
