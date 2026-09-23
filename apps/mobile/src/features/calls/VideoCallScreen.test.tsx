import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppState } from 'react-native';

import type { ActiveVoiceCallSession } from '@/store/call.store';
import { useActiveCallStore } from '@/store/call.store';
import { appRoutes } from '@/navigation/routes';
import type { ActiveCallTelemetrySnapshot } from './active-call.adapter';

const {
  activeCallAdapter,
  callPreconnectAdapter,
  callSessionAdapter,
  haptics,
  router,
  setCameraSessionActive,
  telemetryState,
  tickerNowMs,
  walletQuery,
} = vi.hoisted(() => {
  const createTelemetryFixture = (): ActiveCallTelemetrySnapshot => ({
    audioLevel: 0.7,
    cameraEnabled: true,
    cameraFacing: 'front',
    mediaMode: 'video',
    mediaResourceReady: true,
    muted: false,
    networkQuality: 'good',
    remoteCameraEnabled: true,
    remoteVideoConnected: true,
    speakerEnabled: false,
    updatedAtIso: '2026-07-16T10:00:00.000Z',
  });

  return {
    activeCallAdapter: {
      disconnectSession: vi.fn(() => Promise.resolve()),
      downgradeToVoice: vi.fn(() => Promise.resolve()),
      setCameraEnabled: vi.fn(() => Promise.resolve()),
      setMuted: vi.fn(() => Promise.resolve()),
      setSpeakerEnabled: vi.fn(() => Promise.resolve()),
      switchCamera: vi.fn(() => Promise.resolve('back')),
    },
    callPreconnectAdapter: {
      releaseVoiceResources: vi.fn(() => Promise.resolve()),
    },
    callSessionAdapter: {
      endVoiceSession: vi.fn(() => Promise.resolve()),
    },
    haptics: {
      selection: vi.fn(),
      warning: vi.fn(),
    },
    router: {
      push: vi.fn(),
      replace: vi.fn(),
    },
    setCameraSessionActive: vi.fn(),
    telemetryState: {
      current: createTelemetryFixture(),
    },
    tickerNowMs: {
      current: 5_000,
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
    },
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => router,
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: Record<string, unknown>) =>
    React.createElement('LinearGradient', props),
}));

vi.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) =>
    React.createElement('CameraView', props),
}));

