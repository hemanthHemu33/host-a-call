import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  Camera,
  Flag,
  Headphones,
  IndianRupee,
  Mic,
  Phone,
  PhoneOff,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserX,
  Video,
  Volume2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated from 'react-native-reanimated';

import {
  normalizeApiError,
  type ActiveCallEvent,
  type ActiveCallState,
  type HostSummary,
} from '@connecto/domain';

import { ConversationOrb } from '@/components/animations/ConversationOrb';
import { LottieIllustration } from '@/components/animations/LottieIllustration';
import {
  NetworkQualityMiniGraph,
  VoiceWaveform,
} from '@/components/animations/SkiaVisuals';
import { resolveCustomerAvatarSource } from '@/assets/avatars/customer-avatars';
import avatarReferenceImage from '@/assets/reference-onboarding/avatar-reference.jpeg';
import { CallScreen, useResponsiveLayout } from '@/components/layout';
import { BottomSheetWrapper } from '@/components/ui';
import { Button, CallControlButton } from '@/components/ui/controls';
import { Banner, ConfirmationDialog } from '@/components/ui/feedback';
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import {
  formatMoney,
  mobileDataIds,
  useCustomerProfileQuery,
  useHostsQuery,
  useWalletQuery,
} from '@/features/data/mobileDataHooks';
import { appRoutes } from '@/navigation/routes';
import {
  layoutTransitions,
  useFadeStyle,
  useHaptics,
  useMotion,
  usePulseStyle,
} from '@/motion';
import {
  activeCallEndConfirmationDurationMs,
  activeCallUnlockDurationMs,
  getActiveCallConnectedDurationMs,
  getActiveCallVideoDurationMs,
  getActiveCallVideoUnlockRemainingMs,
  initialCallStore,
  markVideoUnlockCelebratedStore,
  readMonotonicNowMs,
  setActiveCallMutedStore,
  setActiveCallSpeakerEnabledStore,
  startActiveCallStore,
  syncActiveCallStore,
  type ActiveVoiceCallSession,
  transitionActiveCallStore,
  updateActiveCallSessionStore,
  useActiveCallStore,
} from '@/store/call.store';
import { getAuthSnapshot } from '@/store/auth.store';
import {
  defaultDiscoveryPreferences,
  type DiscoveryPreferences,
} from '@/features/discovery/discovery.models';
import { loadDiscoveryPreferences } from '@/features/discovery/discovery.storage';

import {
  callPreconnectAdapter,
  callPreconnectRuntimeConfig,
  callSessionAdapter,
  minimumVoiceBalancePaise,
  outgoingCallRouteParamsForHost,
  parseOutgoingCallRouteParams,
  resolveCallPreconnect,
  ringWithTimeout,
  type CallIntent,
  type CallMediaResource,
  type CallPreconnectResult,
  type MicrophonePermissionState,
  type OutgoingCallRouteParams,
} from './call.preconnect';
import { CallReportComposer } from './CallReportComposer';
import {
  AddMoneyDuringCallSheet,
  LowBalanceNoticeCard,
} from './CallSafetyPanels';
import {
  activeCallSessionAdapter,
  useActiveCallSessionTelemetry,
  type ActiveCallVideoUpgrade,
} from './active-call.adapter';
import {
  createMockWaveformSamples,
  defaultActiveCallClock,
  deriveNetworkQualityModel,
  deriveTrustRingStage,
  estimateRemainingBalancePaise,
  estimateRemainingTimeMs,
  formatActiveCallDuration,
  formatRemainingUnlockLabel,
  useActiveCallTicker,
} from './active-call';
import {
  callSafetyRuntimeConfig,
  createCallSummaryRouteParams,
  formatCallSafetyDuration,
  formatPaise,
  getReconnectRemainingMs,
  type CallSummaryEndReason,
} from './call-safety';
import {
  PostCallSummaryScreen,
  prePersistPostCallRecord,
} from '@/features/post-call/PostCallScreens';
import { videoUpgradePermissionAdapter } from './video-upgrade.adapter';
import {
  canCancelVideoUpgrade,
  formatVideoUpgradeTimerLabel,
  getVideoUpgradeCooldownRemainingMs,
  getVideoUpgradeCountdownSeconds,
  initialVideoUpgradePhase,
  isVideoUpgradeVisualPhase,
  transitionVideoUpgradePhase,
  type VideoUpgradePhase,
} from './video-upgrade';

const demoActiveCallSession: ActiveVoiceCallSession = {
  agoraAppId: 'mock-agora-app-id',
  callId: 'demo-call',
  customerId: mobileDataIds.customerId,
  hostAge: 25,
  hostId: 'host_anjali',
  hostLanguage: 'Telugu',
  hostName: 'Anjali',
  hostProfileImageUri:
    'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22240%22%20height%3D%22240%22%20viewBox%3D%220%200%20240%20240%22%3E%3Crect%20width%3D%22240%22%20height%3D%22240%22%20rx%3D%22120%22%20fill%3D%22%23fce7f3%22%2F%3E%3Ccircle%20cx%3D%22120%22%20cy%3D%22112%22%20r%3D%2268%22%20fill%3D%22%23be2f6b%22%20opacity%3D%220.18%22%2F%3E%3Ccircle%20cx%3D%22120%22%20cy%3D%22100%22%20r%3D%2244%22%20fill%3D%22%23be2f6b%22%20opacity%3D%220.32%22%2F%3E%3Cpath%20d%3D%22M56%20206c12-44%2044-68%2064-68s52%2024%2064%2068%22%20fill%3D%22%23be2f6b%22%20opacity%3D%220.26%22%2F%3E%3Ctext%20x%3D%22120%22%20y%3D%22126%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2C%20Arial%2C%20sans-serif%22%20font-size%3D%2272%22%20font-weight%3D%22800%22%20fill%3D%22%237a123f%22%3EA%3C%2Ftext%3E%3C%2Fsvg%3E',
  id: 'demo-session',
  mediaResourceId: 'demo-media',
  provider: 'mock',
  rtcChannelName: 'demo_channel_anjali',
  rtcToken: 'demo-token',
  startedAtIso: '2026-07-16T10:00:00.000Z',
  tokenExpiresAtIso: '2026-07-16T10:10:00.000Z',
  videoAvailableAfterMinutes: 3,
  videoRate: {
    amountPaise: 1600,
    currency: 'INR',
  },
  voiceRate: {
    amountPaise: 1000,
    currency: 'INR',
  },
};

const hostProfileImageUriForCall = (hostName: string, providedUri?: string) => {
  if (providedUri !== undefined) {
    return providedUri;
  }

  const initial = encodeURIComponent(hostName.slice(0, 1).toUpperCase() || 'H');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="120" fill="#fce7f3"/><circle cx="120" cy="112" r="74" fill="#be2f6b" opacity="0.18"/><circle cx="120" cy="96" r="46" fill="#be2f6b" opacity="0.34"/><path d="M48 208c14-48 48-74 72-74s58 26 72 74" fill="#be2f6b" opacity="0.28"/><text x="120" y="124" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="74" font-weight="800" fill="#7a123f">${initial}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const avatarFallbackCrop = {
  customer: { height: 230, width: 230, x: 416, y: 512 },
  host: { height: 230, width: 230, x: 416, y: 221 },
} as const;

const usableRasterUri = (uri: string | undefined) =>
  uri !== undefined &&
  !uri.startsWith('data:image/svg') &&
  !uri.startsWith('mock://') &&
  !uri.startsWith('preset://');

function CroppedAvatarFallback({
  crop,
  size,
}: {
  crop: { height: number; width: number; x: number; y: number };
  size: number;
}) {
  const scale = size / crop.width;

  return (
    <Image
      accessibilityIgnoresInvertColors
      source={avatarReferenceImage}
      style={{
        height: 1600 * scale,
        left: -crop.x * scale,
        position: 'absolute',
        top: -crop.y * scale,
        width: 722 * scale,
      }}
    />
  );
}

function CallAvatar({
  label,
  size,
  sourceUri,
  testID,
  variant,
}: {
  label: string;
  size: number;
  sourceUri?: string;
  testID?: string;
  variant: keyof typeof avatarFallbackCrop;
}) {
  const [failedSourceUri, setFailedSourceUri] = useState<string | null>(null);
  const customerAvatarSource = resolveCustomerAvatarSource(sourceUri);

  const showSource =
    (customerAvatarSource !== undefined || usableRasterUri(sourceUri)) &&
    failedSourceUri !== sourceUri;
  const source: ImageSourcePropType | null = showSource
    ? (customerAvatarSource ?? { uri: sourceUri })
    : null;

  return (
    <View
      accessibilityLabel={`${label} avatar`}
      style={[
        styles.callAvatarFrame,
        { borderRadius: size / 2, height: size, width: size },
      ]}
      testID={testID}
    >
      {source !== null ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => {
            setFailedSourceUri(sourceUri ?? null);
          }}
          source={source}
          style={styles.callAvatarImage}
        />
      ) : (
        <CroppedAvatarFallback crop={avatarFallbackCrop[variant]} size={size} />
      )}
    </View>
  );
}

const createVoiceSnapshot = () =>
  startActiveCallStore(
    initialCallStore,
    'demo-call',
    demoActiveCallSession,
    readMonotonicNowMs(),
  );

const endStoredActiveCall = async () => {
  const store = useActiveCallStore.getState();
  const session = store.activeSession;

  if (session !== null) {
    await Promise.allSettled([
      activeCallSessionAdapter.disconnectSession({ session }),
      callSessionAdapter.endVoiceSession(session.id),
      callPreconnectAdapter.releaseVoiceResources(session.mediaResourceId),
    ]);
  }

  store.reset();
};

export const buildReconnectSummaryRoute = (input: {
  activeCall: ReturnType<typeof useActiveCallStore.getState>;
  nowMs: number;
  reason: CallSummaryEndReason;
}) => {
  const reconnectSession = input.activeCall.activeSession;
  const connectedDurationMs = getActiveCallConnectedDurationMs(
    input.activeCall,
    input.nowMs,
  );
  const videoDurationMs = getActiveCallVideoDurationMs(
    input.activeCall,
    input.nowMs,
  );

  return {
    params: createCallSummaryRouteParams({
      ...(reconnectSession?.callId === undefined
        ? {}
        : { callId: reconnectSession.callId }),
      connectedDurationMs,
      endedAtIso: new Date().toISOString(),
      ...(reconnectSession?.hostId === undefined
        ? {}
        : { hostId: reconnectSession.hostId }),
      ...(reconnectSession?.hostName === undefined
        ? {}
        : { hostName: reconnectSession.hostName }),
      mediaMode:
        input.activeCall.activeRuntime?.reconnectTarget === 'video'
          ? 'video'
          : 'voice',
      reason: input.reason,
      ...(reconnectSession?.id === undefined
        ? {}
        : { sessionId: reconnectSession.id }),
      videoDurationMs,
    }),
    pathname: appRoutes.callSummary.path,
  };
};

const activeCopy: Record<ActiveCallState, { body: string; title: string }> = {
  ended: {
    body: 'The active call machine is complete.',
    title: 'Call ended',
  },
  reconnecting: {
    body: 'Connection recovery is in progress. Restore the call or end it.',
    title: 'Reconnecting',
  },
  video: {
    body: 'Camera routes keep the motion provider camera session active.',
    title: 'Video active',
  },
  'video-rejected': {
    body: 'The video upgrade was not approved or could not be completed.',
    title: 'Video rejected',
  },
  'video-requested': {
    body: 'Waiting for the host and media session provider to confirm the video upgrade.',
    title: 'Video requested',
  },
  voice: {
    body: 'Voice is active and can request a video upgrade or handle reconnects.',
    title: 'Voice active',
  },
  'voice-eligible': {
    body: 'Video upgrades are available from this voice session.',
    title: 'Video eligible',
  },
  'voice-locked': {
    body: 'Video is locked until the route unlock action runs.',
    title: 'Voice locked',
  },
};

const trustStageLabel = {
  early: 'Warm-up',
  ready: 'Video ready',
  steady: 'Trust building',
} as const;

const activeRouteForState = (state: ActiveCallState | null) => {
  if (state === 'video') {
    return appRoutes.callVideo.path;
  }

  if (state === 'video-requested') {
    return appRoutes.callVideoRequest.path;
  }

  return appRoutes.callVoice.path;
};

const useCameraSessionLifecycle = (active: boolean) => {
  const { setCameraSessionActive } = useMotion();

  useEffect(() => {
    setCameraSessionActive(active);

    return () => {
      setCameraSessionActive(false);
    };
  }, [active, setCameraSessionActive]);
};

function StageCard({
  body,
  pulsing = false,
  state,
  title,
  tone = 'info',
}: {
  body: string;
  pulsing?: boolean;
  state: string;
  title: string;
  tone?: 'error' | 'info' | 'success' | 'warning';
}) {
  const pulseStyle = usePulseStyle(pulsing);

  return (
    <Card style={styles.stageCard}>
      <View style={styles.stageHeader}>
        <View style={styles.stageCopy}>
          <Text accessibilityRole="header" style={styles.stageTitle}>
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <Animated.View style={pulseStyle}>
          <StatusBadge label={state} tone={tone} />
        </Animated.View>
      </View>
    </Card>
  );
}

function ActionWrap({ children }: { children: ReactNode }) {
  return <View style={styles.actionWrap}>{children}</View>;
}

