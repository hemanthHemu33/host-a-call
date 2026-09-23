import {
  transitionPayment,
  transitionReferralQualification,
  transitionWithdrawal,
  type Money,
  type PaymentEvent,
  type PaymentState,
  type ReferralQualificationEvent,
  type ReferralQualificationState,
  type WithdrawalEvent,
  type WithdrawalState,
} from '@connecto/domain';
import { create } from 'zustand';

export type WalletStoreSnapshot = {
  balance: Money;
  paymentState: PaymentState;
  referralQualificationState: ReferralQualificationState;
  withdrawalState: WithdrawalState;
};

export const initialWalletStore: WalletStoreSnapshot = {
  balance: {
    amountPaise: 0,
    currency: 'INR',
  },
  paymentState: 'idle',
  referralQualificationState: 'unqualified',
  withdrawalState: 'idle',
};

export const transitionWalletPayment = (
  snapshot: WalletStoreSnapshot,
  event: PaymentEvent,
): WalletStoreSnapshot => ({
  ...snapshot,
  paymentState: transitionPayment(snapshot.paymentState, event),
});

export const transitionWalletWithdrawal = (
  snapshot: WalletStoreSnapshot,
  event: WithdrawalEvent,
): WalletStoreSnapshot => ({
  ...snapshot,
  withdrawalState: transitionWithdrawal(snapshot.withdrawalState, event),
});

export const transitionWalletReferral = (
  snapshot: WalletStoreSnapshot,
  event: ReferralQualificationEvent,
): WalletStoreSnapshot => ({
  ...snapshot,
  referralQualificationState: transitionReferralQualification(
    snapshot.referralQualificationState,
    event,
  ),
});

type WalletDisplayCacheStoreState = WalletStoreSnapshot & {
  reset: () => void;
  setBalance: (balance: Money) => void;
  transitionPayment: (event: PaymentEvent) => void;
  transitionReferral: (event: ReferralQualificationEvent) => void;
  transitionWithdrawal: (event: WithdrawalEvent) => void;
};

export const useWalletDisplayCacheStore = create<WalletDisplayCacheStoreState>(
  (set, get) => ({
    ...initialWalletStore,
    reset: () => {
      set(initialWalletStore);
    },
    setBalance: (balance) => {
      set({ balance });
    },
    transitionPayment: (event) => {
      set(transitionWalletPayment(get(), event));
    },
    transitionReferral: (event) => {
      set(transitionWalletReferral(get(), event));
    },
    transitionWithdrawal: (event) => {
      set(transitionWalletWithdrawal(get(), event));
    },
  }),
);
