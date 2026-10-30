import { create } from 'zustand';

import type { SamvadSession } from './api';

type SamvadAuthState = {
  phoneNumber: string | null;
  session: SamvadSession | null;
  setPhoneNumber: (phoneNumber: string | null) => void;
  setSession: (session: SamvadSession | null) => void;
};

export const useSamvadAuthStore = create<SamvadAuthState>((set) => ({
  phoneNumber: null,
  session: null,
  setPhoneNumber: (phoneNumber) => {
    set({ phoneNumber });
  },
  setSession: (session) => {
    set({ session });
  },
}));
