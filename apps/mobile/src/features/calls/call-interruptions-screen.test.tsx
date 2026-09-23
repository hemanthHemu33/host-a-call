import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appRoutes } from '@/navigation/routes';
import { useActiveCallStore } from '@/store/call.store';
import type { ActiveVoiceCallSession } from '@/store/call.store';

const {
  activeCallAdapter,
  callPreconnectAdapter,
  callSessionAdapter,
  haptics,
  router,
  setCameraSessionActive,
  tickerNowMs,
  walletQuery,
} = vi.hoisted(() => ({
  activeCallAdapter: {
    cancelVideoUpgradeRequest: vi.fn(() => Promise.resolve()),
    connectSession: vi.fn(() => Promise.resolve()),
    disconnectSession: vi.fn(() => Promise.resolve()),
    setCameraEnabled: vi.fn(() => Promise.resolve()),
    setMuted: vi.fn(() => Promise.resolve()),
    setSpeakerEnabled: vi.fn(() => Promise.resolve()),
  },
  callPreconnectAdapter: {
    releaseVoiceResources: vi.fn(() => Promise.resolve()),
  },
  callSessionAdapter: {
    endVoiceSession: vi.fn(() => Promise.resolve()),
  },
  haptics: {
    lowBalance: vi.fn(),
    reject: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  setCameraSessionActive: vi.fn(),
  tickerNowMs: {
    current: 0,
  },
  walletQuery: {
    data: {
      balance: {
        amountPaise: 50_000,
        currency: 'INR' as const,
      },
    },
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn(() => Promise.resolve()),
  },
}));

const session: ActiveVoiceCallSession = {
  agoraAppId: 'mock-agora-app-id',
  callId: 'call_1',
  customerId: 'customer_1',
  hostAge: 25,
  hostId: 'host_anjali',
  hostLanguage: 'Telugu',
  hostName: 'Anjali',
  id: 'session_1',
  mediaResourceId: 'media_1',
  provider: 'mock',
  rtcChannelName: 'rtc_channel_1',
  rtcToken: 'voice-token',
  startedAtIso: '2026-07-16T10:00:00.000Z',
  tokenExpiresAtIso: '2026-07-16T10:10:00.000Z',
  videoAvailableAfterMinutes: 3,
  videoRate: { amountPaise: 1600, currency: 'INR' },
  voiceRate: { amountPaise: 1000, currency: 'INR' },
};

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
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
    AlertTriangle: icon('AlertTriangle'),
    Camera: icon('Camera'),
    Flag: icon('Flag'),
    IndianRupee: icon('IndianRupee'),
    Mic: icon('Mic'),
    PhoneOff: icon('PhoneOff'),
    RefreshCw: icon('RefreshCw'),
    ShieldAlert: icon('ShieldAlert'),
    Sparkles: icon('Sparkles'),
    UserX: icon('UserX'),
    Video: icon('Video'),
    Volume2: icon('Volume2'),
    X: icon('X'),
  };
});

vi.mock('@gorhom/bottom-sheet', () => {
  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement('View', props),
    BottomSheetModal: React.forwardRef(
      (
        props: {
          children: React.ReactNode;
          onDismiss?: () => void;
        },
        ref: React.ForwardedRef<{
          dismiss: () => void;
          present: () => void;
        }>,
      ) => {
        const [visible, setVisible] = React.useState(false);

        React.useImperativeHandle(ref, () => ({
          dismiss: () => {
            setVisible(false);
            props.onDismiss?.();
          },
          present: () => {
            setVisible(true);
          },
        }));

        return visible
          ? React.createElement(
              'View',
              { testID: 'mock-bottom-sheet' },
              props.children,
            )
          : null;
      },
    ),
    BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    BottomSheetView: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement('View', props, children),
  };
});

vi.mock('@/motion', () => ({
  layoutTransitions: {
    gentle: {},
  },
  useFadeStyle: () => ({}),
  useHaptics: () => haptics,
  useMotion: () => ({
    cameraUsesReliableHaptics: true,
    reducedMotionEnabled: false,
    setCameraSessionActive,
  }),
  usePulseStyle: () => ({}),
}));

vi.mock('@/components/animations', () => ({
  ConversationOrb: (props: Record<string, unknown>) =>
    React.createElement('View', props),
  LottieIllustration: (props: Record<string, unknown>) =>
    React.createElement('View', props),
  NetworkQualityMiniGraph: (props: Record<string, unknown>) =>
    React.createElement('View', props),
  TrustRing: (props: Record<string, unknown>) =>
    React.createElement('View', props),
  VoiceWaveform: (props: Record<string, unknown>) =>
    React.createElement('View', props),
}));

