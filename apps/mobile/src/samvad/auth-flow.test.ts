import { describe, expect, it } from 'vitest';

import type { SamvadSession } from './api';
import { normalizeIndianPhoneNumber, routeForSamvadSession } from './auth-flow';

const session = (input: {
  isProfileComplete: boolean;
  role: 'CALLER' | 'HOST';
}): SamvadSession => ({
  profile: null,
  tokens: {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
  },
  user: {
    id: 'user-1',
    isNewUser: !input.isProfileComplete,
    isProfileComplete: input.isProfileComplete,
    phoneNumber: '+919999999999',
    role: input.role,
  },
});

describe('Samvad auth flow', () => {
  it('normalizes valid Indian mobile numbers', () => {
    expect(normalizeIndianPhoneNumber('99999 99999')).toBe('+919999999999');
    expect(normalizeIndianPhoneNumber('+91 99999 99999')).toBe('+919999999999');
    expect(normalizeIndianPhoneNumber('123')).toBeNull();
  });

  it('routes incomplete, Caller, and Host sessions correctly', () => {
    expect(
      routeForSamvadSession(
        session({ isProfileComplete: false, role: 'CALLER' }),
      ),
    ).toBe('/onboarding');
    expect(
      routeForSamvadSession(
        session({ isProfileComplete: true, role: 'CALLER' }),
      ),
    ).toBe('/account');
    expect(
      routeForSamvadSession(session({ isProfileComplete: true, role: 'HOST' })),
    ).toBe('/kyc');
  });
});
