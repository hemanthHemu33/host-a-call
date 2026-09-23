import { describe, expect, it, vi } from 'vitest';

import {
  createMockDatabase,
  createMockFrontendServices,
} from '@connecto/domain';

import {
  createMockPaymentAdapter,
  pollVerifiedPayment,
} from './finance.adapters';

const amount = { amountPaise: 25000, currency: 'INR' as const };

describe('finance payment adapter', () => {
  it.each([
    ['success', 'submitted', 1],
    ['failure', 'submitted', 1],
    ['pending', 'submitted', 1],
    ['duplicate-callback', 'submitted', 2],
    ['user-cancelled', 'cancelled', 0],
    ['timeout', 'timeout', 0],
  ] as const)(
    'returns deterministic checkout outcome for %s',
    async (scenario, expectedKind, callbackCount) => {
      const services = createMockFrontendServices();
      const adapter = createMockPaymentAdapter({
        getScenario: () => scenario,
        paymentService: services.payment,
        waitMs: 0,
      });
      const payment = await adapter.createOrder({
        amount,
        customerId: 'customer_1',
        method: 'upi',
      });
      const outcome = await adapter.openCheckout({
        amount,
        method: 'upi',
        paymentId: payment.id,
        providerOrderId: payment.providerOrderId,
      });

      expect(outcome.kind).toBe(expectedKind);

      if (outcome.kind === 'submitted') {
        expect(outcome.callbacks).toHaveLength(callbackCount);
      }
    },
  );

  it('polls pending verification with safe cancellation', async () => {
    const verifyPayment = vi
      .fn()
      .mockResolvedValueOnce({
        amount,
        customerId: 'customer_1',
        id: 'payment_1',
        providerOrderId: 'order_1',
        status: 'pending',
      })
      .mockResolvedValueOnce({
        amount,
        customerId: 'customer_1',
        id: 'payment_1',
        providerOrderId: 'order_1',
        status: 'success',
      });

    await expect(
      pollVerifiedPayment({
        adapter: { verifyPayment },
        delayMs: 0,
        isCancelled: () => false,
        maxAttempts: 3,
        paymentId: 'payment_1',
      }),
    ).resolves.toMatchObject({
      kind: 'payment',
      payment: { status: 'success' },
    });
    expect(verifyPayment).toHaveBeenCalledTimes(2);

    await expect(
      pollVerifiedPayment({
        adapter: { verifyPayment },
        delayMs: 0,
        isCancelled: () => true,
        maxAttempts: 3,
        paymentId: 'payment_1',
      }),
    ).resolves.toEqual({ kind: 'cancelled' });
  });

  it('credits the mock wallet once after verified success', async () => {
    const database = createMockDatabase({
      applicationStatus: 'submitted',
      hostAvailability: 'online',
      hostRank: 'gold',
      networkQuality: 'good',
      paymentResult: 'duplicate-callback',
      reportHistory: 'open',
      role: 'customer',
      walletBalancePaise: 50000,
    });
    const services = createMockFrontendServices({ database });
    const payment = await services.payment.createPayment({
      amount,
      customerId: 'customer_1',
    });

    await services.payment.verifyPayment({ paymentId: payment.id });
    await services.payment.verifyPayment({ paymentId: payment.id });

    await expect(
      services.wallet.getWallet('customer_1'),
    ).resolves.toMatchObject({
      balance: { amountPaise: 75000 },
    });
    await expect(
      services.wallet.listTransactions('wallet_1'),
    ).resolves.toHaveLength(5);
  });
});
