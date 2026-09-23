import { z } from 'zod';

import {
  providerModeSchema,
  type Money,
  type Payment,
  type PaymentStatus,
  type Transaction,
} from '@connecto/domain';

export const quickAmountRupees = [
  25, 50, 100, 140, 200, 300, 500, 900, 1900, 9800, 15000,
] as const;

export const paymentMethodSchema = z.enum([
  'card',
  'net-banking',
  'pay-later',
  'qr',
  'upi',
  'upi-bhim',
  'upi-cred',
  'upi-google-pay',
  'upi-paytm',
  'upi-phonepe',
  'wallet',
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentMethods = [
  {
    description: 'Use any installed UPI app or collect request.',
    label: 'UPI',
    value: 'upi',
  },
  {
    description: 'Credit and debit cards with mock 3DS handling.',
    label: 'Card',
    value: 'card',
  },
  {
    description: 'Bank login handoff represented by the mock adapter.',
    label: 'Net banking',
    value: 'net-banking',
  },
  {
    description: 'Scan a provider QR code from any banking or UPI app.',
    label: 'QR scan',
    value: 'qr',
  },
  {
    description: 'Popular prepaid wallets represented by the mock adapter.',
    label: 'Wallet',
    value: 'wallet',
  },
  {
    description: 'Pay-later handoff represented by the mock adapter.',
    label: 'Pay later',
    value: 'pay-later',
  },
] as const satisfies readonly {
  description: string;
  label: string;
  value: PaymentMethod;
}[];

export const financeRuntimeConfigSchema = z.object({
  providerMode: providerModeSchema.catch('mock'),
});
export type FinanceRuntimeConfig = z.infer<typeof financeRuntimeConfigSchema>;

export const parseFinanceRuntimeConfig = (
  input: Record<string, string | undefined>,
): FinanceRuntimeConfig =>
  financeRuntimeConfigSchema.parse({
    providerMode: providerModeSchema.parse(
      input.EXPO_PUBLIC_CONNECTO_PAYMENT_PROVIDER ??
        input.EXPO_PUBLIC_CONNECTO_PROVIDER ??
        'mock',
    ),
  });

export const minimumTopUpRupees = 25;
export const maximumTopUpRupees = 50_000;

export type AmountValidationResult =
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; money: Money; rupees: number };

export const createInrMoney = (amountPaise: number): Money => ({
  amountPaise: Math.max(0, Math.trunc(amountPaise)),
  currency: 'INR',
});

export const parseRupeeAmount = (value: string): AmountValidationResult => {
  const normalized = value.trim().replace(/[,\s]/g, '');

  if (normalized.length === 0) {
    return {
      kind: 'invalid',
      message: 'Enter an amount in rupees.',
    };
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      kind: 'invalid',
      message: 'Use whole rupees only.',
    };
  }

  const rupees = Number(normalized);

  if (!Number.isSafeInteger(rupees) || rupees < minimumTopUpRupees) {
    return {
      kind: 'invalid',
      message: `Add at least ${formatRupees(createInrMoney(minimumTopUpRupees * 100))}.`,
    };
  }

  if (rupees > maximumTopUpRupees) {
    return {
      kind: 'invalid',
      message: `Add ${formatRupees(createInrMoney(maximumTopUpRupees * 100))} or less in one payment.`,
    };
  }

  return {
    kind: 'valid',
    money: createInrMoney(rupees * 100),
    rupees,
  };
};

export const formatRupees = (money: Money) =>
  new Intl.NumberFormat('en-IN', {
    currency: money.currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(Math.max(0, money.amountPaise) / 100);

export const formatSignedTransactionAmount = (transaction: Transaction) => {
  const prefix =
    transaction.type === 'call-debit' || transaction.type === 'withdrawal-debit'
      ? '-'
      : '+';

  return `${prefix}${formatRupees(transaction.amount)}`;
};

export const transactionTitle = (transaction: Transaction) => {
  switch (transaction.type) {
    case 'call-debit':
      return 'Voice call';
    case 'referral-credit':
      return 'Referral reward';
    case 'wallet-credit':
      return 'Wallet top-up';
    case 'withdrawal-debit':
      return 'Withdrawal';
  }
};

export const statusTone = (
  status: PaymentStatus | PaymentTerminalKind | Transaction['status'],
): 'error' | 'info' | 'success' | 'warning' => {
  if (status === 'success' || status === 'posted') {
    return 'success';
  }

  if (
    status === 'cancelled' ||
    status === 'failure' ||
    status === 'failed' ||
    status === 'timeout'
  ) {
    return 'error';
  }

  if (status === 'pending' || status === 'verification-pending') {
    return 'warning';
  }

  return 'info';
};

export type PaymentTerminalKind =
  'cancelled' | 'failure' | 'pending' | 'success' | 'timeout';

export const terminalKindForPayment = (
  payment: Payment,
): PaymentTerminalKind => {
  if (payment.status === 'success') {
    return 'success';
  }

  if (
    payment.status === 'pending' ||
    payment.status === 'verification-pending'
  ) {
    return 'pending';
  }

  if (payment.status === 'cancelled') {
    return 'cancelled';
  }

  if (payment.status === 'timeout') {
    return 'timeout';
  }

  return 'failure';
};

const readParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const paymentRouteParamsSchema = z.object({
  amountPaise: z.coerce.number().int().nonnegative().catch(0),
  discoveryAutoConnect: z.string().optional(),
  discoveryHostId: z.string().optional(),
  discoveryHostLanguage: z.string().optional(),
  discoveryHostName: z.string().optional(),
  discoveryHostRank: z.string().optional(),
  discoveryInitialState: z.string().optional(),
  method: paymentMethodSchema.catch('upi'),
  origin: z.string().min(1).catch('add-money'),
  paymentId: z.string().min(1).catch(''),
  returnTo: z.string().min(1).catch('/(customer)/add-money'),
});
export type PaymentRouteParams = z.infer<typeof paymentRouteParamsSchema>;

export const parsePaymentRouteParams = (
  params: Record<string, string | string[] | undefined>,
): PaymentRouteParams =>
  paymentRouteParamsSchema.parse({
    amountPaise: readParam(params.amountPaise),
    discoveryAutoConnect: readParam(params.discoveryAutoConnect),
    discoveryHostId: readParam(params.discoveryHostId),
    discoveryHostLanguage: readParam(params.discoveryHostLanguage),
    discoveryHostName: readParam(params.discoveryHostName),
    discoveryHostRank: readParam(params.discoveryHostRank),
    discoveryInitialState: readParam(params.discoveryInitialState),
    method: readParam(params.method),
    origin: readParam(params.origin),
    paymentId: readParam(params.paymentId),
    returnTo: readParam(params.returnTo),
  });

export const paymentCallReturnParamKeys = [
  'discoveryAutoConnect',
  'discoveryHostId',
  'discoveryHostLanguage',
  'discoveryHostName',
  'discoveryHostRank',
  'discoveryInitialState',
] as const satisfies readonly (keyof PaymentRouteParams)[];

export const pickPaymentCallReturnParams = (
  params: Pick<PaymentRouteParams, (typeof paymentCallReturnParamKeys)[number]>,
): Record<string, string> => {
  const routeParams: Record<string, string> = {};

  for (const key of paymentCallReturnParamKeys) {
    const value = params[key];

    if (typeof value === 'string' && value.length > 0) {
      routeParams[key] = value;
    }
  }

  return routeParams;
};

export const detailIdFromParams = (
  params: Record<string, string | string[] | undefined>,
  key: string,
) => readParam(params[key]) ?? '';
