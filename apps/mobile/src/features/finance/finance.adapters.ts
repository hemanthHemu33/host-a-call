import {
  createApiError,
  FrontendApiError,
  type Payment,
  type PaymentService,
} from '@connecto/domain';

import { frontendServices } from '@/services/adapters';
import { useDevelopmentScenarioStore } from '@/store/development.store';

import {
  parseFinanceRuntimeConfig,
  type PaymentMethod,
} from './finance.models';

const runtimeConfig = parseFinanceRuntimeConfig(process.env);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export type CheckoutCallback = {
  callbackId: string;
  paymentId: string;
  receivedAtIso: string;
};

export type CheckoutOutcome =
  | {
      callbacks: readonly CheckoutCallback[];
      kind: 'submitted';
    }
  | {
      kind: 'cancelled';
      message: string;
    }
  | {
      kind: 'timeout';
      message: string;
    };

export interface PaymentAdapter {
  createOrder(input: {
    amount: Payment['amount'];
    customerId: string;
    method: PaymentMethod;
  }): Promise<Payment>;
  openCheckout(input: {
    amount: Payment['amount'];
    method: PaymentMethod;
    paymentId: string;
    providerOrderId: string;
  }): Promise<CheckoutOutcome>;
  verifyPayment(input: { paymentId: string }): Promise<Payment>;
}

const asFrontendApiError = (message: string) =>
  new FrontendApiError(
    createApiError({
      code: 'server',
      message,
      retryable: false,
    }),
  );

export const createMockPaymentAdapter = (input: {
  getScenario: () =>
    | 'duplicate-callback'
    | 'failure'
    | 'pending'
    | 'success'
    | 'timeout'
    | 'user-cancelled';
  paymentService: PaymentService;
  waitMs?: number;
}): PaymentAdapter => ({
  createOrder: ({ amount, customerId }) =>
    input.paymentService.createPayment({ amount, customerId }),
  async openCheckout({ paymentId }) {
    await wait(input.waitMs ?? 420);

    const scenario = input.getScenario();

    if (scenario === 'user-cancelled') {
      return {
        kind: 'cancelled',
        message: 'Payment was cancelled before confirmation.',
      };
    }

    if (scenario === 'timeout') {
      return {
        kind: 'timeout',
        message: 'The mock checkout did not return in time.',
      };
    }

    const callback = {
      callbackId: `checkout_${paymentId}`,
      paymentId,
      receivedAtIso: new Date().toISOString(),
    } satisfies CheckoutCallback;

    return {
      callbacks:
        scenario === 'duplicate-callback' ? [callback, callback] : [callback],
      kind: 'submitted',
    };
  },
  verifyPayment: (verifyInput) =>
    input.paymentService.verifyPayment(verifyInput),
});

const createUnavailablePaymentAdapter = (): PaymentAdapter => ({
  createOrder: () =>
    Promise.reject(
      asFrontendApiError(
        'A native payment SDK bridge is not connected for this provider mode.',
      ),
    ),
  openCheckout: () =>
    Promise.reject(
      asFrontendApiError(
        'A native checkout handoff is not connected for this provider mode.',
      ),
    ),
  verifyPayment: () =>
    Promise.reject(
      asFrontendApiError(
        'A payment verification service is not connected for this provider mode.',
      ),
    ),
});

export type PaymentPollingResult =
  { kind: 'cancelled' } | { kind: 'payment'; payment: Payment };

export const pollVerifiedPayment = async (input: {
  adapter: Pick<PaymentAdapter, 'verifyPayment'>;
  delayMs: number;
  isCancelled: () => boolean;
  maxAttempts: number;
  paymentId: string;
}): Promise<PaymentPollingResult> => {
  let latestPayment: Payment | null = null;

  for (let attempt = 0; attempt < input.maxAttempts; attempt += 1) {
    if (input.isCancelled()) {
      return { kind: 'cancelled' };
    }

    const payment = await input.adapter.verifyPayment({
      paymentId: input.paymentId,
    });
    latestPayment = payment;

    if (
      payment.status !== 'pending' &&
      payment.status !== 'verification-pending'
    ) {
      return {
        kind: 'payment',
        payment,
      };
    }

    if (attempt < input.maxAttempts - 1) {
      await wait(input.delayMs);
    }
  }

  if (latestPayment === null) {
    throw asFrontendApiError('Payment verification did not return a result.');
  }

  return {
    kind: 'payment',
    payment: latestPayment,
  };
};

export const financePaymentAdapter =
  runtimeConfig.providerMode === 'mock'
    ? createMockPaymentAdapter({
        getScenario: () =>
          useDevelopmentScenarioStore.getState().scenario.paymentResult,
        paymentService: frontendServices.payment,
      })
    : createUnavailablePaymentAdapter();
