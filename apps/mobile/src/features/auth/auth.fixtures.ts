import type {
  AuthMockFixture,
  PhoneCountry,
  ReferralValidationOutcome,
} from './auth.models';

export const defaultPhoneCountries = [
  {
    dialCode: '+91',
    displayName: 'India',
    isoCode: 'IN',
    nationalNumberLength: 10,
  },
] as const satisfies readonly PhoneCountry[];

export const defaultPhoneCountry = defaultPhoneCountries[0];

export const mockAuthFixtures = [
  {
    expectedCode: '246810',
    outcome: 'existing',
    phoneNumber: '+919000000001',
  },
  {
    expectedCode: '246810',
    outcome: 'new',
    phoneNumber: '+919000000002',
  },
  {
    expectedCode: '246810',
    outcome: 'suspended',
    phoneNumber: '+919000000003',
  },
  {
    expectedCode: '246810',
    outcome: 'blocked',
    phoneNumber: '+919000000004',
  },
  {
    expectedCode: '246810',
    outcome: 'invalid',
    phoneNumber: '+919000000005',
  },
  {
    expectedCode: '246810',
    outcome: 'expired',
    phoneNumber: '+919000000006',
  },
  {
    expectedCode: '246810',
    outcome: 'too-many-attempts',
    phoneNumber: '+919000000007',
  },
] as const satisfies readonly AuthMockFixture[];

export const mockReferralFixtures = {
  CONNECTO100: {
    message: 'Referral applied. Rewards unlock after the first qualified call.',
    outcome: 'valid',
  },
  USEDONCE: {
    message: 'This referral code has already been used on another account.',
    outcome: 'already-used',
  },
  WAITLIST: {
    message: 'Referral saved. Qualification is still pending for this code.',
    outcome: 'pending-qualification',
  },
} as const satisfies Record<
  string,
  { message: string; outcome: Exclude<ReferralValidationOutcome, 'invalid'> }
>;
