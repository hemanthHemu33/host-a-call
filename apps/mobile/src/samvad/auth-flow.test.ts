import { describe, expect, it } from 'vitest';

import type { SamvadSession } from './api';
import {
  ageForDateOfBirth,
  normalizeIndianPhoneNumber,
  routeForSamvadSession,
} from './auth-flow';

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
    expect(normalizeIndianPhoneNumber('5123456789')).toBeNull();
    expect(normalizeIndianPhoneNumber('+1 415 555 2671')).toBeNull();
  });

  it('routes incomplete, Caller, and Host sessions correctly', () => {
    expect(
      routeForSamvadSession(
        session({ isProfileComplete: false, role: 'CALLER' }),
      ),
    ).toBe('/age-confirmation');
    expect(
      routeForSamvadSession(
        session({ isProfileComplete: true, role: 'CALLER' }),
      ),
    ).toBe('/account');
    expect(
      routeForSamvadSession(session({ isProfileComplete: true, role: 'HOST' })),
    ).toBe('/kyc');
  });

  it('calculates the 18+ boundary from a real date of birth', () => {
    const today = new Date('2026-11-01T12:00:00.000Z');
    expect(ageForDateOfBirth('2008-11-01', today)).toBe(18);
    expect(ageForDateOfBirth('2008-11-02', today)).toBe(17);
    expect(ageForDateOfBirth('not-a-date', today)).toBeNull();
  });
});
