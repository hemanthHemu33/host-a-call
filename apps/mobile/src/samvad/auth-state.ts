import { create } from 'zustand';

import type {
  SamvadAccountState,
  SamvadOtpReservation,
  SamvadSession,
} from './api';

export type SamvadOtpChallenge = SamvadOtpReservation & {
  invalidAttempts: number;
  phoneNumber: string;
  resendCount: number;
  sentAtMs: number;
};

type SamvadAuthState = {
  accountState: SamvadAccountState | null;
  dateOfBirth: string | null;
  maintenanceMessage: string | null;
  otpChallenge: SamvadOtpChallenge | null;
  phoneNumber: string | null;
  session: SamvadSession | null;
  updateUrl: string | null;
  setAccountState: (accountState: SamvadAccountState | null) => void;
  setDateOfBirth: (dateOfBirth: string | null) => void;
  setMaintenanceMessage: (message: string | null) => void;
  setOtpChallenge: (challenge: SamvadOtpChallenge | null) => void;
  setPhoneNumber: (phoneNumber: string | null) => void;
  setSession: (session: SamvadSession | null) => void;
  setUpdateUrl: (url: string | null) => void;
};

export const useSamvadAuthStore = create<SamvadAuthState>((set) => ({
  accountState: null,
  dateOfBirth: null,
  maintenanceMessage: null,
  otpChallenge: null,
  phoneNumber: null,
  session: null,
  updateUrl: null,
  setAccountState: (accountState) => {
    set({ accountState });
  },
  setDateOfBirth: (dateOfBirth) => {
    set({ dateOfBirth });
  },
  setMaintenanceMessage: (maintenanceMessage) => {
    set({ maintenanceMessage });
  },
  setOtpChallenge: (otpChallenge) => {
    set({ otpChallenge });
  },
  setPhoneNumber: (phoneNumber) => {
    set({ phoneNumber });
  },
  setSession: (session) => {
    set({
      accountState: session?.user.accountState ?? null,
      session,
    });
  },
  setUpdateUrl: (updateUrl) => {
    set({ updateUrl });
  },
}));
