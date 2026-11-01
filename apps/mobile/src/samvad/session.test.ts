import { afterEach, describe, expect, it, vi } from 'vitest';

import { samvadApi, SamvadApiError } from './api';
import { useSamvadAuthStore } from './auth-state';
import {
  clearSamvadTokens,
  loadSamvadTokens,
  withSamvadTokenRefresh,
} from './session';

describe('Samvad session renewal', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearSamvadTokens();
    useSamvadAuthStore.setState({ accountState: null, session: null });
  });

  it('rotates stored tokens and retries one unauthorized request', async () => {
    const originalTokens = {
      accessToken: 'expired-access',
      refreshToken: 'current-refresh',
      tokenType: 'Bearer' as const,
    };
    const refreshedTokens = {
      accessToken: 'fresh-access',
      refreshToken: 'rotated-refresh',
      tokenType: 'Bearer' as const,
    };
    vi.spyOn(samvadApi, 'refresh').mockResolvedValue(refreshedTokens);
    const request = vi
      .fn<(accessToken: string) => Promise<string>>()
      .mockRejectedValueOnce(new SamvadApiError('Expired', 401))
      .mockResolvedValueOnce('profile');

    await expect(
      withSamvadTokenRefresh(originalTokens, request),
    ).resolves.toEqual({ result: 'profile', tokens: refreshedTokens });
    await expect(loadSamvadTokens()).resolves.toEqual(refreshedTokens);
    expect(request).toHaveBeenNthCalledWith(1, 'expired-access');
    expect(request).toHaveBeenNthCalledWith(2, 'fresh-access');
    expect(samvadApi.refresh).toHaveBeenCalledWith('current-refresh');
  });

  it('does not refresh non-authentication failures', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer' as const,
    };
    const refresh = vi.spyOn(samvadApi, 'refresh');

    await expect(
      withSamvadTokenRefresh(tokens, () =>
        Promise.reject(new SamvadApiError('Validation failed', 400)),
      ),
    ).rejects.toEqual(new SamvadApiError('Validation failed', 400));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('clears local tokens when a refresh token is rejected', async () => {
    const tokens = {
      accessToken: 'expired-access',
      refreshToken: 'expired-refresh',
      tokenType: 'Bearer' as const,
    };
    vi.spyOn(samvadApi, 'refresh').mockRejectedValue(
      new SamvadApiError('Sign in again', 401),
    );

    await expect(
      withSamvadTokenRefresh(tokens, () =>
        Promise.reject(new SamvadApiError('Expired', 401)),
      ),
    ).rejects.toEqual(new SamvadApiError('Sign in again', 401));
    await expect(loadSamvadTokens()).resolves.toBeNull();
  });

  it('does not refresh a blocked account and exposes its machine-readable state', async () => {
    const tokens = {
      accessToken: 'blocked-access',
      refreshToken: 'blocked-refresh',
      tokenType: 'Bearer' as const,
    };
    const accountState = {
      reason: 'TRUST_AND_SAFETY_REVIEW',
      status: 'SUSPENDED' as const,
      statusChangedAt: '2026-11-01T10:00:00.000Z',
    };
    const refresh = vi.spyOn(samvadApi, 'refresh');

    await expect(
      withSamvadTokenRefresh(tokens, () =>
        Promise.reject(
          new SamvadApiError(
            'This account is suspended.',
            401,
            'AUTH_ACCOUNT_SUSPENDED',
            null,
            accountState,
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: 'AUTH_ACCOUNT_SUSPENDED' });

    expect(refresh).not.toHaveBeenCalled();
    expect(useSamvadAuthStore.getState().accountState).toEqual(accountState);
  });
});
