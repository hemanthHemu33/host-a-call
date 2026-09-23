import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActiveVoiceCallSession } from '@/store/call.store';
import { useActiveCallStore } from '@/store/call.store';
import type { ActiveCallVideoUpgrade } from './active-call.adapter';

const {
  activeCallAdapter,
  haptics,
  permissionAdapter,
  router,
  setCameraSessionActive,
  walletQuery,
} = vi.hoisted(() => ({
  activeCallAdapter: {
    activateVideoMode: vi.fn(() => Promise.resolve({})),
    cancelVideoUpgradeRequest: vi.fn(() => Promise.resolve()),
    connectSession: vi.fn(() => Promise.resolve()),
    disconnectSession: vi.fn(() => Promise.resolve()),
    downgradeToVoice: vi.fn(() => Promise.resolve()),
    ensureVideoUpgradeRequest: vi.fn(),
    getVideoUpgradeRequest: vi.fn(() => null),
    pollVideoUpgrade: vi.fn(),
    readTelemetry: vi.fn(() => Promise.resolve(null)),
    setCameraEnabled: vi.fn(() => Promise.resolve()),
    setMuted: vi.fn(() => Promise.resolve()),
    setSpeakerEnabled: vi.fn(() => Promise.resolve()),
    switchCamera: vi.fn(() => Promise.resolve('front')),
    waitForRemoteVideoConnected: vi.fn(),
  },
  haptics: {
    lightImpact: vi.fn(),
    lowBalance: vi.fn(),
    paymentResult: vi.fn(),
    reject: vi.fn(),
    selection: vi.fn(),
    success: vi.fn(),
    videoUnlocked: vi.fn(),
    warning: vi.fn(),
  },
  permissionAdapter: {
    getCameraPermission: vi.fn(),
    openSettings: vi.fn(() => Promise.resolve()),
    requestCameraPermission: vi.fn(),
  },
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  setCameraSessionActive: vi.fn(),
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

const pendingVideoRequest: ActiveCallVideoUpgrade = {
  createdAtIso: '2026-07-16T10:00:00.000Z',
  id: 'video_request_1',
  rtcToken: null,
  status: 'pending',
  tokenExpiresAtIso: null,
  updatedAtIso: '2026-07-16T10:00:00.000Z',
};

const acceptedVideoRequest: ActiveCallVideoUpgrade = {
  createdAtIso: '2026-07-16T10:00:00.000Z',
  id: 'video_request_1',
  rtcToken: 'video-token',
  status: 'accepted',
  tokenExpiresAtIso: '2026-07-16T10:05:00.000Z',
  updatedAtIso: '2026-07-16T10:00:02.000Z',
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
    AlertCircle: icon('AlertCircle'),
    AlertTriangle: icon('AlertTriangle'),
    Bell: icon('Bell'),
    Camera: icon('Camera'),
    CheckCircle2: icon('CheckCircle2'),
    Flag: icon('Flag'),
    IndianRupee: icon('IndianRupee'),
    Mic: icon('Mic'),
    Phone: icon('Phone'),
    PhoneOff: icon('PhoneOff'),
    RefreshCw: icon('RefreshCw'),
    ShieldAlert: icon('ShieldAlert'),
    Sparkles: icon('Sparkles'),
    Star: icon('Star'),
    UserX: icon('UserX'),
    Video: icon('Video'),
    Volume2: icon('Volume2'),
    X: icon('X'),
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

vi.mock('@/components/animations', () => ({
  ConversationOrb: (props: Record<string, unknown>) =>
    React.createElement(
      'View',
      props,
      React.createElement('Text', null, 'ConversationOrb'),
    ),
  LottieIllustration: (props: Record<string, unknown>) =>
    React.createElement(
      'View',
      props,
      React.createElement('Text', null, 'LottieIllustration'),
    ),
  NetworkQualityMiniGraph: (props: Record<string, unknown>) =>
    React.createElement(
      'View',
      props,
      React.createElement('Text', null, 'NetworkQuality'),
    ),
  TrustRing: (props: Record<string, unknown>) =>
    React.createElement(
      'View',
      props,
      React.createElement('Text', null, 'TrustRing'),
    ),
  VoiceWaveform: (props: Record<string, unknown>) =>
    React.createElement(
      'View',
      props,
      React.createElement('Text', null, 'VoiceWaveform'),
    ),
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

vi.mock('./video-upgrade.adapter', () => ({
  videoUpgradePermissionAdapter: permissionAdapter,
}));

import { VoiceCallScreen } from './CallScreens';

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const prepareEligibleVoiceCall = () => {
  useActiveCallStore.getState().reset();
  useActiveCallStore.getState().startActiveCall('call_1', session, 0);
  useActiveCallStore.getState().transitionActive('unlock-video', 1_000);
};

describe('voice screen video upgrade flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    router.push.mockReset();
    router.replace.mockReset();
    setCameraSessionActive.mockReset();
    walletQuery.refetch.mockClear();

    for (const fn of Object.values(haptics)) {
      fn.mockReset();
    }

    for (const fn of Object.values(activeCallAdapter)) {
      fn.mockReset();
    }

    activeCallAdapter.activateVideoMode.mockResolvedValue({});
    activeCallAdapter.cancelVideoUpgradeRequest.mockResolvedValue(undefined);
    activeCallAdapter.connectSession.mockResolvedValue(undefined);
    activeCallAdapter.downgradeToVoice.mockResolvedValue(undefined);
    activeCallAdapter.ensureVideoUpgradeRequest.mockResolvedValue(
      pendingVideoRequest,
    );
    activeCallAdapter.getVideoUpgradeRequest.mockReturnValue(null);
    activeCallAdapter.pollVideoUpgrade.mockResolvedValue(acceptedVideoRequest);
    activeCallAdapter.setCameraEnabled.mockResolvedValue(undefined);
    activeCallAdapter.setMuted.mockResolvedValue(undefined);
    activeCallAdapter.setSpeakerEnabled.mockResolvedValue(undefined);
    activeCallAdapter.waitForRemoteVideoConnected.mockResolvedValue({
      connectedAtIso: '2026-07-16T10:00:05.000Z',
    });

    permissionAdapter.getCameraPermission.mockResolvedValue('granted');
    permissionAdapter.openSettings.mockResolvedValue(undefined);
    permissionAdapter.requestCameraPermission.mockResolvedValue('granted');

    prepareEligibleVoiceCall();
  });

  afterEach(() => {
    useActiveCallStore.getState().reset();
    vi.useRealTimers();
  });

  it('accepts a video upgrade and switches the active call into video after remote connection', async () => {
    void render(<VoiceCallScreen />);

    void fireEvent.press(screen.getByTestId('voice-request-video'));
    await advance(1_000);
    await advance(3_000);

    expect(activeCallAdapter.waitForRemoteVideoConnected).toHaveBeenCalledTimes(
      1,
    );
    expect(useActiveCallStore.getState().activeState).toBe('video');
    expect(screen.getByTestId('voice-video-live')).toBeDefined();
  });

  it('starts cooldown after host rejection', async () => {
    activeCallAdapter.pollVideoUpgrade.mockResolvedValueOnce({
      ...pendingVideoRequest,
      status: 'rejected',
      updatedAtIso: '2026-07-16T10:00:02.000Z',
    });

    void render(<VoiceCallScreen />);

    void fireEvent.press(screen.getByTestId('voice-request-video'));
    await advance(1_000);

    expect(useActiveCallStore.getState().activeState).toBe('video-rejected');
    expect(screen.getByTestId('voice-video-cooldown')).toBeDefined();
  });

  it('cancels a pending request and keeps the call on voice', () => {
    void render(<VoiceCallScreen />);

    void fireEvent.press(screen.getByTestId('voice-request-video'));
    void fireEvent.press(screen.getByTestId('video-upgrade-cancel'));

    expect(activeCallAdapter.cancelVideoUpgradeRequest).toHaveBeenCalledTimes(
      1,
    );
    expect(useActiveCallStore.getState().activeState).toBe('voice-eligible');
  });

  it('continues on voice and exposes settings when camera permission is denied', async () => {
    permissionAdapter.getCameraPermission.mockResolvedValueOnce('denied');

    void render(<VoiceCallScreen />);

    void fireEvent.press(screen.getByTestId('voice-request-video'));
    await advance(1_000);

    expect(useActiveCallStore.getState().activeState).toBe('voice-eligible');
    expect(screen.getByTestId('video-upgrade-settings')).toBeDefined();

    void fireEvent.press(screen.getByTestId('video-upgrade-settings'));
    expect(permissionAdapter.openSettings).toHaveBeenCalledTimes(1);
  });

  it('returns to voice when remote video connection fails', async () => {
    activeCallAdapter.waitForRemoteVideoConnected.mockRejectedValueOnce(
      new Error('Remote video failed to connect.'),
    );

    void render(<VoiceCallScreen />);

    void fireEvent.press(screen.getByTestId('voice-request-video'));
    await advance(1_000);
    await advance(3_000);

    expect(useActiveCallStore.getState().activeState).toBe('voice-eligible');
    expect(screen.getByTestId('video-upgrade-dismiss')).toBeDefined();
  });
});
