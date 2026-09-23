import { z } from 'zod';

import type { MobileAuthRole } from '@/store/auth.store';

export const phoneCountrySchema = z.object({
  dialCode: z.string().regex(/^\+\d+$/),
  displayName: z.string().min(1),
  isoCode: z.string().length(2),
  nationalNumberLength: z.number().int().min(4).max(15),
});
export type PhoneCountry = z.infer<typeof phoneCountrySchema>;

export const referralValidationOutcomeSchema = z.enum([
  'already-used',
  'invalid',
  'pending-qualification',
  'valid',
]);
export type ReferralValidationOutcome = z.infer<
  typeof referralValidationOutcomeSchema
>;

export const customerRouteTargetSchema = z.enum(['home', 'onboarding']);
export type CustomerRouteTarget = z.infer<typeof customerRouteTargetSchema>;

export const authMockFixtureOutcomeSchema = z.enum([
  'blocked',
  'existing',
  'expired',
  'invalid',
  'new',
  'suspended',
  'too-many-attempts',
]);
export type AuthMockFixtureOutcome = z.infer<
  typeof authMockFixtureOutcomeSchema
>;

export const authMockFixtureSchema = z.object({
  expectedCode: z.string().regex(/^\d{6}$/),
  outcome: authMockFixtureOutcomeSchema,
  phoneNumber: z.string().min(1),
});
export type AuthMockFixture = z.infer<typeof authMockFixtureSchema>;

export type OtpRequestResult = {
  requestId: string;
  resendAfterSeconds: number;
};

export type ReferralValidationResult = {
  code: string;
  message: string;
  outcome: ReferralValidationOutcome;
};

export type OtpVerificationResult =
  | {
      kind: 'account-status';
      phoneNumber: string;
      status: 'blocked' | 'suspended';
      supportMessage: string;
    }
  | {
      customerRouteTarget: CustomerRouteTarget;
      kind: 'success';
      phoneNumber: string;
      role: Extract<MobileAuthRole, 'customer'>;
      sessionId: string;
    }
  | {
      attemptsRemaining: number;
      kind: 'failure';
      message: string;
      reason: 'expired' | 'invalid' | 'too-many-attempts';
      retryAfterSeconds?: number;
    };

export interface CustomerAuthAdapter {
  requestOtp(input: {
    phoneNumber: string;
    referralCode?: string | null;
  }): Promise<OtpRequestResult>;
  validateReferralCode(input: {
    code: string;
    phoneNumber: string;
  }): Promise<ReferralValidationResult>;
  verifyOtp(input: {
    code: string;
    phoneNumber: string;
    referralCode?: string | null;
    requestId: string;
  }): Promise<OtpVerificationResult>;
}

export const authRuntimeConfigSchema = z.object({
  defaultAuthFixtureOutcome: authMockFixtureOutcomeSchema,
  defaultReferralOutcome: referralValidationOutcomeSchema,
  mandatoryUpdateRequired: z.boolean(),
});
export type AuthRuntimeConfig = z.infer<typeof authRuntimeConfigSchema>;

const parseBoolean = (value: string | undefined, fallback: boolean) =>
  value === 'true' ? true : value === 'false' ? false : fallback;

export const parseAuthRuntimeConfig = (
  input: Record<string, string | undefined>,
): AuthRuntimeConfig =>
  authRuntimeConfigSchema.parse({
    defaultAuthFixtureOutcome: authMockFixtureOutcomeSchema
      .catch('new')
      .parse(input.EXPO_PUBLIC_CONNECTO_AUTH_DEFAULT_OTP_OUTCOME),
    defaultReferralOutcome: referralValidationOutcomeSchema
      .catch('invalid')
      .parse(input.EXPO_PUBLIC_CONNECTO_AUTH_DEFAULT_REFERRAL_OUTCOME),
    mandatoryUpdateRequired: parseBoolean(
      input.EXPO_PUBLIC_CONNECTO_FORCE_MANDATORY_UPDATE,
      false,
    ),
  });

export const formatE164PhoneNumber = (
  country: PhoneCountry,
  nationalNumber: string,
) => `${country.dialCode}${nationalNumber.replace(/\D/g, '')}`;

export const normalizePhoneDigits = (value: string) => value.replace(/\D/g, '');

export const otpResendCooldownSeconds = 30;
export const otpMaxInvalidAttempts = 3;

export const getOtpResendRemainingSeconds = (
  sentAtMs: number,
  nowMs: number,
  cooldownSeconds: number = otpResendCooldownSeconds,
) => Math.max(0, cooldownSeconds - Math.floor((nowMs - sentAtMs) / 1000));

export const getNextInvalidAttemptCount = (
  currentAttempts: number,
  maxAttempts: number = otpMaxInvalidAttempts,
) => Math.min(maxAttempts, currentAttempts + 1);
