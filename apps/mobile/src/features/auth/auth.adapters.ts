import { createApiError, FrontendApiError } from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import {
  referralContractClient,
  type ReferralCodeValidationContract,
} from '@/services/referrals/referral-contract';

import { mockAuthFixtures, mockReferralFixtures } from './auth.fixtures';
import {
  clearFirebasePhoneSession,
  confirmFirebasePhoneOtp,
  requestFirebasePhoneOtp,
} from './firebase-phone-auth';
import {
  getSamvadKycStatus,
  getSamvadProfile,
  isSamvadUnauthorized,
  logoutSamvadSession,
  refreshSamvadTokens,
  registerSamvadCaller,
  registerSamvadHost,
  verifyFirebasePhoneIdentity,
  type SamvadAuthResponse,
  type SamvadKycStatus,
} from './samvad-auth.api';
import {
  clearSamvadTokens,
  loadSamvadTokens,
  saveSamvadTokens,
} from './samvad-session.storage';
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
import type { AuthStoreSnapshot, HostKycStatus, MobileAuthRole } from '@/store/auth.store';

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

export const isSamvadAuthEnabled =
  mobileRuntimeConfig.providerMode !== 'mock';

const toMobileRole = (role: SamvadAuthResponse['user']['role']): MobileAuthRole =>
  role === 'HOST' ? 'host' : 'customer';

const toHostKycStatus = (input: {
  isDigilockerVerified: boolean;
  kycStatus: string;
}): HostKycStatus => {
  if (input.isDigilockerVerified) {
    return 'verified';
  }

  return input.kycStatus === 'KYC_PENDING' ? 'pending' : 'not-started';
};

const readHostKycStatus = async (
  accessToken: string,
): Promise<HostKycStatus> => {
  const status = await getSamvadKycStatus(accessToken);
  return toHostKycStatus(status);
};

const samvadResultFromAuthResponse = async (
  response: SamvadAuthResponse,
): Promise<Extract<OtpVerificationResult, { kind: 'success' }>> => {
  const role = toMobileRole(response.user.role);
  const hostKycStatus =
    role === 'host'
      ? await readHostKycStatus(response.tokens.accessToken)
      : null;

  return {
    customerRouteTarget:
      response.user.isProfileComplete === true ? 'home' : 'onboarding',
    hostKycStatus,
    kind: 'success',
    phoneNumber: response.user.phoneNumber,
    role,
    sessionId: response.user.id,
    tokens: response.tokens,
  };
};

const samvadRegistrationResult = async (response: SamvadAuthResponse) => {
  const role = toMobileRole(response.user.role);
  const hostKycStatus =
    role === 'host'
      ? await readHostKycStatus(response.tokens.accessToken)
      : null;

  return {
    customerRouteTarget: 'home' as const,
    hostKycStatus,
    phoneNumber: response.user.phoneNumber,
    role,
    sessionId: response.user.id,
    tokens: response.tokens,
  };
};

const createSamvadCustomerAuthAdapter = (): CustomerAuthAdapter => ({
  requestOtp: async ({ phoneNumber }) => {
    const result = await requestFirebasePhoneOtp(phoneNumber);

    return {
      requestId: result.requestId,
      resendAfterSeconds: otpResendCooldownSeconds,
    };
  },
  validateReferralCode: async ({ code }) => ({
    code: code.trim().toUpperCase(),
    message:
      'This code will be checked when a host profile is registered. Samvad does not expose referral validation before registration.',
    outcome: 'pending-qualification',
  }),
  verifyOtp: async ({ code, phoneNumber }) => {
    const idToken = await confirmFirebasePhoneOtp(code);
    const response = await verifyFirebasePhoneIdentity({ idToken, phoneNumber });
    return samvadResultFromAuthResponse(response);
  },
});

export const registerSamvadAccount = async (input: {
  displayName: string;
  gender: 'man' | 'woman';
  matchTags?: string[];
  preferredLanguages?: string[];
  referralCode?: string | null;
}) => {
  const tokens = await loadSamvadTokens();

  if (tokens === null) {
    throw new Error('Your sign-in session expired. Please sign in again.');
  }

  const response =
    input.gender === 'woman'
      ? await registerSamvadHost(tokens.accessToken, {
          categories: input.matchTags ?? ['Casual Conversation'],
          displayName: input.displayName.trim(),
          languages: input.preferredLanguages ?? ['English', 'Hindi'],
          referralCode: input.referralCode,
        })
      : await registerSamvadCaller(tokens.accessToken, {
          conversationIntents: input.matchTags ?? ['Casual Conversation'],
          displayName: input.displayName.trim(),
          preferredLanguages: input.preferredLanguages ?? ['English', 'Hindi'],
        });

  await saveSamvadTokens(response.tokens);
  return samvadRegistrationResult(response);
};

export const restoreSamvadAuthSession = async (
  snapshot: AuthStoreSnapshot,
): Promise<AuthStoreSnapshot | null> => {
  let tokens = await loadSamvadTokens();

  if (tokens === null) {
    return null;
  }

  let profile;

  try {
    profile = await getSamvadProfile(tokens.accessToken);
  } catch (error: unknown) {
    if (!isSamvadUnauthorized(error)) {
      throw error;
    }

    try {
      tokens = await refreshSamvadTokens(tokens.refreshToken);
      await saveSamvadTokens(tokens);
      profile = await getSamvadProfile(tokens.accessToken);
    } catch (refreshError: unknown) {
      if (isSamvadUnauthorized(refreshError)) {
        await clearSamvadTokens();
        return null;
      }

      throw refreshError;
    }
  }

  const role = toMobileRole(profile.user.role);
  const hostKycStatus =
    role === 'host'
      ? await readHostKycStatus(tokens.accessToken)
      : null;

  return {
    ...snapshot,
    accountStatus: 'active',
    ageGateStatus: 'confirmed',
    customerRouteTarget:
      role === 'customer'
        ? profile.user.isProfileComplete
          ? 'home'
          : 'onboarding'
        : null,
    hostKycStatus,
    phoneNumber: profile.user.phoneNumber,
    role,
    sessionId: profile.user.id,
  };
};

export const logoutCurrentSamvadSession = async () => {
  const tokens = await loadSamvadTokens();

  try {
    if (tokens !== null) {
      await logoutSamvadSession(tokens.accessToken);
    }
  } finally {
    await clearSamvadTokens();
    await clearFirebasePhoneSession();
  }
};

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
    : createSamvadCustomerAuthAdapter();

export const buildPhoneNumberFromDraft = (
  country: PhoneCountry,
  nationalNumber: string,
) => formatE164PhoneNumber(country, nationalNumber);
