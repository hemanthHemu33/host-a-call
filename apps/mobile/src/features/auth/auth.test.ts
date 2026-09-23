import { describe, expect, it } from 'vitest';

import {
  createContractBackedCustomerAuthAdapter,
  createMockCustomerAuthAdapter,
} from './auth.adapters';
import {
  getNextInvalidAttemptCount,
  getOtpResendRemainingSeconds,
  parseAuthRuntimeConfig,
} from './auth.models';

describe('customer auth fixtures', () => {
  it('returns too-many-attempts and invalid fixture outcomes deterministically', async () => {
    const adapter = createMockCustomerAuthAdapter();

    await expect(
      adapter.verifyOtp({
        code: '246810',
        phoneNumber: '+919000000007',
        requestId: 'mock-otp-919000000007',
      }),
    ).resolves.toMatchObject({
      kind: 'failure',
      reason: 'too-many-attempts',
    });

    await expect(
      adapter.verifyOtp({
        code: '246810',
        phoneNumber: '+919000000005',
        requestId: 'mock-otp-919000000005',
      }),
    ).resolves.toMatchObject({
      kind: 'failure',
      reason: 'invalid',
    });
  });

  it('computes resend timing and invalid attempt counts', () => {
    expect(getOtpResendRemainingSeconds(10_000, 20_000, 30)).toBe(20);
    expect(getOtpResendRemainingSeconds(10_000, 41_000, 30)).toBe(0);
    expect(getNextInvalidAttemptCount(0)).toBe(1);
    expect(getNextInvalidAttemptCount(2)).toBe(3);
    expect(getNextInvalidAttemptCount(3)).toBe(3);
  });

  it('treats unknown mock phone numbers as new users by default', () => {
    expect(parseAuthRuntimeConfig({}).defaultAuthFixtureOutcome).toBe('new');
  });

  it('routes unknown mock phone numbers into onboarding after OTP verification', async () => {
    const adapter = createMockCustomerAuthAdapter();

    await expect(
      adapter.verifyOtp({
        code: '246810',
        phoneNumber: '+919876543210',
        requestId: 'mock-otp-919876543210',
      }),
    ).resolves.toMatchObject({
      customerRouteTarget: 'onboarding',
      kind: 'success',
      phoneNumber: '+919876543210',
      role: 'customer',
    });
  });

  it('maps backend referral validation contracts into the auth flow shape', async () => {
    const adapter = createContractBackedCustomerAuthAdapter(() =>
      Promise.resolve({
        campaignLabel: 'Founding referral',
        code: 'CONNECTO100',
        inviterDisplayName: 'Anjali',
        message: 'Referral applied.',
        outcome: 'valid' as const,
      }),
    );

    await expect(
      adapter.validateReferralCode({
        code: 'connecto100',
        phoneNumber: '+919000000001',
      }),
    ).resolves.toEqual({
      code: 'CONNECTO100',
      message: 'Referral applied.',
      outcome: 'valid',
    });
  });
});
