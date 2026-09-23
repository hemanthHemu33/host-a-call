import { describe, expect, it } from 'vitest';

import {
  createInrMoney,
  formatRupees,
  formatSignedTransactionAmount,
  parsePaymentRouteParams,
  parseRupeeAmount,
  pickPaymentCallReturnParams,
  statusTone,
  terminalKindForPayment,
  transactionTitle,
} from './finance.models';

describe('finance models', () => {
  it('formats and validates direct rupee amounts without negative values', () => {
    expect(formatRupees(createInrMoney(25000))).toContain('250');
    expect(createInrMoney(-100).amountPaise).toBe(0);
    expect(parseRupeeAmount('24')).toMatchObject({
      kind: 'invalid',
    });
    expect(parseRupeeAmount('250')).toMatchObject({
      kind: 'valid',
      money: { amountPaise: 25000, currency: 'INR' },
      rupees: 250,
    });
    expect(parseRupeeAmount('100.50')).toMatchObject({
      kind: 'invalid',
    });
  });

  it('parses payment route params safely', () => {
    const parsed = parsePaymentRouteParams({
      amountPaise: '50000',
      discoveryAutoConnect: 'true',
      discoveryHostId: 'host_anjali',
      discoveryHostLanguage: 'Telugu',
      discoveryHostName: 'Anjali',
      discoveryHostRank: 'gold',
      method: 'card',
      origin: 'call',
      paymentId: 'payment_2',
      returnTo: '/call/outgoing',
    });

    expect(parsed).toMatchObject({
      amountPaise: 50000,
      discoveryHostId: 'host_anjali',
      method: 'card',
      origin: 'call',
      paymentId: 'payment_2',
      returnTo: '/call/outgoing',
    });
    expect(pickPaymentCallReturnParams(parsed)).toEqual({
      discoveryAutoConnect: 'true',
      discoveryHostId: 'host_anjali',
      discoveryHostLanguage: 'Telugu',
      discoveryHostName: 'Anjali',
      discoveryHostRank: 'gold',
    });

    expect(
      parsePaymentRouteParams({
        amountPaise: '50000',
        method: 'card',
        origin: 'call',
        paymentId: 'payment_2',
        returnTo: '/call/outgoing',
      }),
    ).toMatchObject({
      amountPaise: 50000,
      method: 'card',
      origin: 'call',
      paymentId: 'payment_2',
      returnTo: '/call/outgoing',
    });

    expect(parsePaymentRouteParams({ amountPaise: '-1' }).amountPaise).toBe(0);
    expect(parsePaymentRouteParams({ method: 'bad' }).method).toBe('upi');
  });

  it('labels transaction and terminal payment states', () => {
    const transaction = {
      amount: { amountPaise: 1000, currency: 'INR' as const },
      id: 'transaction_1',
      occurredAtIso: '2026-07-16T00:00:00.000Z',
      referenceId: 'call_1',
      status: 'posted' as const,
      type: 'call-debit' as const,
      walletId: 'wallet_1',
    };

    expect(transactionTitle(transaction)).toBe('Voice call');
    expect(formatSignedTransactionAmount(transaction)).toMatch(/-/);
    expect(statusTone('posted')).toBe('success');
    expect(statusTone('timeout')).toBe('error');
    expect(
      terminalKindForPayment({
        amount: { amountPaise: 25000, currency: 'INR' },
        customerId: 'customer_1',
        id: 'payment_1',
        providerOrderId: 'order_1',
        status: 'pending',
      }),
    ).toBe('pending');
  });
});