function VideoUnlockPriorityCard({
  hostName,
  onRequestVideo,
  remainingUnlockMs,
  state,
  videoRateLabel,
  videoUnlockProgress,
  videoUpgradeCooldownRemainingMs,
  videoUpgradePhase,
  videoUpgradeReady,
  voiceRateLabel,
}: {
  hostName: string;
  onRequestVideo: () => void;
  remainingUnlockMs: number;
  state: ActiveCallState;
  videoRateLabel: string;
  videoUnlockProgress: number;
  videoUpgradeCooldownRemainingMs: number;
  videoUpgradePhase: VideoUpgradePhase;
  videoUpgradeReady: boolean;
  voiceRateLabel: string;
}) {
  const pulseStyle = usePulseStyle(state !== 'video');
  const progressPercent = Math.round(videoUnlockProgress * 100);
  const title =
    state === 'video'
      ? 'Video is live'
      : videoUpgradeReady
        ? 'Video unlocked'
        : `${formatRemainingUnlockLabel(remainingUnlockMs)} to unlock`;

  return (
    <LinearGradient
      colors={
        state === 'video' || videoUpgradeReady
          ? [ui.color.brand.primary, ui.color.accent.coral]
          : [ui.color.brand.primaryPressed, ui.color.call.backgroundStart]
      }
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.videoUnlockCard}
    >
      <Animated.View style={[styles.videoUnlockGlow, pulseStyle]} />
      <View style={styles.videoUnlockTopRow}>
        <Animated.View style={[styles.videoUnlockIcon, pulseStyle]}>
          <Sparkles color={ui.color.text.inverse} size={28} />
        </Animated.View>
        <View style={styles.videoUnlockCopy}>
          <Text style={styles.videoUnlockEyebrow}>Top priority</Text>
          <Text style={styles.videoUnlockTitle}>{title}</Text>
          <Text style={styles.videoUnlockBody}>
            Keep voice with {hostName} active for 3 minutes to unlock a video
            request.
          </Text>
        </View>
        <View style={styles.videoUnlockPercent}>
          <Text style={styles.videoUnlockPercentValue}>
            {String(progressPercent)}%
          </Text>
          <Text style={styles.videoUnlockPercentLabel}>done</Text>
        </View>
      </View>
      <View style={styles.videoUnlockTrack}>
        <View
          style={[
            styles.videoUnlockFill,
            { flex: Math.max(videoUnlockProgress, 0.04) },
          ]}
        />
        <View style={{ flex: Math.max(1 - videoUnlockProgress, 0) }} />
      </View>
      <View style={styles.videoUnlockSteps}>
        <View style={styles.videoUnlockStepActive}>
          <Text style={styles.videoUnlockStepTitle}>Voice live</Text>
          <Text style={styles.videoUnlockStepBody}>{voiceRateLabel}/min</Text>
        </View>
        <View style={styles.videoUnlockStep}>
          <Text style={styles.videoUnlockStepTitle}>3 min spark</Text>
          <Text style={styles.videoUnlockStepBody}>Unlocks request</Text>
        </View>
        <View style={styles.videoUnlockStep}>
          <Text style={styles.videoUnlockStepTitle}>Video connect</Text>
          <Text style={styles.videoUnlockStepBody}>{videoRateLabel}/min</Text>
        </View>
      </View>
      {state === 'video' ? (
        <Button
          disabled
          icon={Video}
          testID="voice-video-live"
          title={`Video connected at ${videoRateLabel}/min`}
          variant="secondary"
        />
      ) : videoUpgradeReady && videoUpgradePhase.kind === 'idle' ? (
        <Button
          icon={Video}
          onPress={onRequestVideo}
          testID="voice-request-video"
          title={`Ask ${hostName} for Video`}
          variant="secondary"
        />
      ) : videoUpgradePhase.kind === 'cooldown' ? (
        <Button
          disabled
          icon={Video}
          testID="voice-video-cooldown"
          title={`Retry in ${formatRemainingUnlockLabel(
            videoUpgradeCooldownRemainingMs,
          )}`}
          variant="secondary"
        />
      ) : (
        <Button
          disabled
          icon={Video}
          testID="voice-video-locked"
          title={`Unlocks in ${formatRemainingUnlockLabel(remainingUnlockMs)}`}
          variant="secondary"
        />
      )}
    </LinearGradient>
  );
}

type DiscoveryPreferencesLoadState =
  | { kind: 'error'; message: string }
  | { data: DiscoveryPreferences; kind: 'ready' }
  | { kind: 'loading' };

type PreconnectPhase =
  | { kind: 'accepted'; intent: CallIntent }
  | {
      kind: 'account-blocked';
      reason: Extract<
        CallPreconnectResult,
        { kind: 'account-blocked' }
      >['reason'];
    }
  | { kind: 'busy' }
  | { kind: 'cancelled' }
  | { kind: 'checking'; body: string; title: string }
  | { kind: 'connection-failed'; message: string }
  | { kind: 'host-blocked' }
  | { kind: 'idle' }
  | {
      kind: 'insufficient-balance';
      minimumRequiredBalancePaise: number;
      shortfallPaise: number;
    }
  | { kind: 'loading'; message: string }
  | { kind: 'microphone-denied' }
  | {
      errorMessage?: string;
      kind: 'microphone-explanation';
      requesting: boolean;
    }
  | { kind: 'no-answer' }
  | { kind: 'rejected' }
  | { intent: CallIntent; kind: 'ringing' };

const terminalPhaseCopy = {
  busy: {
    body: 'This host is already on another call. Try an alternative host without any charge.',
    title: 'Host is busy',
  },
  cancelled: {
    body: 'The call request was cancelled before connection. No charge was created.',
    title: 'Call cancelled',
  },
  'connection-failed': {
    body: 'The call could not be connected. Try again or choose another online host.',
    title: 'Connection failed',
  },
  'host-blocked': {
    body: 'This host is blocked on this device. Choose another online host from discovery.',
    title: 'Host blocked',
  },
  'microphone-denied': {
    body: 'Microphone access is required for a voice call. Enable it in system settings, then try again.',
    title: 'Microphone blocked',
  },
  'no-answer': {
    body: 'The host did not answer in time. No charge was created.',
    title: 'No answer',
  },
  rejected: {
    body: 'The host declined the request. No charge was created.',
    title: 'Call rejected',
  },
} as const;

const accountBlockCopy = {
  blocked:
    'This account is blocked for calling. Contact support if this looks wrong.',
  'signed-out': 'Sign in again before starting a voice call.',
  suspended:
    'This account is suspended for calling. Contact support if this looks wrong.',
  'wrong-role': 'Switch to a customer account before starting a host call.',
} as const satisfies Record<
  Extract<CallPreconnectResult, { kind: 'account-blocked' }>['reason'],
  string
>;

const isCancellablePhase = (phase: PreconnectPhase) =>
  phase.kind === 'checking' ||
  phase.kind === 'loading' ||
  phase.kind === 'microphone-explanation' ||
  phase.kind === 'ringing';

const isControllerCancelled = (controller: AbortController) =>
  controller.signal.aborted;

const findSelectedHost = (
  hosts: readonly HostSummary[] | undefined,
  routeParams: OutgoingCallRouteParams,
) =>
  routeParams.discoveryHostId === null
    ? undefined
    : hosts?.find((host) => host.id === routeParams.discoveryHostId);

const hostDisplayName = (
  host: HostSummary | undefined,
  routeParams: OutgoingCallRouteParams,
) => host?.displayName ?? routeParams.discoveryHostName ?? 'Selected host';

const hostLanguageLabel = (
  host: HostSummary | undefined,
  routeParams: OutgoingCallRouteParams,
) => host?.language ?? routeParams.discoveryHostLanguage ?? 'Voice host';

function AlternativeHosts({
  hosts,
  onCall,
}: {
  hosts: readonly HostSummary[];
  onCall: (host: HostSummary) => void;
}) {
  if (hosts.length === 0) {
    return (
      <Text style={styles.preconnectMuted}>
        No alternative online hosts are available in this mock list right now.
      </Text>
    );
  }

  return (
    <View style={styles.alternativeStack}>
      <Text style={styles.preconnectEyebrow}>Alternative hosts</Text>
      {hosts.map((host) => (
        <View key={host.id} style={styles.alternativeRow}>
          <Avatar label={host.displayName} size="sm" />
          <View style={styles.alternativeCopy}>
            <Text style={styles.alternativeName}>{host.displayName}</Text>
            <Text style={styles.preconnectMuted}>
              {host.language} · {host.rank}
            </Text>
          </View>
          <Button
            compact
            onPress={() => {
              onCall(host);
            }}
            title="Call"
          />
        </View>
      ))}
    </View>
  );
}

