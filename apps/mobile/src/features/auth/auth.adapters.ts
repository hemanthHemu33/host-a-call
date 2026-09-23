import { createApiError, FrontendApiError } from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import {
  referralContractClient,
  type ReferralCodeValidationContract,
} from '@/services/referrals/referral-contract';

import { mockAuthFixtures, mockReferralFixtures } from './auth.fixtures';
import {
  authMockFixtureSchema,
  formatE164PhoneNumber,
  otpResendCooldownSeconds,
  parseAuthRuntimeConfig,
  type AuthMockFixture,
  type CustomerAuthAdapter,
  type OtpVerificationResult,
  type PhoneCountry,
  type ReferralValidationResult,
  type ReferralValidationOutcome,
} from './auth.models';

const authRuntimeConfig = parseAuthRuntimeConfig(process.env);

const unavailable = () =>
  new FrontendApiError(
    createApiError({
      code: 'server',
      message:
        'Customer auth is only available through the mock provider in this stage.',
      retryable: false,
    }),
  );

const fixtureForPhoneNumber = (phoneNumber: string): AuthMockFixture =>
  authMockFixtureSchema.parse(
    mockAuthFixtures.find((fixture) => fixture.phoneNumber === phoneNumber) ?? {
      expectedCode: '246810',
      outcome: authRuntimeConfig.defaultAuthFixtureOutcome,
      phoneNumber,
    },
  );

const referralFixtureMap: Record<
  string,
  { message: string; outcome: Exclude<ReferralValidationOutcome, 'invalid'> }
> = mockReferralFixtures;

const referralResultForCode = (code: string): ReferralValidationResult => {
  const normalizedCode = code.trim().toUpperCase();
  const fixture = referralFixtureMap[normalizedCode];

  if (fixture !== undefined) {
    return {
      code: normalizedCode,
      message: fixture.message,
      outcome: fixture.outcome,
    };
  }

  if (authRuntimeConfig.defaultReferralOutcome === 'valid') {
    return {
      code: normalizedCode,
      message:
        'Referral applied. Rewards unlock after the first qualified call.',
      outcome: 'valid',
    };
  }

  return {
    code: normalizedCode,
    message: 'Enter a valid referral code or continue without one.',
    outcome: authRuntimeConfig.defaultReferralOutcome,
  };
};

const verificationResultForFixture = (
  fixture: AuthMockFixture,
  requestId: string,
): OtpVerificationResult => {
  if (fixture.outcome === 'existing') {
    return {
      customerRouteTarget: 'home',
      kind: 'success',
      phoneNumber: fixture.phoneNumber,
      role: 'customer',
      sessionId: `mock-session-${requestId}-existing`,
    };
  }

  if (fixture.outcome === 'new') {
    return {
      customerRouteTarget: 'onboarding',
      kind: 'success',
      phoneNumber: fixture.phoneNumber,
      role: 'customer',
      sessionId: `mock-session-${requestId}-new`,
    };
  }

  if (fixture.outcome === 'suspended' || fixture.outcome === 'blocked') {
    return {
      kind: 'account-status',
      phoneNumber: fixture.phoneNumber,
      status: fixture.outcome,
      supportMessage:
        fixture.outcome === 'suspended'
          ? 'Your account is temporarily suspended while we review recent activity.'
          : 'Your account has been blocked. Contact support if you think this is a mistake.',
    };
  }

  if (fixture.outcome === 'expired') {
    return {
      attemptsRemaining: 0,
      kind: 'failure',
      message: 'This OTP expired. Request a new code to continue.',
      reason: 'expired',
    };
  }

  if (fixture.outcome === 'too-many-attempts') {
    return {
      attemptsRemaining: 0,
      kind: 'failure',
      message: 'Too many invalid attempts. Please wait before trying again.',
      reason: 'too-many-attempts',
      retryAfterSeconds: otpResendCooldownSeconds,
    };
  }

  return {
    attemptsRemaining: 2,
    kind: 'failure',
    message: 'Enter the 6-digit code we sent to your phone.',
    reason: 'invalid',
  };
};

const mapReferralValidationContract = (
  validation: ReferralCodeValidationContract,
): ReferralValidationResult => ({
  code: validation.code,
  message: validation.message,
  outcome: validation.outcome,
});

export const createMockCustomerAuthAdapter = (): CustomerAuthAdapter => ({
  requestOtp: ({ phoneNumber }) =>
    Promise.resolve({
      requestId: `mock-otp-${phoneNumber.replace(/\D/g, '')}`,
      resendAfterSeconds: otpResendCooldownSeconds,
    }),
  validateReferralCode: ({ code }) =>
    Promise.resolve(referralResultForCode(code)),
  verifyOtp: ({ code, phoneNumber, requestId }) => {
    const fixture = fixtureForPhoneNumber(phoneNumber);

    if (fixture.outcome !== 'invalid' && code !== fixture.expectedCode) {
      return Promise.resolve({
        attemptsRemaining: 2,
        kind: 'failure',
        message: 'Enter the 6-digit code we sent to your phone.',
        reason: 'invalid',
      });
    }

    return Promise.resolve(verificationResultForFixture(fixture, requestId));
  },
});

export const createContractBackedCustomerAuthAdapter = (
  validateReferralCode: (input: {
    code: string;
    phoneNumber: string;
  }) => Promise<ReferralCodeValidationContract> = (input) =>
    referralContractClient.validateCode(input),
): CustomerAuthAdapter => ({
  requestOtp: async () => Promise.reject(unavailable()),
  validateReferralCode: async ({ code, phoneNumber }) =>
    mapReferralValidationContract(
      await validateReferralCode({
        code,
        phoneNumber,
      }),
    ),
  verifyOtp: async () => Promise.reject(unavailable()),
});

export const createUnavailableCustomerAuthAdapter =
  (): CustomerAuthAdapter => ({
    requestOtp: async () => Promise.reject(unavailable()),
    validateReferralCode: async () => Promise.reject(unavailable()),
    verifyOtp: async () => Promise.reject(unavailable()),
  });

export const customerAuthAdapter =
  mobileRuntimeConfig.providerMode === 'mock'
    ? createMockCustomerAuthAdapter()
    : createContractBackedCustomerAuthAdapter();

export const buildPhoneNumberFromDraft = (
  country: PhoneCountry,
  nationalNumber: string,
) => formatE164PhoneNumber(country, nationalNumber);
