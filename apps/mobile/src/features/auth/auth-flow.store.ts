import { create } from 'zustand';

import { defaultPhoneCountries, defaultPhoneCountry } from './auth.fixtures';
import type { PhoneCountry, ReferralValidationResult } from './auth.models';

export type PendingOtpChallenge = {
  invalidAttempts: number;
  phoneNumber: string;
  requestId: string;
  resendAfterSeconds: number;
  sentAtMs: number;
};

type AuthFlowState = {
  country: PhoneCountry;
  nationalNumber: string;
  pendingOtpChallenge: PendingOtpChallenge | null;
  referralCode: string;
  referralValidation: ReferralValidationResult | null;
  resetFlow: () => void;
  setCountry: (isoCode: string) => void;
  setNationalNumber: (value: string) => void;
  setPendingOtpChallenge: (challenge: PendingOtpChallenge) => void;
  setReferralCode: (value: string) => void;
  setReferralValidation: (result: ReferralValidationResult | null) => void;
  updateInvalidAttempts: (invalidAttempts: number) => void;
};

const initialFlowState = {
  country: defaultPhoneCountry,
  nationalNumber: '',
  pendingOtpChallenge: null,
  referralCode: '',
  referralValidation: null,
} as const satisfies Pick<
  AuthFlowState,
  | 'country'
  | 'nationalNumber'
  | 'pendingOtpChallenge'
  | 'referralCode'
  | 'referralValidation'
>;

export const useAuthFlowStore = create<AuthFlowState>((set) => ({
  ...initialFlowState,
  resetFlow: () => {
    set(initialFlowState);
  },
  setCountry: (isoCode) => {
    set({
      country:
        defaultPhoneCountries.find((country) => country.isoCode === isoCode) ??
        defaultPhoneCountry,
    });
  },
  setNationalNumber: (nationalNumber) => {
    set({ nationalNumber });
  },
  setPendingOtpChallenge: (pendingOtpChallenge) => {
    set({ pendingOtpChallenge });
  },
  setReferralCode: (referralCode) => {
    set({ referralCode });
  },
  setReferralValidation: (referralValidation) => {
    set({ referralValidation });
  },
  updateInvalidAttempts: (invalidAttempts) => {
    set((state) => ({
      pendingOtpChallenge:
        state.pendingOtpChallenge === null
          ? null
          : { ...state.pendingOtpChallenge, invalidAttempts },
    }));
  },
}));
