import { describe, expect, it, vi } from 'vitest';

import { createSamvadApi, SamvadApiError } from './api';

describe('Samvad API client', () => {
  it('exchanges a Firebase token at the canonical Samvad endpoint', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            profile: null,
            tokens: {
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              tokenType: 'Bearer',
            },
            user: {
              id: 'user-1',
              isNewUser: true,
              isProfileComplete: false,
              phoneNumber: '+919999999999',
              role: 'CALLER',
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const api = createSamvadApi('https://samvad.example/api/v1', fetchMock);

    const session = await api.verifyFirebasePhone(
      '+919999999999',
      'firebase-id-token',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://samvad.example/api/v1/auth/otp/verify',
      expect.objectContaining({
        body: JSON.stringify({
          idToken: 'firebase-id-token',
          phoneNumber: '+919999999999',
        }),
        method: 'POST',
      }),
    );
    expect(session.tokens.accessToken).toBe('access-token');
  });

  it('preserves a backend validation message', async () => {
    const api = createSamvadApi(
      'https://samvad.example/api/v1',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: ['idToken must be valid'] }), {
            status: 401,
          }),
        ),
      ),
    );

    await expect(
      api.verifyFirebasePhone('+919999999999', 'bad-token'),
    ).rejects.toEqual(new SamvadApiError('idToken must be valid', 401));
  });

  it('rejects a successful HTTP response with an invalid auth payload', async () => {
    const api = createSamvadApi(
      'https://samvad.example/api/v1',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ accessToken: 'missing-fields' }), {
            status: 200,
          }),
        ),
      ),
    );

    await expect(api.refresh('refresh-token')).rejects.toEqual(
      new SamvadApiError('Samvad returned an invalid response.', 502),
    );
  });

  it('uses the canonical auth and KYC contracts for a complete Host flow', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer' as const,
    };
    const responses = [
      {
        profile: null,
        tokens,
        user: {
          id: 'host-1',
          isNewUser: true,
          isProfileComplete: false,
          phoneNumber: '+919999999999',
          role: 'CALLER',
        },
      },
      {
        profile: { displayName: 'Ananya' },
        tokens,
        user: {
          id: 'host-1',
          phoneNumber: '+919999999999',
          role: 'HOST',
        },
      },
      {
        isDigilockerVerified: false,
        kycStatus: 'DRAFT',
        message: 'DigiLocker KYC has not yet been initiated or completed.',
      },
      {
        authUrl: 'https://digilocker.example/authorize',
        expiresAt: '2026-10-29T14:00:00.000Z',
        instructions: 'Open DigiLocker.',
        isSandbox: true,
        state: 'state-1',
      },
      { verified: true },
      {
        isDigilockerVerified: true,
        kycStatus: 'KYC_VERIFIED',
        verifiedAt: '2026-10-29T13:45:00.000Z',
      },
      { success: true },
    ];
    const requests: { init?: RequestInit; url: string }[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      requests.push({ init, url });
      return Promise.resolve(
        new Response(JSON.stringify(responses.shift()), { status: 200 }),
      );
    });
    const api = createSamvadApi('https://samvad.example/api/v1/', fetchMock);

    const provisional = await api.verifyFirebasePhone(
      '+919999999999',
      'firebase-id-token',
    );
    const registered = await api.registerHost(
      provisional.tokens.accessToken,
      'Ananya',
    );
    const initialKyc = await api.getKycStatus(registered.tokens.accessToken);
    const initiation = await api.initiateKyc(registered.tokens.accessToken);
    await api.simulateKyc(registered.tokens.accessToken);
    const verifiedKyc = await api.getKycStatus(registered.tokens.accessToken);
    await api.logout(registered.tokens.accessToken);

    expect(registered.user).toMatchObject({
      isNewUser: false,
      isProfileComplete: true,
      role: 'HOST',
    });
    expect(initialKyc.isDigilockerVerified).toBe(false);
    expect(initiation.isSandbox).toBe(true);
    expect(verifiedKyc.isDigilockerVerified).toBe(true);
    expect(
      requests.map(({ url }) =>
        url.replace('https://samvad.example/api/v1/', ''),
      ),
    ).toEqual([
      'auth/otp/verify',
      'auth/register/host',
      'verification/digilocker/status',
      'verification/digilocker/initiate',
      'verification/digilocker/simulate',
      'verification/digilocker/status',
      'auth/logout',
    ]);
    expect(new Headers(requests[1]?.init?.headers).get('Authorization')).toBe(
      'Bearer access-token',
    );
  });
});