vi.mock('@/features/data/mobileDataHooks', () => ({
  formatMoney: (money: { amountPaise: number }) =>
    `Rs ${String(money.amountPaise / 100)}`,
  mobileDataIds: {
    customerId: 'customer_1',
  },
  useHostsQuery: () => ({
    data: [],
    isError: false,
    isPending: false,
  }),
  useWalletQuery: () => walletQuery,
}));

vi.mock('./active-call.adapter', () => ({
  activeCallSessionAdapter: activeCallAdapter,
  useActiveCallSessionTelemetry: () => null,
}));

vi.mock('./active-call', async () => {
  const actual = await vi.importActual('./active-call');

  return {
    ...actual,
    defaultActiveCallClock: {
      nowMs: () => tickerNowMs.current,
    },
    useActiveCallTicker: () => tickerNowMs.current,
  };
});

vi.mock('./call.preconnect', () => ({
  callPreconnectAdapter: callPreconnectAdapter,
  callSessionAdapter: callSessionAdapter,
  callPreconnectRuntimeConfig: {
    videoCountdownMs: 3_000,
    videoRejectCooldownMs: 30_000,
  },
}));

vi.mock('./CallReportComposer', () => ({
  CallReportComposer: () =>
    React.createElement('View', { testID: 'report-composer' }),
}));

import {
  buildReconnectSummaryRoute,
  ReconnectingCallScreen,
  VoiceCallScreen,
} from './CallScreens';

describe('call interruption screens', () => {
  beforeEach(() => {
    tickerNowMs.current = 0;
    router.push.mockReset();
    router.replace.mockReset();
    walletQuery.data.balance.amountPaise = 50_000;
    haptics.lowBalance.mockReset();
    haptics.warning.mockReset();
    useActiveCallStore.getState().reset();
  });

  afterEach(() => {
    useActiveCallStore.getState().reset();
  });

  it('opens the add money flow from a low balance warning while preserving the call return route', async () => {
    walletQuery.data.balance.amountPaise = 1_500;
    act(() => {
      useActiveCallStore.getState().startActiveCall('call_1', session, 0);
    });

    await render(<VoiceCallScreen />);

    void fireEvent.press(screen.getByTestId('call-low-balance-add-money'));
    void fireEvent.press(screen.getByTestId('call-add-money-continue'));

    const pushedRoute = router.push.mock.calls[0]?.[0] as
      | {
          params?: Record<string, string | undefined>;
          pathname: string;
        }
      | undefined;

    expect(pushedRoute?.pathname).toBe(appRoutes.customerAddMoney.path);
    expect(pushedRoute?.params?.amountRupees).toBe('250');
    expect(pushedRoute?.params?.initialScreen).toBe('payment');
    expect(pushedRoute?.params?.origin).toBe('call');
    expect(pushedRoute?.params?.returnTo).toBe(appRoutes.callVoice.path);
  });

  it('restores reconnecting calls back to the previous media mode', async () => {
    act(() => {
      useActiveCallStore.getState().startActiveCall('call_1', session, 0);
      useActiveCallStore.getState().transitionActive('unlock-video', 1_000);
      useActiveCallStore.getState().transitionActive('request-video', 2_000);
      useActiveCallStore.getState().transitionActive('accept-video', 3_000);
      useActiveCallStore.getState().transitionActive('connection-lost', 4_000);
    });

    await render(<ReconnectingCallScreen />);

    void fireEvent.press(screen.getByTestId('reconnecting-restore'));

    expect(useActiveCallStore.getState().activeState).toBe('video');
    expect(router.replace).toHaveBeenCalledWith(appRoutes.callVideo.path);
  });

  it('builds the reconnect-timeout summary route from the active call snapshot', () => {
    act(() => {
      useActiveCallStore.getState().startActiveCall('call_1', session, 0);
      useActiveCallStore.getState().transitionActive('connection-lost', 4_000);
      tickerNowMs.current = 40_000;
    });

    const reconnectSummaryRoute = buildReconnectSummaryRoute({
      activeCall: useActiveCallStore.getState(),
      nowMs: tickerNowMs.current,
      reason: 'reconnect-timeout',
    });

    expect(reconnectSummaryRoute.pathname).toBe(appRoutes.callSummary.path);
    expect(reconnectSummaryRoute.params.reason).toBe('reconnect-timeout');
  });
});