vi.mock('lucide-react-native', () => {
  const icon = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('Icon', {
      ...props,
      name,
    });

  return {
    AlertCircle: icon('AlertCircle'),
    AlertTriangle: icon('AlertTriangle'),
    Bell: icon('Bell'),
    Camera: icon('Camera'),
    Flag: icon('Flag'),
    IndianRupee: icon('IndianRupee'),
    Mic: icon('Mic'),
    PhoneOff: icon('PhoneOff'),
    RefreshCw: icon('RefreshCw'),
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

vi.mock('react-native-gesture-handler', () => {
  const createGestureBuilder = () => {
    const builder = {
      activeOffsetX: () => builder,
      enabled: () => builder,
      onBegin: () => builder,
      onEnd: () => builder,
      onFinalize: () => builder,
      onUpdate: () => builder,
    };

    return builder;
  };

  return {
    Gesture: {
      Pan: createGestureBuilder,
      Tap: createGestureBuilder,
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement('View', { testID: 'gesture-detector' }, children),
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      children,
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
  useSlideStyle: () => ({}),
}));

vi.mock('@/components/animations', () => ({
  ConversationOrb: (props: Record<string, unknown>) =>
    React.createElement(
      'View',
      props,
      React.createElement('Text', null, 'ConversationOrb'),
    ),
}));

vi.mock('@/features/data/mobileDataHooks', () => ({
  formatMoney: (money: { amountPaise: number }) =>
    `Rs ${String(money.amountPaise / 100)}`,
  useWalletQuery: () => walletQuery,
}));

vi.mock('./active-call.adapter', () => ({
  ActiveCallRemoteVideoSurface: (props: Record<string, unknown>) =>
    React.createElement('RemoteVideoSurface', props),
  activeCallMediaBridge: {
    getSurfaceSupport: () => ({
      localPreview: 'placeholder' as const,
      remoteVideo: 'placeholder' as const,
    }),
  },
  activeCallSessionAdapter: activeCallAdapter,
  useActiveCallSessionTelemetry: () => telemetryState.current,
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
}));

import { VideoCallScreen } from './VideoCallScreen';

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

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const prepareVideoCall = () => {
  useActiveCallStore.getState().reset();
  useActiveCallStore.getState().startActiveCall('call_1', session, 0);
  useActiveCallStore.getState().transitionActive('unlock-video', 1_000);
  useActiveCallStore.getState().transitionActive('request-video', 2_000);
  useActiveCallStore.getState().transitionActive('accept-video', 3_000);
};

describe('active video call screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    AppState.currentState = 'active';
    prepareVideoCall();
    tickerNowMs.current = 5_000;

    telemetryState.current = {
      audioLevel: 0.7,
      cameraEnabled: true,
      cameraFacing: 'front',
      mediaMode: 'video',
      mediaResourceReady: true,
      muted: false,
      networkQuality: 'good',
      remoteCameraEnabled: true,
      remoteVideoConnected: true,
      speakerEnabled: false,
      updatedAtIso: '2026-07-16T10:00:00.000Z',
    };

    router.push.mockReset();
    router.replace.mockReset();
    setCameraSessionActive.mockReset();
    haptics.selection.mockReset();
    haptics.warning.mockReset();

    activeCallAdapter.disconnectSession.mockReset();
    activeCallAdapter.disconnectSession.mockResolvedValue(undefined);
    activeCallAdapter.downgradeToVoice.mockReset();
    activeCallAdapter.downgradeToVoice.mockResolvedValue(undefined);
    activeCallAdapter.setCameraEnabled.mockReset();
    activeCallAdapter.setCameraEnabled.mockResolvedValue(undefined);
    activeCallAdapter.setMuted.mockReset();
    activeCallAdapter.setMuted.mockResolvedValue(undefined);
    activeCallAdapter.setSpeakerEnabled.mockReset();
    activeCallAdapter.setSpeakerEnabled.mockResolvedValue(undefined);
    activeCallAdapter.switchCamera.mockReset();
    activeCallAdapter.switchCamera.mockResolvedValue('back');
    callPreconnectAdapter.releaseVoiceResources.mockReset();
    callPreconnectAdapter.releaseVoiceResources.mockResolvedValue(undefined);
    callSessionAdapter.endVoiceSession.mockReset();
    callSessionAdapter.endVoiceSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    useActiveCallStore.getState().reset();
    vi.useRealTimers();
  });

  it('returns to voice after confirmation and preserves the call route handoff', async () => {
    await render(<VideoCallScreen />);

    void fireEvent.press(screen.getByTestId('video-open-return-sheet'));
    void fireEvent.press(screen.getByTestId('video-confirm-return-voice'));
    await Promise.resolve();

    expect(activeCallAdapter.downgradeToVoice).toHaveBeenCalledTimes(1);
    expect(useActiveCallStore.getState().activeState).toBe('voice');
    expect(router.replace).toHaveBeenCalledWith(appRoutes.callVoice.path);
  });

  it('falls back to voice after remote video is lost beyond the grace window', async () => {
    await render(<VideoCallScreen />);

    act(() => {
      telemetryState.current = {
        ...telemetryState.current,
        mediaMode: 'voice',
        remoteVideoConnected: false,
      };
      tickerNowMs.current = 6_000;
      useActiveCallStore.getState().syncActiveCall(6_000);
    });

    act(() => {
      tickerNowMs.current = 10_500;
      useActiveCallStore.getState().syncActiveCall(10_500);
    });

    await Promise.resolve();

    expect(activeCallAdapter.downgradeToVoice).toHaveBeenCalledTimes(1);
    expect(useActiveCallStore.getState().activeState).toBe('voice');
    expect(router.replace).toHaveBeenCalledWith(appRoutes.callVoice.path);
  });

  it('auto-hides controls after inactivity and reveals them again on touch activity', async () => {
    await render(<VideoCallScreen />);

    expect(screen.getByTestId('video-call-controls').props.pointerEvents).toBe(
      'auto',
    );

    await advance(3_500);

    expect(screen.getByTestId('video-call-controls').props.pointerEvents).toBe(
      'none',
    );

    act(() => {
      const touchHandler = screen.getByTestId('video-call-touch-surface').props
        .onTouchStart as (() => void) | undefined;
      touchHandler?.();
    });

    expect(screen.getByTestId('video-call-controls').props.pointerEvents).toBe(
      'auto',
    );
  });
});
