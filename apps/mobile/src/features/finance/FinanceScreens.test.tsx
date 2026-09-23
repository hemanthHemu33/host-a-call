import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '@/navigation/routes';

const { financeAdapter, haptics, paramsState, queryClient, router } =
  vi.hoisted(() => ({
    financeAdapter: {
      openCheckout: vi.fn(),
      verifyPayment: vi.fn(),
    },
    haptics: {
      callAccepted: vi.fn(),
      lightImpact: vi.fn(),
      lowBalance: vi.fn(),
      mediumConfirm: vi.fn(),
      paymentResult: vi.fn(),
      rankUp: vi.fn(),
      reject: vi.fn(),
      selection: vi.fn(),
      success: vi.fn(),
      videoUnlocked: vi.fn(),
      warning: vi.fn(),
    },
    paramsState: {
      current: {
        amountPaise: '25000',
        method: 'upi',
        origin: 'call',
        paymentId: 'payment_2',
        returnTo: '/call/video',
      } satisfies Record<string, string | undefined>,
    },
    queryClient: {},
    router: {
      replace: vi.fn(),
    },
  }));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => paramsState.current,
  useRouter: () => router,
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: Record<string, unknown>) =>
    React.createElement('LinearGradient', props),
}));

vi.mock('lucide-react-native', () => {
  const icon = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('Icon', {
      ...props,
      name,
    });

  return {
    AlertCircle: icon('AlertCircle'),
    ArrowLeft: icon('ArrowLeft'),
    ChevronRight: icon('ChevronRight'),
    Building2: icon('Building2'),
    CheckCircle2: icon('CheckCircle2'),
    CreditCard: icon('CreditCard'),
    FileText: icon('FileText'),
    Headset: icon('Headset'),
    IndianRupee: icon('IndianRupee'),
    Landmark: icon('Landmark'),
    QrCode: icon('QrCode'),
    ReceiptText: icon('ReceiptText'),
    RefreshCw: icon('RefreshCw'),
    ShieldCheck: icon('ShieldCheck'),
    Smartphone: icon('Smartphone'),
    Tag: icon('Tag'),
    TimerReset: icon('TimerReset'),
    UserCheck: icon('UserCheck'),
    Wallet: icon('Wallet'),
    Zap: icon('Zap'),
    XCircle: icon('XCircle'),
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');

  return {
    ...actual,
    useQueryClient: () => queryClient,
  };
});

vi.mock('@/components/animations', () => ({
  LottieIllustration: (props: Record<string, unknown>) =>
    React.createElement('View', props),
}));

vi.mock('@/motion', () => ({
  useHaptics: () => haptics,
}));

vi.mock('@/motion/MotionProvider', () => ({
  useHaptics: () => haptics,
  useReducedMotionEnabled: () => false,
}));

vi.mock('@/data/query-client', () => ({
  invalidateDomainQueries: vi.fn(() => Promise.resolve()),
}));

vi.mock('../data/mobileDataHooks', () => ({
  mobileDataIds: {
    customerId: 'customer_1',
  },
}));

vi.mock('./finance.adapters', () => ({
  financePaymentAdapter: financeAdapter,
  pollVerifiedPayment: vi.fn(),
}));

import { pollVerifiedPayment } from './finance.adapters';
import { PaymentProcessingScreen } from './FinanceScreens';

const mockedPollVerifiedPayment = vi.mocked(pollVerifiedPayment);

const flushProcessing = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('payment processing screen', () => {
  beforeEach(() => {
    router.replace.mockReset();
    haptics.paymentResult.mockReset();
    mockedPollVerifiedPayment.mockReset();
    financeAdapter.openCheckout.mockReset();
    financeAdapter.verifyPayment.mockReset();
  });

  afterEach(() => {
    paramsState.current = {
      amountPaise: '25000',
      method: 'upi',
      origin: 'call',
      paymentId: 'payment_2',
      returnTo: '/call/video',
    };
  });

  it('returns a successful in-call top-up back to the active video route', async () => {
    financeAdapter.openCheckout.mockResolvedValue({
      callbacks: [
        {
          callbackId: 'checkout_payment_2',
          paymentId: 'payment_2',
          receivedAtIso: '2026-07-17T10:00:00.000Z',
        },
      ],
      kind: 'submitted',
    });
    mockedPollVerifiedPayment.mockResolvedValue({
      kind: 'payment',
      payment: {
        amount: { amountPaise: 25_000, currency: 'INR' },
        customerId: 'customer_1',
        id: 'payment_2',
        providerOrderId: 'order_2',
        status: 'success',
      },
    });

    await render(<PaymentProcessingScreen />);
    await act(async () => {
      await flushProcessing();
    });

    void fireEvent.press(screen.getByTestId('payment-result-primary-action'));
    expect(router.replace).toHaveBeenCalledWith(appRoutes.callVideo.path);
  });

  it('returns a pending payment result back to reconnecting when requested', async () => {
    paramsState.current = {
      amountPaise: '25000',
      method: 'upi',
      origin: 'call',
      paymentId: 'payment_2',
      returnTo: '/call/reconnecting',
    };
    financeAdapter.openCheckout.mockResolvedValue({
      callbacks: [
        {
          callbackId: 'checkout_payment_2',
          paymentId: 'payment_2',
          receivedAtIso: '2026-07-17T10:00:00.000Z',
        },
      ],
      kind: 'submitted',
    });
    mockedPollVerifiedPayment.mockResolvedValue({
      kind: 'payment',
      payment: {
        amount: { amountPaise: 25_000, currency: 'INR' },
        customerId: 'customer_1',
        id: 'payment_2',
        providerOrderId: 'order_2',
        status: 'pending',
      },
    });

    await render(<PaymentProcessingScreen />);
    await act(async () => {
      await flushProcessing();
    });

    void fireEvent.press(screen.getByTestId('payment-result-secondary-action'));
    expect(router.replace).toHaveBeenCalledWith(
      appRoutes.callReconnecting.path,
    );
  });
});