export function OutgoingCallScreen() {
  const params = useLocalSearchParams<{
    discoveryAutoConnect?: string;
    discoveryCandidateHostIds?: string;
    discoveryHostId?: string;
    discoveryHostLanguage?: string;
    discoveryHostName?: string;
    discoveryHostRank?: string;
    discoveryInitialState?: string;
  }>();
  const routeParams = useMemo(
    () => parseOutgoingCallRouteParams(params),
    [params],
  );
  const router = useRouter();
  const haptics = useHaptics();
  const hostsQuery = useHostsQuery();
  const walletQuery = useWalletQuery();
  const customerQuery = useCustomerProfileQuery();
  const [preferencesState, setPreferencesState] =
    useState<DiscoveryPreferencesLoadState>({ kind: 'loading' });
  const [phase, setPhase] = useState<PreconnectPhase>({
    kind: routeParams.discoveryAutoConnect === 'true' ? 'loading' : 'idle',
    message: 'Preparing voice call',
  });
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const activeIntentRef = useRef<CallIntent | null>(null);
  const activeMediaResourceRef = useRef<CallMediaResource | null>(null);
  const autoStartedKeyRef = useRef<string | null>(null);
  const flowRunningRef = useRef(false);
  const mountedRef = useRef(true);
  const selectedHost = useMemo(
    () => findSelectedHost(hostsQuery.data, routeParams),
    [hostsQuery.data, routeParams],
  );
  const randomCandidateHostIds = useMemo(
    () =>
      routeParams.discoveryCandidateHostIds
        ?.split(',')
        .map((hostId) => hostId.trim())
        .filter((hostId) => hostId.length > 0) ?? [],
    [routeParams.discoveryCandidateHostIds],
  );
  const preferences =
    preferencesState.kind === 'ready'
      ? preferencesState.data
      : defaultDiscoveryPreferences;
  const alternativeHosts = useMemo(() => {
    if (hostsQuery.data === undefined) {
      return [];
    }

    const onlineHosts = hostsQuery.data.filter(
      (host) =>
        host.availability === 'online' &&
        host.id !== selectedHost?.id &&
        !preferences.blockedHostIds.includes(host.id),
    );

    if (randomCandidateHostIds.length === 0) {
      return onlineHosts.slice(0, 3);
    }

    return randomCandidateHostIds
      .map((hostId) => onlineHosts.find((host) => host.id === hostId))
      .filter((host): host is HostSummary => host !== undefined)
      .slice(0, 3);
  }, [
    hostsQuery.data,
    preferences.blockedHostIds,
    randomCandidateHostIds,
    selectedHost?.id,
  ]);
  const hostName = hostDisplayName(selectedHost, routeParams);
  const hostLanguage = hostLanguageLabel(selectedHost, routeParams);
  const preconnectHostProfileImageUri = hostProfileImageUriForCall(
    hostName,
    selectedHost?.profileImageUri,
  );
  const customerName = customerQuery.data?.displayName ?? 'You';
  const preconnectCustomerProfileImageUri = hostProfileImageUriForCall(
    customerName,
    customerQuery.data?.profileImageUri,
  );
  const avatarPulseStyle = usePulseStyle(phase.kind === 'ringing');

  useCameraSessionLifecycle(false);

  const safeSetPhase = useCallback((nextPhase: PreconnectPhase) => {
    if (mountedRef.current) {
      setPhase(nextPhase);
    }
  }, []);

  const releaseActiveResources = useCallback(
    ({ abort = true }: { abort?: boolean } = {}) => {
      if (abort) {
        activeAbortControllerRef.current?.abort(new Error('call-cleanup'));
      }

      activeAbortControllerRef.current = null;

      if (activeMediaResourceRef.current !== null) {
        void callPreconnectAdapter.releaseVoiceResources(
          activeMediaResourceRef.current.id,
        );
        activeMediaResourceRef.current = null;
      }

      if (activeIntentRef.current !== null) {
        void callPreconnectAdapter.releaseCallIntent(
          activeIntentRef.current.id,
        );
        activeIntentRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      releaseActiveResources();
    };
  }, [releaseActiveResources]);

  useEffect(() => {
    let active = true;

    loadDiscoveryPreferences()
      .then((nextPreferences) => {
        if (active) {
          setPreferencesState({ data: nextPreferences, kind: 'ready' });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setPreferencesState({
            kind: 'error',
            message: normalizeApiError(error).message,
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const routeToHost = useCallback(
    (host: HostSummary) => {
      releaseActiveResources();
      autoStartedKeyRef.current = null;
      router.replace({
        params: {
          ...outgoingCallRouteParamsForHost(host),
          ...(randomCandidateHostIds.length > 0
            ? {
                discoveryCandidateHostIds: randomCandidateHostIds.join(','),
                discoveryInitialState: 'random',
              }
            : {}),
        },
        pathname: appRoutes.callOutgoing.path,
      });
    },
    [randomCandidateHostIds, releaseActiveResources, router],
  );

  const addMoneyForCall = useCallback(() => {
    if (selectedHost === undefined) {
      return;
    }

    releaseActiveResources();
    router.push({
      params: {
        ...outgoingCallRouteParamsForHost(selectedHost),
        origin: 'call',
        returnTo: appRoutes.callOutgoing.path,
      },
      pathname: appRoutes.customerAddMoney.path,
    });
  }, [releaseActiveResources, router, selectedHost]);

  const applyPreconnectResult = useCallback(
    (result: Exclude<CallPreconnectResult, { kind: 'ready' }>) => {
      flowRunningRef.current = false;

      switch (result.kind) {
        case 'account-blocked':
          haptics.reject();
          safeSetPhase({ kind: 'account-blocked', reason: result.reason });
          return;
        case 'host-blocked':
          haptics.reject();
          safeSetPhase({ kind: 'host-blocked' });
          return;
        case 'host-unavailable':
          haptics.reject();
          safeSetPhase(
            result.reason === 'busy'
              ? { kind: 'busy' }
              : {
                  kind: 'connection-failed',
                  message: 'The host is not available for calls right now.',
                },
          );
          return;
        case 'insufficient-balance':
          haptics.lowBalance();
          safeSetPhase({
            kind: 'insufficient-balance',
            minimumRequiredBalancePaise: result.minimumRequiredBalancePaise,
            shortfallPaise: result.shortfallPaise,
          });
          return;
        case 'microphone-denied':
          haptics.reject();
          safeSetPhase({ kind: 'microphone-denied' });
          return;
        case 'microphone-explanation':
          safeSetPhase({ kind: 'microphone-explanation', requesting: false });
          return;
      }
    },
    [haptics, safeSetPhase],
  );

  const continueAfterMicrophone = useCallback(
    async (
      permission: MicrophonePermissionState,
      controller: AbortController,
    ) => {
      if (
        selectedHost === undefined ||
        walletQuery.data === undefined ||
        preferencesState.kind !== 'ready'
      ) {
        flowRunningRef.current = false;
        return;
      }

      const result = resolveCallPreconnect({
        account: getAuthSnapshot(),
        blockedHostIds: preferencesState.data.blockedHostIds,
        host: selectedHost,
        microphonePermission: permission,
        wallet: walletQuery.data,
      });

      if (result.kind !== 'ready') {
        applyPreconnectResult(result);
        return;
      }

      try {
        safeSetPhase({
          body: 'Creating a call intent. No wallet charge is made before connection.',
          kind: 'checking',
          title: 'Preparing call',
        });

        const intent = await callPreconnectAdapter.createCallIntent({
          customerId: mobileDataIds.customerId,
          host: selectedHost,
          minimumRequiredBalancePaise: result.minimumRequiredBalancePaise,
        });
        activeIntentRef.current = intent;

        if (isControllerCancelled(controller)) {
          flowRunningRef.current = false;
          releaseActiveResources({ abort: false });
          safeSetPhase({ kind: 'cancelled' });
          return;
        }

        safeSetPhase({
          body: 'Preparing microphone and voice resources before the host is rung.',
          kind: 'checking',
          title: 'Preparing microphone',
        });

        const mediaResource =
          await callPreconnectAdapter.prepareVoiceResources(intent);

        if (isControllerCancelled(controller)) {
          activeMediaResourceRef.current = mediaResource;
          flowRunningRef.current = false;
          releaseActiveResources({ abort: false });
          safeSetPhase({ kind: 'cancelled' });
          return;
        }

        activeMediaResourceRef.current = mediaResource;
        safeSetPhase({ intent, kind: 'ringing' });

        const outcome = await ringWithTimeout({
          adapter: callPreconnectAdapter,
          intent,
          signal: controller.signal,
          timeoutMs: callPreconnectRuntimeConfig.ringTimeoutMs,
        });

        flowRunningRef.current = false;

        if (outcome === 'cancelled') {
          releaseActiveResources({ abort: false });
          safeSetPhase({ kind: 'cancelled' });
          return;
        }

        if (outcome === 'accepted') {
          const activeSession = await callSessionAdapter.startVoiceSession({
            host: selectedHost,
            intent,
            mediaResource,
          });

          try {
            await activeCallSessionAdapter.connectSession({
              session: activeSession,
            });
          } catch (error: unknown) {
            await Promise.allSettled([
              activeCallSessionAdapter.disconnectSession({
                session: activeSession,
              }),
              callSessionAdapter.endVoiceSession(activeSession.id),
              callPreconnectAdapter.releaseCallIntent(intent.id),
              callPreconnectAdapter.releaseVoiceResources(mediaResource.id),
            ]);

            throw error;
          }

          useActiveCallStore
            .getState()
            .startActiveCall(activeSession.callId, activeSession);
          activeAbortControllerRef.current = null;
          activeIntentRef.current = null;
          activeMediaResourceRef.current = null;
          haptics.callAccepted();
          safeSetPhase({ intent, kind: 'accepted' });
          router.replace(appRoutes.callVoice.path);
          return;
        }

        releaseActiveResources({ abort: false });
        haptics.reject();

        if (outcome === 'busy') {
          safeSetPhase({ kind: 'busy' });
          return;
        }

        if (outcome === 'rejected') {
          safeSetPhase({ kind: 'rejected' });
          return;
        }

        if (outcome === 'no-answer' || outcome === 'timeout') {
          safeSetPhase({ kind: 'no-answer' });
          return;
        }

        safeSetPhase({
          kind: 'connection-failed',
          message:
            'The mock call adapter could not establish a ringing session.',
        });
      } catch (error: unknown) {
        releaseActiveResources({ abort: false });
        flowRunningRef.current = false;

        if (controller.signal.aborted) {
          safeSetPhase({ kind: 'cancelled' });
          return;
        }

        haptics.reject();
        safeSetPhase({
          kind: 'connection-failed',
          message: normalizeApiError(error).message,
        });
      }
    },
    [
      applyPreconnectResult,
      haptics,
      preferencesState,
      releaseActiveResources,
      router,
      safeSetPhase,
      selectedHost,
      walletQuery.data,
    ],
  );

  const beginPreconnect = useCallback(async () => {
    if (
      flowRunningRef.current ||
      selectedHost === undefined ||
      walletQuery.data === undefined ||
      preferencesState.kind !== 'ready'
    ) {
      return;
    }

    flowRunningRef.current = true;
    releaseActiveResources();

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    const earlyResult = resolveCallPreconnect({
      account: getAuthSnapshot(),
      blockedHostIds: preferencesState.data.blockedHostIds,
      host: selectedHost,
      microphonePermission: 'prompt',
      wallet: walletQuery.data,
    });

    if (earlyResult.kind === 'ready') {
      await continueAfterMicrophone('granted', controller);
      return;
    }

    if (earlyResult.kind !== 'microphone-explanation') {
      applyPreconnectResult(earlyResult);
      return;
    }

    try {
      safeSetPhase({
        body: 'Checking account, host availability, wallet balance, and microphone status in order.',
        kind: 'checking',
        title: 'Running call preflight',
      });

      const permission = await callPreconnectAdapter.getMicrophonePermission();

      if (controller.signal.aborted) {
        flowRunningRef.current = false;
        safeSetPhase({ kind: 'cancelled' });
        return;
      }

      await continueAfterMicrophone(permission, controller);
    } catch (error: unknown) {
      flowRunningRef.current = false;

      if (controller.signal.aborted) {
        safeSetPhase({ kind: 'cancelled' });
        return;
      }

      haptics.reject();
      safeSetPhase({
        kind: 'connection-failed',
        message: normalizeApiError(error).message,
      });
    }
  }, [
    applyPreconnectResult,
    continueAfterMicrophone,
    haptics,
    preferencesState,
    releaseActiveResources,
    safeSetPhase,
    selectedHost,
    walletQuery.data,
  ]);

  useEffect(() => {
    if (
      routeParams.discoveryAutoConnect !== 'true' ||
      selectedHost === undefined ||
      walletQuery.data === undefined ||
      preferencesState.kind !== 'ready'
    ) {
      return;
    }

    const autoKey = [
      selectedHost.id,
      String(walletQuery.data.balance.amountPaise),
      preferencesState.data.blockedHostIds.join(','),
    ].join(':');

    if (autoStartedKeyRef.current === autoKey) {
      return;
    }

    autoStartedKeyRef.current = autoKey;
    void beginPreconnect();
  }, [
    beginPreconnect,
    preferencesState,
    routeParams.discoveryAutoConnect,
    selectedHost,
    walletQuery.data,
  ]);

  const retryCurrentHost = useCallback(() => {
    autoStartedKeyRef.current = null;
    void beginPreconnect();
  }, [beginPreconnect]);

  const requestMicrophone = useCallback(async () => {
    if (flowRunningRef.current) {
      return;
    }

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    flowRunningRef.current = true;
    safeSetPhase({ kind: 'microphone-explanation', requesting: true });

    try {
      const permission =
        await callPreconnectAdapter.requestMicrophonePermission();

      if (controller.signal.aborted) {
        flowRunningRef.current = false;
        safeSetPhase({ kind: 'cancelled' });
        return;
      }

      await continueAfterMicrophone(permission, controller);
    } catch (error: unknown) {
      flowRunningRef.current = false;
      safeSetPhase({
        errorMessage: normalizeApiError(error).message,
        kind: 'microphone-explanation',
        requesting: false,
      });
    }
  }, [continueAfterMicrophone, safeSetPhase]);

  const cancelOutgoing = useCallback(() => {
    flowRunningRef.current = false;
    releaseActiveResources();
    safeSetPhase({ kind: 'cancelled' });
  }, [releaseActiveResources, safeSetPhase]);

  const renderPhaseContent = () => {
    if (routeParams.discoveryHostId === null) {
      return (
        <EmptyState
          actionLabel="Back to Home"
          icon={PhoneOff}
          message="Choose an online host from Home to start a one-tap voice call."
          onAction={() => {
            router.replace(appRoutes.customerHome.path);
          }}
          title="No host selected"
        />
      );
    }

    if (hostsQuery.isPending || walletQuery.isPending) {
      return (
        <Card style={styles.preconnectCard}>
          <Skeleton lines={4} />
        </Card>
      );
    }

    if (hostsQuery.isError || walletQuery.isError) {
      const error = hostsQuery.error ?? walletQuery.error;

      return (
        <ErrorState
          message={normalizeApiError(error).message}
          onRetry={() => {
            void Promise.all([hostsQuery.refetch(), walletQuery.refetch()]);
          }}
          title="Could not prepare call"
        />
      );
    }

    if (preferencesState.kind === 'loading') {
      return (
        <Card style={styles.preconnectCard}>
          <Skeleton lines={3} />
        </Card>
      );
    }

    if (preferencesState.kind === 'error') {
      return (
        <ErrorState
          message={preferencesState.message}
          onRetry={() => {
            setPreferencesState({ kind: 'loading' });
            loadDiscoveryPreferences()
              .then((data) => {
                setPreferencesState({ data, kind: 'ready' });
              })
              .catch((error: unknown) => {
                setPreferencesState({
                  kind: 'error',
                  message: normalizeApiError(error).message,
                });
              });
          }}
          title="Could not load call preferences"
        />
      );
    }

    if (selectedHost === undefined) {
      return (
        <ErrorState
          message="The selected host is no longer available in the discovery list."
          onRetry={() => {
            router.replace(appRoutes.customerHome.path);
          }}
          retryLabel="Back to Home"
          title="Host unavailable"
        />
      );
    }

    if (phase.kind === 'idle') {
      return (
        <Card style={styles.preconnectCard}>
          <Text style={styles.preconnectTitle}>Ready to call</Text>
          <Text style={styles.preconnectBody}>
            Start a voice request to {hostName}. Preflight checks happen before
            any mock call intent is created.
          </Text>
          <Button
            icon={Mic}
            onPress={() => {
              void beginPreconnect();
            }}
            testID="preconnect-start"
            title="Start Voice Call"
          />
        </Card>
      );
    }

    if (phase.kind === 'loading' || phase.kind === 'checking') {
      return (
        <Card style={styles.preconnectCard}>
          <Text style={styles.preconnectTitle}>
            {phase.kind === 'checking' ? phase.title : 'Preparing call'}
          </Text>
          <Text style={styles.preconnectBody}>
            {phase.kind === 'checking' ? phase.body : phase.message}
          </Text>
          <StatusBadge label="preflight" tone="info" />
        </Card>
      );
    }

    if (phase.kind === 'microphone-explanation') {
      return (
        <Card style={styles.preconnectCard}>
          <View style={styles.preconnectIcon}>
            <Mic color={ui.color.text.inverse} size={28} />
          </View>
          <Text style={styles.preconnectTitle}>Allow microphone access</Text>
          <Text style={styles.preconnectBody}>
            Voice calls need microphone access only when you start a call.
            Camera permission is still requested just-in-time for video.
          </Text>
          {phase.errorMessage === undefined ? null : (
            <Text style={styles.preconnectError}>{phase.errorMessage}</Text>
          )}
          <Button
            disabled={phase.requesting}
            loading={phase.requesting}
            onPress={() => {
              void requestMicrophone();
            }}
            testID="request-microphone"
            title="Continue"
          />
        </Card>
      );
    }

    if (phase.kind === 'ringing' || phase.kind === 'accepted') {
      return (
        <Card style={styles.preconnectCard}>
          <ConversationOrb
            accessibilityLabel={`Ringing ${hostName}`}
            state={phase.kind === 'accepted' ? 'connecting' : 'ringing'}
            testID="preconnect-orb"
          />
          <Text style={styles.preconnectTitle}>
            {phase.kind === 'accepted' ? 'Connecting voice' : 'Ringing host'}
          </Text>
          <Text style={styles.preconnectBody}>
            {phase.kind === 'accepted'
              ? `${hostName} accepted. Opening the voice call.`
              : `Waiting for ${hostName} to answer. You can cancel before connection.`}
          </Text>
          <Text style={styles.preconnectMuted}>
            No charge is shown or applied before a connected call.
          </Text>
        </Card>
      );
    }

    if (phase.kind === 'insufficient-balance') {
      return (
        <Card style={styles.preconnectCard}>
          <View style={styles.preconnectIcon}>
            <IndianRupee color={ui.color.text.inverse} size={28} />
          </View>
          <Text style={styles.preconnectTitle}>Add money to continue</Text>
          <Text style={styles.preconnectBody}>
            Keep at least{' '}
            {formatMoney({
              amountPaise: phase.minimumRequiredBalancePaise,
              currency: 'INR',
            })}{' '}
            available for three voice minutes. Add{' '}
            {formatMoney({
              amountPaise: phase.shortfallPaise,
              currency: 'INR',
            })}{' '}
            to resume this call request.
          </Text>
          <Button
            icon={IndianRupee}
            onPress={addMoneyForCall}
            testID="preconnect-add-money"
            title="Add Money"
          />
        </Card>
      );
    }

    if (phase.kind === 'account-blocked') {
      return (
        <Card style={styles.preconnectCard}>
          <View style={styles.preconnectIcon}>
            <ShieldAlert color={ui.color.text.inverse} size={28} />
          </View>
          <Text style={styles.preconnectTitle}>Calling unavailable</Text>
          <Text style={styles.preconnectBody}>
            {accountBlockCopy[phase.reason]}
          </Text>
          <Button
            onPress={() => {
              router.replace(appRoutes.customerHome.path);
            }}
            title="Back to Home"
            variant="secondary"
          />
        </Card>
      );
    }

    const copy =
      phase.kind === 'connection-failed'
        ? {
            ...terminalPhaseCopy['connection-failed'],
            body: phase.message,
          }
        : terminalPhaseCopy[phase.kind];

    return (
      <Card style={styles.preconnectCard}>
        <View style={styles.preconnectIcon}>
          <UserX color={ui.color.text.inverse} size={28} />
        </View>
        <Text style={styles.preconnectTitle}>{copy.title}</Text>
        <Text style={styles.preconnectBody}>{copy.body}</Text>
        {phase.kind === 'busy' || phase.kind === 'no-answer' ? (
          <AlternativeHosts hosts={alternativeHosts} onCall={routeToHost} />
        ) : null}
        <View style={styles.preconnectActions}>
          <Button
            icon={RefreshCw}
            onPress={retryCurrentHost}
            title="Try Again"
          />
          <Button
            onPress={() => {
              router.replace(appRoutes.customerHome.path);
            }}
            title="Back to Home"
            variant="secondary"
          />
        </View>
      </Card>
    );
  };

  const showCallingVisual =
    phase.kind === 'accepted' ||
    phase.kind === 'checking' ||
    phase.kind === 'loading' ||
    phase.kind === 'ringing';
  const callingStatus =
    phase.kind === 'accepted'
      ? 'Connecting...'
      : phase.kind === 'ringing'
        ? 'Ringing...'
        : 'Connecting...';

  return (
    <CallScreen
      controls={
        isCancellablePhase(phase) ? (
          <View style={styles.controlsRow}>
            <CallControlButton
              accessibilityLabel="Cancel outgoing voice call"
              icon={PhoneOff}
              label="Cancel"
              onPress={cancelOutgoing}
              testID="preconnect-cancel"
              tone="destructive"
            />
          </View>
        ) : undefined
      }
      style={styles.preconnectSafeArea}
      testID="outgoing-call-screen"
    >
      <LinearGradient
        colors={[ui.color.call.backgroundStart, ui.color.call.backgroundEnd]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.preconnectContent}>
        {showCallingVisual ? (
          <View style={styles.outgoingReplica}>
            <View style={styles.outgoingBrandBlock}>
              <Text style={styles.outgoingLogo}>Connecto!</Text>
              <Text style={styles.outgoingStatus}>{callingStatus}</Text>
            </View>
            <View style={styles.outgoingParticipant}>
              <Animated.View style={avatarPulseStyle}>
                <CallAvatar
                  label={hostName}
                  size={72}
                  sourceUri={preconnectHostProfileImageUri}
                  testID="preconnect-host-avatar"
                  variant="host"
                />
              </Animated.View>
              <Text accessibilityRole="header" style={styles.outgoingName}>
                {hostName}
              </Text>
            </View>
            <LottieIllustration
              assetId="connectoCalling"
              fallback={<Phone color={ui.color.text.inverse} size={52} />}
              fallbackLabel="Calling animation"
              style={styles.outgoingCallingAnimation}
              testID="preconnect-calling-animation"
            />
            <View style={styles.outgoingParticipant}>
              <CallAvatar
                label={customerName}
                size={72}
                sourceUri={preconnectCustomerProfileImageUri}
                testID="preconnect-customer-avatar"
                variant="customer"
              />
              <Text style={styles.outgoingName}>You</Text>
            </View>
            <View style={styles.outgoingHeadphones}>
              <Headphones color={ui.color.text.inverse} size={22} />
              <Text style={styles.outgoingHeadphonesText}>
                Use Headphones for Better Calling Experience
              </Text>
            </View>
          </View>
        ) : null}
        {showCallingVisual ? null : (
          <>
            <Animated.View style={avatarPulseStyle}>
              <CallAvatar
                label={hostName}
                size={72}
                sourceUri={preconnectHostProfileImageUri}
                testID="preconnect-host-avatar"
                variant="host"
              />
            </Animated.View>
            <View style={styles.preconnectHeader}>
              <Text
                accessibilityRole="header"
                style={styles.preconnectHostName}
              >
                {hostName}
              </Text>
              <Text style={styles.preconnectHostMeta}>
                {hostLanguage} · Voice call
              </Text>
              <Text style={styles.preconnectVideoNote}>
                Video available after 3 connected minutes
              </Text>
              {selectedHost === undefined ? null : (
                <Text style={styles.preconnectMutedInverse}>
                  Minimum balance:{' '}
                  {formatMoney({
                    amountPaise: minimumVoiceBalancePaise(selectedHost),
                    currency: 'INR',
                  })}
                </Text>
              )}
            </View>
            {renderPhaseContent()}
          </>
        )}
      </View>
    </CallScreen>
  );
}

export function VoiceCallScreen() {
  const [snapshot, setSnapshot] = useState(createVoiceSnapshot);
  const [videoUpgradePhase, setVideoUpgradePhase] = useState<VideoUpgradePhase>(
    initialVideoUpgradePhase,
  );
  const activeCall = useActiveCallStore();
  const haptics = useHaptics();
  const router = useRouter();
  const { cameraUsesReliableHaptics, reducedMotionEnabled } = useMotion();
  const { isLandscape } = useResponsiveLayout();
  const nowMs = useActiveCallTicker({
    clock: defaultActiveCallClock,
  });
  const [unlockCelebrationVisible, setUnlockCelebrationVisible] =
    useState(false);
  const [endConfirmationVisible, setEndConfirmationVisible] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [callNotice, setCallNotice] = useState<{
    message: string;
    title: string;
    tone: 'error' | 'info' | 'success' | 'warning';
  } | null>(null);
  const [cameraUpdating, setCameraUpdating] = useState(false);
  const [lowBalanceModalVisible, setLowBalanceModalVisible] = useState(false);
  const [lowBalancePulseVisible, setLowBalancePulseVisible] = useState(false);
  const [muteUpdating, setMuteUpdating] = useState(false);
  const [routeUpdating, setRouteUpdating] = useState(false);
  const [selectedTopUpAmount, setSelectedTopUpAmount] = useState<number>(250);
  const [speakerUpdating, setSpeakerUpdating] = useState(false);
  const [topUpSheetOpenedAtMs, setTopUpSheetOpenedAtMs] = useState<
    number | null
  >(null);
  const addMoneySheetRef = useRef<BottomSheetModal | null>(null);
  const reportSheetRef = useRef<BottomSheetModal | null>(null);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const celebrationHapticTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lowBalancePulseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const videoUpgradePollTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const videoUpgradeControllerRef = useRef<AbortController | null>(null);
  const acceptedVideoUpgradeRef = useRef<ActiveCallVideoUpgrade | null>(null);
  const lowBalanceModalShownRef = useRef(false);
  const lowBalanceWarningHandledRef = useRef(false);
  const reconnectRouteHandledRef = useRef(false);
  const zeroBalanceHandledRef = useRef(false);
  const hasStoredSession = activeCall.activeCallId !== null;
  const previewSnapshot = useMemo(
    () => syncActiveCallStore(snapshot, nowMs),
    [nowMs, snapshot],
  );
  const activeSnapshot = hasStoredSession ? activeCall : previewSnapshot;
  const state = activeSnapshot.activeState ?? 'voice-locked';
  const session = activeSnapshot.activeSession ?? demoActiveCallSession;
  const hostProfileImageUri = hostProfileImageUriForCall(
    session.hostName,
    session.hostProfileImageUri,
  );
  const runtime = activeSnapshot.activeRuntime;
  const controls = activeSnapshot.activeControls;
  const liveTelemetry = useActiveCallSessionTelemetry({
    activeState: state,
    enabled: hasStoredSession,
    session: hasStoredSession ? activeSnapshot.activeSession : null,
  });
  const connectedDurationMs = getActiveCallConnectedDurationMs(
    activeSnapshot,
    nowMs,
  );
  const videoDurationMs = getActiveCallVideoDurationMs(activeSnapshot, nowMs);
  const remainingUnlockMs = getActiveCallVideoUnlockRemainingMs(
    activeSnapshot,
    nowMs,
  );
  const videoUnlockProgress = Math.min(
    1,
    Math.max(0, connectedDurationMs / activeCallUnlockDurationMs),
  );
  const trustRingStage = deriveTrustRingStage(connectedDurationMs);
  const networkQuality = deriveNetworkQualityModel({
    activeState: state,
    connectedDurationMs,
    nowMs,
    qualityOverride: liveTelemetry?.networkQuality,
  });
  const waveformSamples = createMockWaveformSamples({
    active: state !== 'reconnecting' && state !== 'ended',
    audioLevel: liveTelemetry?.audioLevel,
    nowMs,
    reducedMotionEnabled,
  });
  const walletQuery = useWalletQuery();
  const walletBalancePaise = walletQuery.data?.balance.amountPaise ?? 0;
  const remainingBalancePaise = estimateRemainingBalancePaise({
    balancePaise: walletBalancePaise,
    connectedDurationMs,
    videoDurationMs,
    videoRatePaise: session.videoRate.amountPaise,
    voiceRatePaise: session.voiceRate.amountPaise,
  });
  const estimatedRemainingTimeMs = estimateRemainingTimeMs(
    remainingBalancePaise,
    (state === 'video' ? session.videoRate : session.voiceRate).amountPaise,
  );
  const videoUpgradeReady = state === 'voice-eligible' || state === 'voice';
  const pendingUnlockCelebration =
    runtime !== null &&
    runtime.videoUnlockEmittedAtMs !== null &&
    runtime.videoUnlockCelebratedAtMs === null;
  const videoUpgradeCountdownSeconds = getVideoUpgradeCountdownSeconds(
    videoUpgradePhase,
    nowMs,
  );
  const videoUpgradeCooldownRemainingMs = getVideoUpgradeCooldownRemainingMs(
    videoUpgradePhase,
    nowMs,
  );
  const videoExperienceExpanded =
    state === 'video' || isVideoUpgradeVisualPhase(videoUpgradePhase);
  const selfPreviewVisible =
    state === 'video' ||
    videoUpgradePhase.kind === 'countdown' ||
    videoUpgradePhase.kind === 'connecting';
  const remoteSurfaceVisible =
    state === 'video' || videoUpgradePhase.kind === 'connecting';
  const remoteSurfaceFadeStyle = useFadeStyle(remoteSurfaceVisible, {
    duration: 'screen',
    easing: 'gentle',
  });
  const selfPreviewFadeStyle = useFadeStyle(selfPreviewVisible, {
    duration: 'component',
    easing: 'gentle',
  });
  const videoRateLabel = formatMoney(session.videoRate);
  const voiceRateLabel = formatMoney(session.voiceRate);
  const currentRateLabel = state === 'video' ? videoRateLabel : voiceRateLabel;
  const estimatedRemainingTimeLabel = formatActiveCallDuration(
    estimatedRemainingTimeMs,
  );
  const remainingBalanceLabel = formatPaise(remainingBalancePaise);
  const lowBalanceWarningActive =
    hasStoredSession &&
    state !== 'ended' &&
    state !== 'reconnecting' &&
    estimatedRemainingTimeMs > 0 &&
    estimatedRemainingTimeMs <=
      callSafetyRuntimeConfig.lowBalanceWarningThresholdMs;
  const lowBalanceCritical =
    lowBalanceWarningActive &&
    estimatedRemainingTimeMs <=
      callSafetyRuntimeConfig.lowBalanceModalThresholdMs;
  const topUpGraceRemainingMs =
    topUpSheetOpenedAtMs === null
      ? callSafetyRuntimeConfig.addMoneyGraceMs
      : Math.max(
          0,
          callSafetyRuntimeConfig.addMoneyGraceMs -
            Math.max(0, nowMs - topUpSheetOpenedAtMs),
        );
  const activeStateRef = useRef(state);

  const transitionActive = useCallback(
    (event: ActiveCallEvent) => {
      const atMs = readMonotonicNowMs();

      if (hasStoredSession) {
        activeCall.transitionActive(event, atMs);
        return;
      }

      setSnapshot((current) => transitionActiveCallStore(current, event, atMs));
    },
    [activeCall, hasStoredSession],
  );

  const updateActiveSession = useCallback(
    (patch: Partial<ActiveVoiceCallSession>) => {
      if (hasStoredSession) {
        activeCall.updateActiveSession(patch);
        return;
      }

      setSnapshot((current) => updateActiveCallSessionStore(current, patch));
    },
    [activeCall, hasStoredSession],
  );

  const setMuted = useCallback(
    async (muted: boolean) => {
      if (hasStoredSession) {
        setMuteUpdating(true);

        try {
          await activeCallSessionAdapter.setMuted({
            muted,
            session,
          });
          activeCall.setMuted(muted);
          setControlError(null);
        } catch (error: unknown) {
          setControlError(normalizeApiError(error).message);
        } finally {
          setMuteUpdating(false);
        }

        return;
      }

      setSnapshot((current) => setActiveCallMutedStore(current, muted));
    },
    [activeCall, hasStoredSession, session],
  );

  const setSpeakerEnabled = useCallback(
    async (speakerEnabled: boolean) => {
      if (hasStoredSession) {
        setSpeakerUpdating(true);

        try {
          await activeCallSessionAdapter.setSpeakerEnabled({
            session,
            speakerEnabled,
          });
          activeCall.setSpeakerEnabled(speakerEnabled);
          setControlError(null);
        } catch (error: unknown) {
          setControlError(normalizeApiError(error).message);
        } finally {
          setSpeakerUpdating(false);
        }

        return;
      }

      setSnapshot((current) =>
        setActiveCallSpeakerEnabledStore(current, speakerEnabled),
      );
    },
    [activeCall, hasStoredSession, session],
  );

  const setCameraEnabled = useCallback(
    async (cameraEnabled: boolean) => {
      if (hasStoredSession) {
        setCameraUpdating(true);

        try {
          await activeCallSessionAdapter.setCameraEnabled({
            cameraEnabled,
            session,
          });
          activeCall.setCameraEnabled(cameraEnabled);
          setControlError(null);
        } catch (error: unknown) {
          setControlError(normalizeApiError(error).message);
        } finally {
          setCameraUpdating(false);
        }

        return;
      }

      setSnapshot((current) => ({
        ...current,
        activeControls: {
          ...current.activeControls,
          cameraEnabled,
        },
      }));
    },
    [activeCall, hasStoredSession, session],
  );

  const markVideoUnlockCelebrated = useCallback(
    (atMs: number) => {
      if (hasStoredSession) {
        activeCall.markVideoUnlockCelebrated(atMs);
        return;
      }

      setSnapshot((current) => markVideoUnlockCelebratedStore(current, atMs));
    },
    [activeCall, hasStoredSession],
  );

  const routeToSummary = useCallback(
    (
      reason: CallSummaryEndReason,
      summarySnapshot: { endedAtIso: string; videoDurationMs: number },
    ) => {
      const mediaMode = state === 'video' ? 'video' : 'voice';
      const params = createCallSummaryRouteParams({
        callId: session.callId,
        connectedDurationMs,
        endedAtIso: summarySnapshot.endedAtIso,
        hostId: session.hostId,
        hostName: session.hostName,
        mediaMode,
        remainingBalancePaise,
        reason,
        sessionId: session.id,
        videoDurationMs: summarySnapshot.videoDurationMs,
      });

      void prePersistPostCallRecord({
        callId: session.callId,
        connectedDurationMs,
        endedAtIso: summarySnapshot.endedAtIso,
        hostId: session.hostId,
        hostName: session.hostName,
        mediaMode,
        reason,
        remainingBalancePaise,
        sessionId: session.id,
        videoDurationMs: summarySnapshot.videoDurationMs,
      }).catch(() => undefined);

      router.replace({
        params,
        pathname: appRoutes.callSummary.path,
      });
    },
    [
      connectedDurationMs,
      remainingBalancePaise,
      router,
      session.callId,
      session.hostId,
      session.hostName,
      session.id,
      state,
    ],
  );

  const endCall = useCallback(
    (reason: CallSummaryEndReason = 'manual') => {
      const summarySnapshot = {
        endedAtIso: new Date().toISOString(),
        videoDurationMs: getActiveCallVideoDurationMs(
          useActiveCallStore.getState(),
          readMonotonicNowMs(),
        ),
      };

      setLowBalanceModalVisible(false);
      reportSheetRef.current?.dismiss();
      addMoneySheetRef.current?.dismiss();
      setTopUpSheetOpenedAtMs(null);
      transitionActive('end');
      void endStoredActiveCall().finally(() => {
        routeToSummary(reason, summarySnapshot);
      });
    },
    [routeToSummary, transitionActive],
  );

  const openAddMoneySheet = useCallback(() => {
    setCallNotice(null);
    setTopUpSheetOpenedAtMs(readMonotonicNowMs());
    addMoneySheetRef.current?.present();
  }, []);

  const handleAddMoneySheetDismiss = useCallback(() => {
    setTopUpSheetOpenedAtMs(null);
  }, []);

  const closeAddMoneySheet = useCallback(() => {
    setTopUpSheetOpenedAtMs(null);
    addMoneySheetRef.current?.dismiss();
  }, []);

  const continueToAddMoneyFlow = useCallback(() => {
    const callGraceEndsAtIso = new Date(
      Date.now() + Math.max(0, topUpGraceRemainingMs),
    ).toISOString();

    closeAddMoneySheet();
    router.push({
      params: {
        amountRupees: String(selectedTopUpAmount),
        callGraceEndsAtIso,
        initialScreen: 'payment',
        origin: 'call',
        returnTo: activeRouteForState(state),
      },
      pathname: appRoutes.customerAddMoney.path,
    });
  }, [
    closeAddMoneySheet,
    router,
    selectedTopUpAmount,
    state,
    topUpGraceRemainingMs,
  ]);

  const openReportSheet = useCallback(() => {
    setCallNotice(null);
    reportSheetRef.current?.present();
  }, []);

  const closeReportSheet = useCallback(() => {
    reportSheetRef.current?.dismiss();
  }, []);

  const handleReportSubmitted = useCallback(
    ({ endedCall }: { endedCall: boolean }) => {
      reportSheetRef.current?.dismiss();

      if (endedCall) {
        endCall('report-submit-end');
        return;
      }

      setCallNotice({
        message:
          'The report was added to the mock safety service. The call can continue while review is pending.',
        title: 'Report submitted',
        tone: 'success',
      });
    },
    [endCall],
  );

  useEffect(() => {
    if (!hasStoredSession || state !== 'reconnecting') {
      reconnectRouteHandledRef.current = false;
      return;
    }

    if (reconnectRouteHandledRef.current) {
      return;
    }

    reconnectRouteHandledRef.current = true;
    router.replace(appRoutes.callReconnecting.path);
  }, [hasStoredSession, router, state]);

  useEffect(() => {
    if (!lowBalanceWarningActive) {
      lowBalanceWarningHandledRef.current = false;
      lowBalanceModalShownRef.current = false;

      if (lowBalancePulseTimeoutRef.current !== null) {
        clearTimeout(lowBalancePulseTimeoutRef.current);
        lowBalancePulseTimeoutRef.current = null;
      }

      setLowBalancePulseVisible(false);
      return;
    }

    if (!lowBalanceWarningHandledRef.current) {
      lowBalanceWarningHandledRef.current = true;
      haptics.lowBalance();

      if (!reducedMotionEnabled) {
        setLowBalancePulseVisible(true);

        if (lowBalancePulseTimeoutRef.current !== null) {
          clearTimeout(lowBalancePulseTimeoutRef.current);
        }

        lowBalancePulseTimeoutRef.current = setTimeout(() => {
          setLowBalancePulseVisible(false);
          lowBalancePulseTimeoutRef.current = null;
        }, 900);
      }
    }

    if (lowBalanceCritical && !lowBalanceModalShownRef.current) {
      lowBalanceModalShownRef.current = true;
      setLowBalanceModalVisible(true);
    }
  }, [
    haptics,
    lowBalanceCritical,
    lowBalanceWarningActive,
    reducedMotionEnabled,
  ]);

  useEffect(() => {
    if (remainingBalancePaise > 0) {
      zeroBalanceHandledRef.current = false;
      return;
    }

    if (
      !hasStoredSession ||
      state === 'ended' ||
      state === 'reconnecting' ||
      zeroBalanceHandledRef.current
    ) {
      return;
    }

    zeroBalanceHandledRef.current = true;
    endCall('balance-zero');
  }, [endCall, hasStoredSession, remainingBalancePaise, state]);

  const clearVideoUpgradeAsyncHandles = useCallback((reason: string) => {
    if (videoUpgradePollTimeoutRef.current !== null) {
      clearTimeout(videoUpgradePollTimeoutRef.current);
      videoUpgradePollTimeoutRef.current = null;
    }

    videoUpgradeControllerRef.current?.abort(new Error(reason));
    videoUpgradeControllerRef.current = null;
    acceptedVideoUpgradeRef.current = null;
  }, []);

  const cancelPendingVideoUpgrade = useCallback(
    async (reason: string) => {
      clearVideoUpgradeAsyncHandles(reason);

      await activeCallSessionAdapter
        .cancelVideoUpgradeRequest({
          session,
        })
        .catch(() => undefined);
    },
    [clearVideoUpgradeAsyncHandles, session],
  );

  const continueVoiceFromUpgrade = useCallback(
    (nextPhase: VideoUpgradePhase) => {
      if (activeStateRef.current === 'video-requested') {
        transitionActive('cancel-video-request');
      } else if (activeStateRef.current === 'video-rejected') {
        transitionActive('continue-voice');
      }

      setVideoUpgradePhase(nextPhase);
    },
    [transitionActive],
  );

  const markVideoUpgradeFailure = useCallback(
    (message: string, step: 'connection' | 'request') => {
      clearVideoUpgradeAsyncHandles('video-upgrade-failed');
      if (activeStateRef.current === 'video-requested') {
        transitionActive('cancel-video-request');
      }

      if (activeStateRef.current === 'video-rejected') {
        transitionActive('continue-voice');
      }

      setVideoUpgradePhase((current) =>
        current.kind === 'awaiting-host' || current.kind === 'connecting'
          ? transitionVideoUpgradePhase(current, {
              message,
              step,
              type: 'failed',
            })
          : current,
      );
      haptics.reject();
    },
    [clearVideoUpgradeAsyncHandles, haptics, transitionActive],
  );

  const beginVideoConnection = useCallback(async () => {
    if (
      videoUpgradePhase.kind !== 'countdown' ||
      acceptedVideoUpgradeRef.current === null
    ) {
      return;
    }

    const controller =
      videoUpgradeControllerRef.current ?? new AbortController();
    videoUpgradeControllerRef.current = controller;

    setVideoUpgradePhase((current) =>
      current.kind === 'countdown'
        ? transitionVideoUpgradePhase(current, {
            atMs: readMonotonicNowMs(),
            type: 'connect-started',
          })
        : current,
    );

    try {
      const patch = await activeCallSessionAdapter.activateVideoMode({
        session,
        signal: controller.signal,
        videoUpgrade: acceptedVideoUpgradeRef.current,
      });

      if (isControllerCancelled(controller)) {
        return;
      }

      const nextSession =
        Object.keys(patch).length === 0
          ? session
          : {
              ...session,
              ...patch,
            };

      if (Object.keys(patch).length > 0) {
        updateActiveSession(patch);
      }

      await activeCallSessionAdapter.waitForRemoteVideoConnected({
        session: nextSession,
        signal: controller.signal,
      });

      if (isControllerCancelled(controller)) {
        return;
      }

      clearVideoUpgradeAsyncHandles('video-upgrade-connected');
      setVideoUpgradePhase(initialVideoUpgradePhase);
      transitionActive('accept-video');
      haptics.videoUnlocked();
      router.replace(appRoutes.callVideo.path);
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      markVideoUpgradeFailure(normalizeApiError(error).message, 'connection');
    }
  }, [
    clearVideoUpgradeAsyncHandles,
    haptics,
    markVideoUpgradeFailure,
    router,
    session,
    transitionActive,
    updateActiveSession,
    videoUpgradePhase,
  ]);

  const handleAcceptedVideoUpgrade = useCallback(
    async (
      videoUpgrade: ActiveCallVideoUpgrade,
      controller: AbortController,
    ) => {
      acceptedVideoUpgradeRef.current = videoUpgrade;
      setVideoUpgradePhase((current) =>
        transitionVideoUpgradePhase(current, {
          atMs: readMonotonicNowMs(),
          type: 'host-accepted',
        }),
      );

      try {
        const currentPermission =
          await videoUpgradePermissionAdapter.getCameraPermission();

        if (isControllerCancelled(controller)) {
          return;
        }

        if (currentPermission === 'granted') {
          setVideoUpgradePhase((current) =>
            current.kind === 'camera-check' ||
            current.kind === 'camera-requesting'
              ? transitionVideoUpgradePhase(current, {
                  countdownEndsAtMs:
                    readMonotonicNowMs() +
                    callPreconnectRuntimeConfig.videoCountdownMs,
                  type: 'camera-granted',
                })
              : current,
          );
          return;
        }

        if (currentPermission === 'denied') {
          continueVoiceFromUpgrade({
            kind: 'camera-denied',
            message:
              'Camera access is required before video can start. Open Settings to allow camera, then request video again.',
          });
          return;
        }

        setVideoUpgradePhase((current) =>
          current.kind === 'camera-check'
            ? transitionVideoUpgradePhase(current, {
                type: 'camera-request-started',
              })
            : current,
        );

        const requestedPermission =
          await videoUpgradePermissionAdapter.requestCameraPermission();

        if (isControllerCancelled(controller)) {
          return;
        }

        if (requestedPermission === 'granted') {
          setVideoUpgradePhase((current) =>
            current.kind === 'camera-requesting'
              ? transitionVideoUpgradePhase(current, {
                  countdownEndsAtMs:
                    readMonotonicNowMs() +
                    callPreconnectRuntimeConfig.videoCountdownMs,
                  type: 'camera-granted',
                })
              : current,
          );
          return;
        }

        continueVoiceFromUpgrade({
          kind: 'camera-denied',
          message:
            'Camera permission was denied. The call is staying on voice until camera access is enabled in Settings.',
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        markVideoUpgradeFailure(normalizeApiError(error).message, 'request');
      }
    },
    [continueVoiceFromUpgrade, markVideoUpgradeFailure],
  );

  const pollVideoUpgrade = useCallback(
    async function pollVideoUpgradeInner(controller: AbortController) {
      try {
        const next = await activeCallSessionAdapter.pollVideoUpgrade({
          session,
          signal: controller.signal,
        });

        if (isControllerCancelled(controller)) {
          return;
        }

        if (next.status === 'pending') {
          videoUpgradePollTimeoutRef.current = setTimeout(() => {
            void pollVideoUpgradeInner(controller);
          }, 1_000);
          return;
        }

        if (next.status === 'accepted') {
          await handleAcceptedVideoUpgrade(next, controller);
          return;
        }

        clearVideoUpgradeAsyncHandles('video-upgrade-resolved');

        if (next.status === 'rejected') {
          transitionActive('reject-video');
          setVideoUpgradePhase((current) =>
            current.kind === 'awaiting-host'
              ? transitionVideoUpgradePhase(current, {
                  cooldownEndsAtMs:
                    readMonotonicNowMs() +
                    callPreconnectRuntimeConfig.videoRejectCooldownMs,
                  message:
                    'The host declined this video request. Voice continues and video can be requested again after the cooldown.',
                  type: 'host-rejected',
                })
              : current,
          );
          haptics.reject();
          return;
        }

        markVideoUpgradeFailure(
          next.status === 'timeout'
            ? 'The host did not confirm video in time. Voice continues at the current voice rate.'
            : 'The video request could not be completed. Voice continues at the current voice rate.',
          'request',
        );
      } catch (error: unknown) {
        if (isControllerCancelled(controller)) {
          return;
        }

        markVideoUpgradeFailure(normalizeApiError(error).message, 'request');
      }
    },
    [
      clearVideoUpgradeAsyncHandles,
      handleAcceptedVideoUpgrade,
      haptics,
      markVideoUpgradeFailure,
      session,
      transitionActive,
    ],
  );

  const requestVideoUpgrade = useCallback(() => {
    if (!videoUpgradeReady || videoUpgradePhase.kind !== 'idle') {
      return;
    }

    clearVideoUpgradeAsyncHandles('video-upgrade-restart');
    const controller = new AbortController();
    videoUpgradeControllerRef.current = controller;
    transitionActive('request-video');
    setVideoUpgradePhase((current) =>
      transitionVideoUpgradePhase(current, {
        atMs: readMonotonicNowMs(),
        type: 'request-started',
      }),
    );

    void activeCallSessionAdapter
      .connectSession({ session })
      .then(
        () =>
          activeCallSessionAdapter.getVideoUpgradeRequest(session.id) ??
          activeCallSessionAdapter.ensureVideoUpgradeRequest({
            session,
            signal: controller.signal,
          }),
      )
      .then(async (request) => {
        if (isControllerCancelled(controller)) {
          return;
        }

        if (request.status === 'pending') {
          videoUpgradePollTimeoutRef.current = setTimeout(() => {
            void pollVideoUpgrade(controller);
          }, 1_000);
          return;
        }

        if (request.status === 'accepted') {
          await handleAcceptedVideoUpgrade(request, controller);
          return;
        }

        if (request.status === 'rejected') {
          clearVideoUpgradeAsyncHandles('video-upgrade-rejected');
          transitionActive('reject-video');
          setVideoUpgradePhase((current) =>
            current.kind === 'awaiting-host'
              ? transitionVideoUpgradePhase(current, {
                  cooldownEndsAtMs:
                    readMonotonicNowMs() +
                    callPreconnectRuntimeConfig.videoRejectCooldownMs,
                  message:
                    'The host declined this video request. Voice continues and video can be requested again after the cooldown.',
                  type: 'host-rejected',
                })
              : current,
          );
          haptics.reject();
          return;
        }

        markVideoUpgradeFailure(
          request.status === 'timeout'
            ? 'The host did not confirm video in time. Voice continues at the current voice rate.'
            : 'The video request could not be completed. Voice continues at the current voice rate.',
          'request',
        );
      })
      .catch((error: unknown) => {
        if (isControllerCancelled(controller)) {
          return;
        }

        markVideoUpgradeFailure(normalizeApiError(error).message, 'request');
      });
  }, [
    clearVideoUpgradeAsyncHandles,
    handleAcceptedVideoUpgrade,
    haptics,
    markVideoUpgradeFailure,
    pollVideoUpgrade,
    session,
    transitionActive,
    videoUpgradePhase.kind,
    videoUpgradeReady,
  ]);

  const cancelVideoUpgrade = useCallback(() => {
    setVideoUpgradePhase((current) => {
      if (!canCancelVideoUpgrade(current)) {
        return current;
      }

      return transitionVideoUpgradePhase(current, {
        type: 'cancelled',
      });
    });

    if (activeStateRef.current === 'video-requested') {
      transitionActive('cancel-video-request');
    }

    if (activeStateRef.current === 'video-rejected') {
      transitionActive('continue-voice');
    }

    void cancelPendingVideoUpgrade('video-upgrade-cancelled');
  }, [cancelPendingVideoUpgrade, transitionActive]);

  const dismissVideoUpgradeMessage = useCallback(() => {
    if (videoUpgradePhase.kind === 'camera-denied') {
      setVideoUpgradePhase((current) =>
        current.kind === 'camera-denied'
          ? transitionVideoUpgradePhase(current, {
              type: 'resolved',
            })
          : current,
      );
      return;
    }

    if (videoUpgradePhase.kind === 'failure') {
      setVideoUpgradePhase((current) =>
        current.kind === 'failure'
          ? transitionVideoUpgradePhase(current, {
              type: 'resolved',
            })
          : current,
      );
    }
  }, [videoUpgradePhase.kind]);

  const openVideoCameraSettings = useCallback(() => {
    void videoUpgradePermissionAdapter
      .openSettings()
      .catch((error: unknown) => {
        setControlError(normalizeApiError(error).message);
      });
  }, []);

  const returnToVoice = useCallback(async () => {
    if (state !== 'video') {
      return;
    }

    if (hasStoredSession) {
      setRouteUpdating(true);

      try {
        await activeCallSessionAdapter.downgradeToVoice({ session });
        activeCall.setCameraEnabled(false);
        activeCall.transitionActive('downgrade-to-voice');
        setControlError(null);
      } catch (error: unknown) {
        setControlError(normalizeApiError(error).message);
      } finally {
        setRouteUpdating(false);
      }

      return;
    }

    setSnapshot((current) => ({
      ...current,
      activeControls: {
        ...current.activeControls,
        cameraEnabled: false,
      },
    }));
    transitionActive('downgrade-to-voice');
  }, [activeCall, hasStoredSession, session, state, transitionActive]);

  useEffect(() => {
    activeStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (hasStoredSession) {
      activeCall.syncActiveCall(nowMs);
    }
  }, [activeCall, hasStoredSession, nowMs]);

  useEffect(() => {
    if (!hasStoredSession || activeSnapshot.activeSession === null) {
      return;
    }

    void activeCallSessionAdapter.connectSession({
      session: activeSnapshot.activeSession,
    });
  }, [activeSnapshot.activeSession, hasStoredSession]);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current !== null) {
        clearTimeout(celebrationTimeoutRef.current);
      }

      if (celebrationHapticTimeoutRef.current !== null) {
        clearTimeout(celebrationHapticTimeoutRef.current);
      }

      if (lowBalancePulseTimeoutRef.current !== null) {
        clearTimeout(lowBalancePulseTimeoutRef.current);
      }

      clearVideoUpgradeAsyncHandles('voice-call-unmounted');
    };
  }, [clearVideoUpgradeAsyncHandles]);

  useEffect(() => {
    if (!pendingUnlockCelebration) {
      return;
    }

    const atMs = readMonotonicNowMs();
    const acknowledgeTimeout = setTimeout(() => {
      markVideoUnlockCelebrated(atMs);
    }, 0);
    const showTimeout = reducedMotionEnabled
      ? null
      : setTimeout(() => {
          setUnlockCelebrationVisible(true);
        }, 0);

    haptics.lightImpact();

    if (celebrationHapticTimeoutRef.current !== null) {
      clearTimeout(celebrationHapticTimeoutRef.current);
    }

    celebrationHapticTimeoutRef.current = setTimeout(() => {
      haptics.lightImpact();
      celebrationHapticTimeoutRef.current = null;
    }, 140);

    if (reducedMotionEnabled) {
      const hideImmediatelyTimeout = setTimeout(() => {
        setUnlockCelebrationVisible(false);
      }, 0);

      return () => {
        clearTimeout(acknowledgeTimeout);
        clearTimeout(hideImmediatelyTimeout);

        if (showTimeout !== null) {
          clearTimeout(showTimeout);
        }
      };
    }

    if (celebrationTimeoutRef.current !== null) {
      clearTimeout(celebrationTimeoutRef.current);
    }

    celebrationTimeoutRef.current = setTimeout(() => {
      setUnlockCelebrationVisible(false);
      celebrationTimeoutRef.current = null;
    }, 1_800);

    return () => {
      clearTimeout(acknowledgeTimeout);

      if (showTimeout !== null) {
        clearTimeout(showTimeout);
      }
    };
  }, [
    haptics,
    markVideoUnlockCelebrated,
    pendingUnlockCelebration,
    reducedMotionEnabled,
  ]);

  const finishVideoUpgradeCooldown = useCallback(() => {
    if (activeStateRef.current === 'video-rejected') {
      transitionActive('continue-voice');
    }

    setVideoUpgradePhase((current) =>
      current.kind === 'cooldown'
        ? transitionVideoUpgradePhase(current, {
            type: 'cooldown-finished',
          })
        : current,
    );
  }, [transitionActive]);

  useEffect(() => {
    if (
      videoUpgradePhase.kind !== 'cooldown' ||
      videoUpgradeCooldownRemainingMs > 0
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      finishVideoUpgradeCooldown();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    finishVideoUpgradeCooldown,
    videoUpgradeCooldownRemainingMs,
    videoUpgradePhase.kind,
  ]);

  useEffect(() => {
    if (
      videoUpgradePhase.kind === 'countdown' &&
      videoUpgradeCountdownSeconds === 0
    ) {
      void beginVideoConnection();
    }
  }, [
    beginVideoConnection,
    videoUpgradeCountdownSeconds,
    videoUpgradePhase.kind,
  ]);

  useCameraSessionLifecycle(state === 'video' && controls.cameraEnabled);

  return (
    <CallScreen
      hideControls={topUpSheetOpenedAtMs !== null}
      controls={
        <Animated.View
          layout={layoutTransitions.gentle}
          style={styles.activeControlsWrap}
        >
          <View style={styles.controlsRow}>
            <CallControlButton
              accessibilityHint="Mutes or unmutes your microphone for this call."
              disabled={muteUpdating}
              icon={Mic}
              label="Mute"
              onPress={() => {
                void setMuted(!controls.muted);
              }}
              selected={controls.muted}
              testID="voice-toggle-mute"
            />
            <CallControlButton
              accessibilityHint="Switches call audio between speaker and earpiece."
              disabled={speakerUpdating}
              icon={Volume2}
              label="Speaker"
              onPress={() => {
                void setSpeakerEnabled(!controls.speakerEnabled);
              }}
              selected={controls.speakerEnabled}
              testID="voice-toggle-speaker"
            />
            {state === 'video' ? (
              <CallControlButton
                accessibilityHint="Turns your local camera on or off."
                disabled={cameraUpdating}
                icon={Camera}
                label="Camera"
                onPress={() => {
                  void setCameraEnabled(!controls.cameraEnabled);
                }}
                selected={controls.cameraEnabled}
                testID="voice-toggle-camera"
              />
            ) : null}
            {state === 'video' ? (
              <CallControlButton
                accessibilityHint="Return from video to voice mode."
                disabled={routeUpdating}
                icon={Video}
                label="Voice"
                onPress={() => {
                  void returnToVoice();
                }}
                testID="video-return-voice"
              />
            ) : null}
            <CallControlButton
              accessibilityHint="Open Add Money and return to this call afterward."
              icon={IndianRupee}
              label="Add Money"
              onPress={() => {
                openAddMoneySheet();
              }}
              testID="voice-add-money"
            />
            <CallControlButton
              accessibilityHint="Open the report flow for this active call."
              icon={Flag}
              label="Report"
              onPress={() => {
                openReportSheet();
              }}
              testID="voice-report"
            />
          </View>
          <Button
            accessibilityHint="Ends the active call."
            icon={PhoneOff}
            onPress={() => {
              if (connectedDurationMs >= activeCallEndConfirmationDurationMs) {
                setEndConfirmationVisible(true);
                return;
              }

              endCall();
            }}
            style={styles.endCallButton}
            testID="voice-end-call"
            title="End Call"
            variant="destructive"
          />
        </Animated.View>
      }
      testID="voice-call-screen"
    >
      <LinearGradient
        colors={
          videoExperienceExpanded
            ? [ui.color.call.videoOverlay, ui.color.call.backgroundEnd]
            : [ui.color.call.backgroundStart, ui.color.call.backgroundEnd]
        }
        end={{ x: 0.9, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        layout={layoutTransitions.gentle}
        style={[
          styles.activeCallContent,
          isLandscape ? styles.activeCallContentLandscape : null,
        ]}
      >
        <Animated.View
          layout={layoutTransitions.gentle}
          style={styles.activeCallHero}
        >
          <View style={styles.activeCallHeader}>
            <Text accessibilityRole="header" style={styles.activeCallHostName}>
              {session.hostName}
            </Text>
            <Text style={styles.activeCallConnectedTime}>
              {formatActiveCallDuration(connectedDurationMs)}
            </Text>
          </View>

          <View style={styles.activeCallVisualWrap}>
            {remoteSurfaceVisible ? (
              <Animated.View
                layout={layoutTransitions.gentle}
                style={[
                  styles.activeCallRemoteSurface,
                  videoExperienceExpanded
                    ? styles.activeCallRemoteSurfaceExpanded
                    : null,
                ]}
              >
                <Animated.View style={remoteSurfaceFadeStyle}>
                  <View
                    style={styles.activeCallRemoteStatus}
                    testID="active-call-remote-video"
                  >
                    <StatusBadge
                      label={
                        state === 'video'
                          ? 'Remote video connected'
                          : 'Joining remote video'
                      }
                      tone={state === 'video' ? 'success' : 'warning'}
                    />
                  </View>
                </Animated.View>
                <CallAvatar
                  label={session.hostName}
                  size={videoExperienceExpanded ? 188 : 164}
                  sourceUri={hostProfileImageUri}
                  testID="active-call-avatar"
                  variant="host"
                />
              </Animated.View>
            ) : (
              <View style={styles.activeCallAvatarStage}>
                <View style={styles.activeCallPortraitHalo} />
                <CallAvatar
                  label={session.hostName}
                  size={144}
                  sourceUri={hostProfileImageUri}
                  testID="active-call-avatar"
                  variant="host"
                />
              </View>
            )}
            {selfPreviewVisible ? (
              <Animated.View
                layout={layoutTransitions.gentle}
                style={[styles.activeCallSelfPreview, selfPreviewFadeStyle]}
                testID="active-call-self-preview"
              >
                <Text style={styles.activeMetricLabel}>Self preview</Text>
                <Text style={styles.videoPassTitle}>
                  {controls.cameraEnabled ? 'Camera ready' : 'Camera off'}
                </Text>
              </Animated.View>
            ) : null}
            {unlockCelebrationVisible ? (
              <View style={styles.activeCallUnlockCelebration}>
                <LottieIllustration
                  assetId="connectoPulse"
                  fallback={
                    <View style={styles.activeCallUnlockFallback}>
                      <Sparkles color={ui.color.status.success} size={28} />
                    </View>
                  }
                  fallbackLabel="Video unlocked"
                  style={styles.activeCallUnlockAnimation}
                  testID="active-call-unlock"
                />
              </View>
            ) : null}
          </View>

          {state !== 'video' ? (
            <VoiceWaveform
              active={state !== 'reconnecting' && state !== 'ended'}
              samples={waveformSamples}
              style={styles.activeCallWaveform}
              testID="active-call-waveform"
            />
          ) : null}
        </Animated.View>

        <Animated.View
          layout={layoutTransitions.gentle}
          style={styles.activeCallDetails}
        >
          <VideoUnlockPriorityCard
            hostName={session.hostName}
            onRequestVideo={() => {
              requestVideoUpgrade();
            }}
            remainingUnlockMs={remainingUnlockMs}
            state={state}
            videoRateLabel={videoRateLabel}
            videoUnlockProgress={videoUnlockProgress}
            videoUpgradeCooldownRemainingMs={videoUpgradeCooldownRemainingMs}
            videoUpgradePhase={videoUpgradePhase}
            videoUpgradeReady={videoUpgradeReady}
            voiceRateLabel={voiceRateLabel}
          />

          <View
            style={[
              styles.activeCallMetricsGrid,
              isLandscape ? styles.activeCallMetricsGridLandscape : null,
            ]}
          >
            <Card style={styles.activeMetricCard} variant="strong">
              <Text style={styles.activeMetricLabel}>Network quality</Text>
              <View style={styles.activeMetricRow}>
                <View style={styles.activeMetricCopy}>
                  <Text style={styles.activeMetricValueCompact}>
                    {networkQuality.label}
                  </Text>
                  <Text style={styles.activeMetricHint}>
                    Signal {String(networkQuality.score)} of 5
                  </Text>
                </View>
                <NetworkQualityMiniGraph
                  qualityScore={networkQuality.score}
                  samples={networkQuality.samples}
                  testID="active-call-network"
                />
              </View>
            </Card>
          </View>

          {walletQuery.data === undefined ? null : (
            <Card style={styles.activeWalletCard} variant="strong">
              <View style={styles.activeWalletHeader}>
                <Text style={styles.activeMetricLabel}>Wallet</Text>
                <StatusBadge
                  label={trustStageLabel[trustRingStage]}
                  tone={
                    trustRingStage === 'ready'
                      ? 'success'
                      : trustRingStage === 'steady'
                        ? 'info'
                        : 'warning'
                  }
                />
              </View>
              <View
                style={[
                  styles.activeCallMetricsGrid,
                  styles.activeWalletMetricsGrid,
                ]}
              >
                <View style={styles.activeMetricCopy}>
                  <Text style={styles.activeMetricValueCompact}>
                    {formatMoney(walletQuery.data.balance)}
                  </Text>
                  <Text style={styles.activeMetricHint}>Wallet balance</Text>
                </View>
                <View style={styles.activeMetricCopy}>
                  <Text style={styles.activeMetricValueCompact}>
                    {formatActiveCallDuration(estimatedRemainingTimeMs)}
                  </Text>
                  <Text style={styles.activeMetricHint}>
                    Estimated remaining time at current rate
                  </Text>
                </View>
              </View>
              <Text style={styles.activeWalletFootnote}>
                Estimated available balance after this call:{' '}
                {formatMoney({
                  amountPaise: remainingBalancePaise,
                  currency: session.voiceRate.currency,
                })}
              </Text>
            </Card>
          )}

          {lowBalanceWarningActive ? (
            <LowBalanceNoticeCard
              currentRateLabel={`${currentRateLabel}/min`}
              estimatedRemainingTimeLabel={estimatedRemainingTimeLabel}
              onAddMoney={openAddMoneySheet}
              pulse={lowBalancePulseVisible}
              remainingBalanceLabel={remainingBalanceLabel}
              testID="voice-low-balance-card"
            />
          ) : null}

          {state === 'video' && !cameraUsesReliableHaptics ? (
            <Banner
              message="Nonessential haptics are suppressed while the camera session is active on this platform."
              title="Camera haptics policy"
              tone="warning"
            />
          ) : null}

          {callNotice === null ? null : (
            <Banner
              message={callNotice.message}
              title={callNotice.title}
              tone={callNotice.tone}
            />
          )}

          {controlError !== null ? (
            <Banner
              message={controlError}
              title="Call controls unavailable"
              tone="warning"
            />
          ) : null}

          {hasStoredSession && liveTelemetry?.mediaResourceReady === false ? (
            <Banner
              message="Voice resources are reconnecting. Call controls will recover automatically as soon as the media bridge reports ready."
              title="Restoring audio route"
              tone="warning"
            />
          ) : null}

          {videoUpgradePhase.kind === 'awaiting-host' ? (
            <Card style={styles.activeVideoUpgradeStage}>
              <Text style={styles.activeMetricLabel}>Waiting for host</Text>
              <Text style={styles.activeMetricHint}>
                Video will switch to {videoRateLabel}/min only after the host
                accepts and remote video connects. Voice stays live while this
                request is pending.
              </Text>
              <ActionWrap>
                <Button
                  onPress={() => {
                    cancelVideoUpgrade();
                  }}
                  testID="video-upgrade-cancel"
                  title="Cancel request"
                  variant="secondary"
                />
              </ActionWrap>
            </Card>
          ) : null}

          {videoUpgradePhase.kind === 'camera-check' ||
          videoUpgradePhase.kind === 'camera-requesting' ? (
            <Card style={styles.activeVideoUpgradeStage}>
              <Text style={styles.activeMetricLabel}>Camera permission</Text>
              <Text style={styles.activeMetricHint}>
                The host accepted. Camera access is being checked now so the
                upgrade can continue without another confirmation step.
              </Text>
              <ActionWrap>
                <Button
                  onPress={() => {
                    cancelVideoUpgrade();
                  }}
                  testID="video-upgrade-cancel"
                  title="Stay on voice"
                  variant="secondary"
                />
              </ActionWrap>
            </Card>
          ) : null}

          {videoUpgradePhase.kind === 'camera-denied' ? (
            <Card style={styles.activeVideoUpgradeStage}>
              <Banner
                message={videoUpgradePhase.message}
                title="Camera access needed"
                tone="warning"
              />
              <ActionWrap>
                <Button
                  onPress={() => {
                    openVideoCameraSettings();
                  }}
                  testID="video-upgrade-settings"
                  title="Open Settings"
                  variant="secondary"
                />
                <Button
                  onPress={() => {
                    dismissVideoUpgradeMessage();
                  }}
                  testID="video-upgrade-dismiss"
                  title="Continue on voice"
                />
              </ActionWrap>
            </Card>
          ) : null}

          {videoUpgradePhase.kind === 'countdown' ? (
            <Card style={styles.activeVideoUpgradeStage}>
              <Text style={styles.activeMetricLabel}>Video starting</Text>
              <Text style={styles.activeCallCountdown}>
                {String(videoUpgradeCountdownSeconds)}
              </Text>
              <Text style={styles.activeMetricHint}>
                Countdown can be skipped or cancelled until connection begins.
              </Text>
              <ActionWrap>
                <Button
                  onPress={() => {
                    void beginVideoConnection();
                  }}
                  testID="video-upgrade-skip"
                  title="Skip countdown"
                  variant="secondary"
                />
                <Button
                  onPress={() => {
                    cancelVideoUpgrade();
                  }}
                  testID="video-upgrade-cancel"
                  title="Continue on voice"
                />
              </ActionWrap>
            </Card>
          ) : null}

          {videoUpgradePhase.kind === 'connecting' ? (
            <Card style={styles.activeVideoUpgradeStage}>
              <Text style={styles.activeMetricLabel}>Connecting video</Text>
              <Text style={styles.activeMetricHint}>
                Remote video is connecting now. Voice pricing remains active
                until the connection is confirmed.
              </Text>
            </Card>
          ) : null}

          {videoUpgradePhase.kind === 'failure' ? (
            <Card style={styles.activeVideoUpgradeStage}>
              <Banner
                message={videoUpgradePhase.message}
                title={
                  videoUpgradePhase.step === 'connection'
                    ? 'Video connection failed'
                    : 'Video request failed'
                }
                tone="warning"
              />
              <ActionWrap>
                <Button
                  onPress={() => {
                    dismissVideoUpgradeMessage();
                  }}
                  testID="video-upgrade-dismiss"
                  title="Continue on voice"
                />
              </ActionWrap>
            </Card>
          ) : null}

          {videoUpgradePhase.kind === 'cooldown' ? (
            <Banner
              message={`${videoUpgradePhase.message} Cooldown remaining ${formatVideoUpgradeTimerLabel(
                Math.ceil(videoUpgradeCooldownRemainingMs / 1_000),
              )}.`}
              title="Video request cooldown"
              tone="warning"
            />
          ) : null}

          {state === 'reconnecting' ? (
            <Banner
              message="Connected billing time is paused until the call is restored."
              title="Reconnecting"
              tone="warning"
            />
          ) : null}

          <ActionWrap>
            <Button
              icon={RefreshCw}
              onPress={() => {
                transitionActive('connection-lost');
              }}
              testID="voice-connection-lost"
              title="Simulate reconnecting"
              variant="secondary"
            />
          </ActionWrap>
        </Animated.View>
      </Animated.View>
      <ConfirmationDialog
        confirmLabel="Add Money"
        message={`Only ${estimatedRemainingTimeLabel} remains at ${currentRateLabel}/min. Open the top-up flow now and return to the active call without exposing any payment details on this screen.`}
        onCancel={() => {
          setLowBalanceModalVisible(false);
        }}
        onConfirm={() => {
          setLowBalanceModalVisible(false);
          openAddMoneySheet();
        }}
        title="Balance running low"
        visible={lowBalanceModalVisible}
      />
      <BottomSheetWrapper
        onDismiss={() => undefined}
        ref={reportSheetRef}
        snapPoints={['84%']}
      >
        <CallReportComposer
          context={{
            callId: session.callId,
            connectedDurationMs,
            customerId: session.customerId,
            hostId: session.hostId,
            hostName: session.hostName,
            mediaMode: state === 'video' ? 'video' : 'voice',
            remainingBalancePaise,
            sessionId: session.id,
          }}
          onCancel={closeReportSheet}
          onSubmitted={handleReportSubmitted}
          showSubmitAndEnd
        />
      </BottomSheetWrapper>
      <AddMoneyDuringCallSheet
        currentRateLabel={`${currentRateLabel}/min`}
        graceRemainingLabel={formatCallSafetyDuration(topUpGraceRemainingMs)}
        onDismiss={handleAddMoneySheetDismiss}
        onClose={closeAddMoneySheet}
        onContinue={continueToAddMoneyFlow}
        onSelectAmount={setSelectedTopUpAmount}
        selectedAmount={selectedTopUpAmount}
        sheetRef={addMoneySheetRef}
      />
      <ConfirmationDialog
        confirmLabel="End Call"
        destructive
        message="This call has already been connected. End it now only if you're ready to disconnect immediately."
        onCancel={() => {
          setEndConfirmationVisible(false);
        }}
        onConfirm={() => {
          setEndConfirmationVisible(false);
          endCall();
        }}
        title="End this call?"
        visible={endConfirmationVisible}
      />
    </CallScreen>
  );
}

export function VideoRequestScreen() {
  return <VoiceCallScreen />;
}

export function ReconnectingCallScreen() {
  const haptics = useHaptics();
  const router = useRouter();
  const activeCall = useActiveCallStore();
  const hasStoredSession = activeCall.activeCallId !== null;
  const nowMs = useActiveCallTicker({
    clock: defaultActiveCallClock,
  });
  const timeoutHandledRef = useRef(false);
  const reconnectRemainingMs = getReconnectRemainingMs(
    activeCall.activeRuntime?.reconnectStartedAtMs ?? null,
    nowMs,
  );
  const reconnectTargetLabel =
    activeCall.activeRuntime?.reconnectTarget === 'video' ? 'video' : 'voice';

  useCameraSessionLifecycle(false);

  useEffect(() => {
    haptics.warning();
  }, [haptics]);

  useEffect(() => {
    if (
      !hasStoredSession ||
      activeCall.activeSession === null ||
      activeCall.activeState === 'ended' ||
      reconnectRemainingMs > 0 ||
      timeoutHandledRef.current
    ) {
      return;
    }

    timeoutHandledRef.current = true;
    activeCall.transitionActive('end');
    const summaryRoute = buildReconnectSummaryRoute({
      activeCall,
      nowMs,
      reason: 'reconnect-timeout',
    });

    if (
      summaryRoute.params.callId !== undefined &&
      summaryRoute.params.hostId !== undefined &&
      summaryRoute.params.hostName !== undefined
    ) {
      void prePersistPostCallRecord({
        callId: summaryRoute.params.callId,
        connectedDurationMs: summaryRoute.params.connectedDurationMs,
        endedAtIso: summaryRoute.params.endedAtIso,
        hostId: summaryRoute.params.hostId,
        hostName: summaryRoute.params.hostName,
        mediaMode: summaryRoute.params.mediaMode,
        reason: summaryRoute.params.reason,
        remainingBalancePaise: summaryRoute.params.remainingBalancePaise,
        sessionId: summaryRoute.params.sessionId,
        videoDurationMs: summaryRoute.params.videoDurationMs,
      }).catch(() => undefined);
    }

    void endStoredActiveCall().finally(() => {
      router.replace(summaryRoute);
    });
  }, [activeCall, hasStoredSession, nowMs, reconnectRemainingMs, router]);

  return (
    <CallScreen testID="reconnecting-call-screen">
      <View style={styles.screenContent}>
        <StageCard
          body={activeCopy.reconnecting.body}
          pulsing
          state="reconnecting"
          title={activeCopy.reconnecting.title}
          tone="warning"
        />
        <Card style={styles.reconnectCard}>
          <Text style={styles.activeMetricLabel}>Reconnect window</Text>
          <Text style={styles.reconnectCountdown}>
            {formatCallSafetyDuration(reconnectRemainingMs)}
          </Text>
          <Text style={styles.activeMetricHint}>
            Billing stays paused while the media bridge restores the previous{' '}
            {reconnectTargetLabel} state. If recovery does not complete in 30
            seconds, the call ends without charging disconnected time.
          </Text>
        </Card>

        <ActionWrap>
          <Button
            onPress={() => {
              if (hasStoredSession) {
                activeCall.restoreActiveConnection();
                router.replace(
                  activeRouteForState(
                    useActiveCallStore.getState().activeState,
                  ),
                );
                return;
              }

              router.replace(appRoutes.callVoice.path);
            }}
            testID="reconnecting-restore"
            title="Restore call"
          />
          <Button
            onPress={() => {
              if (hasStoredSession && activeCall.activeState !== 'ended') {
                activeCall.transitionActive('end');
              }

              const summaryRoute = buildReconnectSummaryRoute({
                activeCall,
                nowMs,
                reason: 'manual',
              });

              if (
                summaryRoute.params.callId !== undefined &&
                summaryRoute.params.hostId !== undefined &&
                summaryRoute.params.hostName !== undefined
              ) {
                void prePersistPostCallRecord({
                  callId: summaryRoute.params.callId,
                  connectedDurationMs: summaryRoute.params.connectedDurationMs,
                  endedAtIso: summaryRoute.params.endedAtIso,
                  hostId: summaryRoute.params.hostId,
                  hostName: summaryRoute.params.hostName,
                  mediaMode: summaryRoute.params.mediaMode,
                  reason: summaryRoute.params.reason,
                  remainingBalancePaise:
                    summaryRoute.params.remainingBalancePaise,
                  sessionId: summaryRoute.params.sessionId,
                  videoDurationMs: summaryRoute.params.videoDurationMs,
                }).catch(() => undefined);
              }

              void endStoredActiveCall().finally(() => {
                router.replace(summaryRoute);
              });
            }}
            testID="reconnecting-end"
            title="End call"
            variant="destructive"
          />
        </ActionWrap>
      </View>
    </CallScreen>
  );
}

export function CallSummaryScreen() {
  useCameraSessionLifecycle(false);
  return <PostCallSummaryScreen />;
}

const styles = StyleSheet.create({
  activeCallAvatarWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.9)',
    borderColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    borderWidth: 3,
    height: 88,
    justifyContent: 'center',
    overflow: 'visible',
    padding: 5,
    position: 'absolute',
    width: 88,
  },
  activeCallContent: {
    flex: 1,
    gap: ui.spacing[3],
    justifyContent: 'space-between',
    padding: ui.spacing[3],
  },
  activeCallContentLandscape: {
    gap: ui.spacing[4],
  },
  activeCallDetails: {
    gap: ui.spacing[3],
  },
  activeCallAvatarStage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 164,
    minWidth: 164,
  },
  activeCallConnectedTime: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  activeCallHeader: {
    alignItems: 'center',
    gap: ui.spacing[1],
  },
  activeCallHero: {
    alignItems: 'center',
    gap: ui.spacing[3],
  },
  activeCallCountdown: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    lineHeight: 62,
    textAlign: 'center',
  },
  activeCallHostName: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
    textAlign: 'center',
  },
  activeCallMeta: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    opacity: 0.82,
    textAlign: 'center',
  },
  activeCallPortraitHalo: {
    backgroundColor: 'rgba(255, 253, 248, 0.22)',
    borderColor: 'rgba(255, 253, 248, 0.38)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 152,
    position: 'absolute',
    width: 152,
  },
  activeCallMetricsGrid: {
    gap: ui.spacing[3],
  },
  activeCallMetricsGridLandscape: {
    flexDirection: 'row',
  },
  activeCallRemoteStatus: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: ui.spacing[4],
  },
  activeCallRemoteSurface: {
    alignItems: 'center',
    backgroundColor: ui.color.call.videoOverlay,
    borderColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.xl,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 220,
    paddingHorizontal: ui.spacing[5],
    paddingVertical: ui.spacing[6],
    width: '100%',
  },
  activeCallRemoteSurfaceExpanded: {
    minHeight: 288,
  },
  activeCallSelfPreview: {
    backgroundColor: ui.color.background.surface,
    borderColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.lg,
    borderWidth: 1,
    bottom: ui.spacing[3],
    minWidth: 132,
    padding: ui.spacing[3],
    position: 'absolute',
    right: ui.spacing[3],
  },
  activeCallTrustRing: {
    position: 'absolute',
  },
  activeCallUnlockAnimation: {
    minHeight: 72,
    minWidth: 72,
  },
  activeCallUnlockCelebration: {
    position: 'absolute',
    right: -4,
    top: 12,
  },
  activeCallUnlockFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCallVideoNote: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    opacity: 0.94,
    textAlign: 'center',
  },
  activeCallVisualWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 164,
    minWidth: 164,
    width: '100%',
  },
  activeCallWaveform: {
    alignSelf: 'center',
  },
  activeControlsWrap: {
    gap: ui.spacing[2],
  },
  activeMetricCard: {
    flex: 1,
    gap: ui.spacing[2],
  },
  activeMetricCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  activeMetricHint: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  activeMetricLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    textTransform: 'uppercase',
  },
  activeMetricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  activeMetricValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.headline.lineHeight,
  },
  activeMetricValueCompact: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.title.lineHeight,
  },
  activeVideoUpgradeStage: {
    gap: ui.spacing[3],
  },
  activeWalletCard: {
    gap: ui.spacing[3],
  },
  activeWalletFootnote: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  activeWalletHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  activeWalletMetricsGrid: {
    flexDirection: 'row',
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  alternativeCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  alternativeName: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  alternativeRow: {
    alignItems: 'center',
    backgroundColor: ui.color.background.surface,
    borderRadius: ui.radii.lg,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 64,
    padding: ui.spacing[3],
  },
  alternativeStack: {
    alignSelf: 'stretch',
    gap: ui.spacing[3],
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  callAvatarFrame: {
    alignItems: 'center',
    backgroundColor: ui.color.background.surface,
    borderColor: 'rgba(255, 253, 248, 0.88)',
    borderWidth: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  callAvatarImage: {
    height: '100%',
    width: '100%',
  },
  cardEyebrow: {
    color: ui.color.status.warning,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    textTransform: 'uppercase',
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
    justifyContent: 'center',
  },
  endCallButton: {
    alignSelf: 'stretch',
  },
  outgoingBrandBlock: {
    alignItems: 'center',
    gap: ui.spacing[2],
  },
  outgoingCallingAnimation: {
    height: 148,
    width: 148,
  },
  outgoingHeadphones: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
    justifyContent: 'center',
    paddingHorizontal: ui.spacing[3],
  },
  outgoingHeadphonesText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  outgoingLogo: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: 40,
    lineHeight: 46,
    textAlign: 'center',
  },
  outgoingName: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  outgoingParticipant: {
    alignItems: 'center',
    gap: ui.spacing[3],
  },
  outgoingReplica: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    gap: ui.spacing[4],
    justifyContent: 'center',
    paddingBottom: ui.spacing[8],
  },
  outgoingStatus: {
    color: ui.color.status.success,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  preconnectActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
    justifyContent: 'center',
  },
  preconnectBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  preconnectCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: ui.spacing[4],
  },
  preconnectContent: {
    alignItems: 'center',
    flex: 1,
    gap: ui.spacing[5],
    justifyContent: 'center',
    paddingHorizontal: ui.spacing[4],
  },
  preconnectError: {
    color: ui.color.status.error,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
  preconnectEyebrow: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'uppercase',
  },
  preconnectHeader: {
    alignItems: 'center',
    gap: ui.spacing[2],
  },
  preconnectHostMeta: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    opacity: 0.88,
    textAlign: 'center',
  },
  preconnectHostName: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
    textAlign: 'center',
  },
  preconnectIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  preconnectMuted: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
  preconnectMutedInverse: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    opacity: 0.76,
    textAlign: 'center',
  },
  preconnectSafeArea: {
    backgroundColor: ui.color.call.backgroundEnd,
  },
  preconnectTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  preconnectVideoNote: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    opacity: 0.94,
    textAlign: 'center',
  },
  videoUnlockBody: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    opacity: 0.9,
  },
  videoUnlockCard: {
    borderColor: 'rgba(255, 253, 248, 0.24)',
    borderRadius: ui.radii.xxl,
    borderWidth: 1,
    gap: ui.spacing[3],
    overflow: 'hidden',
    padding: ui.spacing[4],
  },
  videoUnlockCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  videoUnlockEyebrow: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    opacity: 0.82,
    textTransform: 'uppercase',
  },
  videoUnlockFill: {
    backgroundColor: ui.color.text.inverse,
    borderRadius: ui.radii.full,
  },
  videoUnlockGlow: {
    backgroundColor: 'rgba(255, 253, 248, 0.16)',
    borderRadius: 120,
    height: 180,
    position: 'absolute',
    right: -70,
    top: -74,
    width: 180,
  },
  videoUnlockIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.18)',
    borderColor: 'rgba(255, 253, 248, 0.28)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  videoUnlockPercent: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.16)',
    borderRadius: ui.radii.lg,
    minWidth: 62,
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[2],
  },
  videoUnlockPercentLabel: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    opacity: 0.78,
  },
  videoUnlockPercentValue: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.title.lineHeight,
  },
  videoUnlockStep: {
    backgroundColor: 'rgba(255, 253, 248, 0.12)',
    borderRadius: ui.radii.md,
    flex: 1,
    gap: ui.spacing[1],
    minWidth: 88,
    padding: ui.spacing[2],
  },
  videoUnlockStepActive: {
    backgroundColor: 'rgba(255, 253, 248, 0.22)',
    borderRadius: ui.radii.md,
    flex: 1,
    gap: ui.spacing[1],
    minWidth: 88,
    padding: ui.spacing[2],
  },
  videoUnlockStepBody: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    opacity: 0.8,
  },
  videoUnlockSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  videoUnlockStepTitle: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  videoUnlockTitle: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  videoUnlockTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  videoUnlockTrack: {
    backgroundColor: 'rgba(255, 253, 248, 0.2)',
    borderRadius: ui.radii.full,
    flexDirection: 'row',
    height: 12,
    overflow: 'hidden',
  },
  videoPassTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  previewCard: {
    gap: ui.spacing[3],
  },
  reconnectCard: {
    gap: ui.spacing[3],
  },
  reconnectCountdown: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    lineHeight: 50,
    textAlign: 'center',
  },
  screenContent: {
    flex: 1,
    gap: ui.spacing[5],
    justifyContent: 'center',
    padding: ui.spacing[4],
  },
  stageCard: {
    gap: ui.spacing[3],
  },
  stageCopy: {
    flex: 1,
    gap: ui.spacing[2],
  },
  stageHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  stageTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  summaryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  summaryContent: {
    gap: ui.spacing[5],
    paddingBottom: ui.spacing[8],
  },
  summaryHero: {
    gap: ui.spacing[3],
    marginTop: ui.spacing[4],
  },
  summaryNote: {
    gap: ui.spacing[3],
  },
  summaryNoteHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
  },
});
