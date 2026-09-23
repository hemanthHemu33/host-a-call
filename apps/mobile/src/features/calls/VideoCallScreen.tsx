import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  AlertTriangle,
  Camera,
  Flag,
  IndianRupee,
  Mic,
  RefreshCw,
  Video,
  Volume2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CameraView } from 'expo-camera';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AppState,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { normalizeApiError } from '@connecto/domain';

import { ConversationOrb } from '@/components/animations/ConversationOrb';
import { CallScreen, useResponsiveLayout } from '@/components/layout';
import { BottomSheetWrapper } from '@/components/ui';
import { Button, CallControlButton } from '@/components/ui/controls';
import { Banner, ConfirmationDialog } from '@/components/ui/feedback';
import {
  Avatar,
  Card,
  EmptyState,
  Skeleton,
  StatusBadge,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { formatMoney, useWalletQuery } from '@/features/data/mobileDataHooks';
import { appRoutes } from '@/navigation/routes';
import {
  layoutTransitions,
  useFadeStyle,
  useHaptics,
  useMotion,
  useSlideStyle,
} from '@/motion';
import {
  activeCallEndConfirmationDurationMs,
  getActiveCallConnectedDurationMs,
  getActiveCallVideoDurationMs,
  useActiveCallStore,
} from '@/store/call.store';

import {
  ActiveCallRemoteVideoSurface,
  activeCallMediaBridge,
  activeCallSessionAdapter,
  useActiveCallSessionTelemetry,
} from './active-call.adapter';
import {
  defaultActiveCallClock,
  deriveNetworkQualityModel,
  estimateRemainingBalancePaise,
  estimateRemainingTimeMs,
  formatActiveCallDuration,
  useActiveCallTicker,
} from './active-call';
import { CallReportComposer } from './CallReportComposer';
import {
  AddMoneyDuringCallSheet,
  LowBalanceNoticeCard,
} from './CallSafetyPanels';
import {
  callSafetyRuntimeConfig,
  createCallSummaryRouteParams,
  formatCallSafetyDuration,
  type CallSummaryEndReason,
} from './call-safety';
import { prePersistPostCallRecord } from '@/features/post-call/PostCallScreens';
import {
  defaultVideoPreviewPosition,
  formatVideoDisconnectGraceLabel,
  normalizeVideoPreviewPosition,
  resolveVideoPreviewBounds,
  videoControlAutoHideDelayMs,
  videoRemoteDisconnectGraceMs,
  type VideoPreviewPosition,
} from './video-call';
import { callPreconnectAdapter, callSessionAdapter } from './call.preconnect';
import { useVideoPreviewDragController } from './video-preview.hook';

const previewPadding = ui.spacing[4];
const sessionDowngradeLocks = new Set<string>();

const toneForNetworkQuality = (
  quality: ReturnType<typeof deriveNetworkQualityModel>['quality'],
) =>
  quality === 'excellent' ? 'success' : quality === 'good' ? 'info' : 'warning';

const useCameraSessionLifecycle = (active: boolean) => {
  const { setCameraSessionActive } = useMotion();

  useEffect(() => {
    setCameraSessionActive(active);

    return () => {
      setCameraSessionActive(false);
    };
  }, [active, setCameraSessionActive]);
};

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function OverlayCard({ children }: { children: ReactNode }) {
  return <Card style={styles.overlayCard}>{children}</Card>;
}

type SurfaceLayout = {
  height: number;
  width: number;
};

export function VideoCallScreen() {
  const activeCall = useActiveCallStore();
  const router = useRouter();
  const haptics = useHaptics();
  const { cameraUsesReliableHaptics, reducedMotionEnabled } = useMotion();
  const { isLandscape } = useResponsiveLayout();
  const nowMs = useActiveCallTicker({
    clock: defaultActiveCallClock,
  });
  const session = activeCall.activeSession;
  const state = activeCall.activeState;
  const controls = activeCall.activeControls;
  const runtime = activeCall.activeRuntime;
  const sessionId = session?.id ?? null;
  const walletQuery = useWalletQuery();
  const telemetry = useActiveCallSessionTelemetry({
    activeState: state ?? 'voice',
    enabled: session !== null,
    session,
  });
  const [surfaceLayout, setSurfaceLayout] = useState<SurfaceLayout>({
    height: 0,
    width: 0,
  });
  const [callNotice, setCallNotice] = useState<{
    message: string;
    title: string;
    tone: 'error' | 'info' | 'success' | 'warning';
  } | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [cameraSurfaceError, setCameraSurfaceError] = useState<string | null>(
    null,
  );
  const [cameraUpdating, setCameraUpdating] = useState(false);
  const [lowBalanceModalVisible, setLowBalanceModalVisible] = useState(false);
  const [lowBalancePulseVisible, setLowBalancePulseVisible] = useState(false);
  const [muteUpdating, setMuteUpdating] = useState(false);
  const [routeUpdating, setRouteUpdating] = useState(false);
  const [selectedTopUpAmount, setSelectedTopUpAmount] = useState<number>(250);
  const [speakerUpdating, setSpeakerUpdating] = useState(false);
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [endConfirmationVisible, setEndConfirmationVisible] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsPinned, setControlsPinned] = useState(false);
  const [returnSheetVisible, setReturnSheetVisible] = useState(false);
  const [cameraPausedNoticeVisible, setCameraPausedNoticeVisible] =
    useState(false);
  const [remoteDisconnectStartedAtMs, setRemoteDisconnectStartedAtMs] =
    useState<number | null>(null);
  const [topUpSheetOpenedAtMs, setTopUpSheetOpenedAtMs] = useState<
    number | null
  >(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lowBalancePulseStartTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lowBalancePulseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lowBalanceModalShownRef = useRef(false);
  const lowBalanceWarningHandledRef = useRef(false);
  const remoteFallbackInFlightRef = useRef(false);
  const reconnectRouteHandledRef = useRef(false);
  const voiceDowngradeInFlightRef = useRef(false);
  const zeroBalanceHandledRef = useRef(false);
  const callSummarySnapshotRef = useRef({
    connectedDurationMs: 0,
    remainingBalancePaise: 0,
    videoDurationMs: 0,
  });
  const addMoneySheetRef = useRef<BottomSheetModal>(null);
  const reportSheetRef = useRef<BottomSheetModal>(null);
  const returnSheetRef = useRef<BottomSheetModal>(null);

  const connectedDurationMs = getActiveCallConnectedDurationMs(
    activeCall,
    nowMs,
  );
  const videoDurationMs = getActiveCallVideoDurationMs(activeCall, nowMs);
  const networkQuality = deriveNetworkQualityModel({
    activeState: state ?? 'ended',
    connectedDurationMs,
    nowMs,
    qualityOverride: telemetry?.networkQuality,
  });
  const currentRatePaise = session?.videoRate.amountPaise ?? 0;
  const remainingBalancePaise = estimateRemainingBalancePaise({
    balancePaise: walletQuery.data?.balance.amountPaise ?? 0,
    connectedDurationMs,
    videoDurationMs,
    videoRatePaise: session?.videoRate.amountPaise ?? 0,
    voiceRatePaise: session?.voiceRate.amountPaise ?? 0,
  });
  const estimatedRemainingTimeMs = estimateRemainingTimeMs(
    remainingBalancePaise,
    currentRatePaise,
  );
  const estimatedRemainingTimeLabel = formatActiveCallDuration(
    estimatedRemainingTimeMs,
  );
  const lowBalanceWarningActive =
    state === 'video' &&
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
  const currentPriceLabel =
    session === null ? 'Unavailable' : `${formatMoney(session.videoRate)}/min`;
  const voicePriceLabel =
    session === null ? 'Unavailable' : `${formatMoney(session.voiceRate)}/min`;
  const effectiveCameraEnabled =
    telemetry?.cameraEnabled ?? controls.cameraEnabled;
  const effectiveCameraFacing =
    telemetry?.cameraFacing ?? controls.cameraFacing;
  const remoteCameraEnabled = telemetry?.remoteCameraEnabled ?? true;
  const remoteVideoConnected =
    telemetry === null
      ? true
      : telemetry.remoteVideoConnected && telemetry.mediaMode === 'video';
  const remoteVideoGraceRemainingMs =
    remoteDisconnectStartedAtMs === null
      ? videoRemoteDisconnectGraceMs
      : Math.max(
          0,
          videoRemoteDisconnectGraceMs - (nowMs - remoteDisconnectStartedAtMs),
        );
  const controlsShown = controlsVisible || controlsPinned;
  const controlsFadeStyle = useFadeStyle(controlsShown, {
    duration: 'component',
    easing: 'gentle',
  });
  const controlsSlideStyle = useSlideStyle(controlsShown, {
    axis: 'y',
    distance: 18,
    duration: 'component',
    easing: 'gentle',
  });
  const previewWidth = isLandscape ? 168 : 148;
  const previewHeight = isLandscape ? 120 : 188;
  const surfaceSupport = activeCallMediaBridge.getSurfaceSupport();
  const localPreviewUsesNativeCamera =
    surfaceSupport.localPreview === 'camera-view';
  const remoteVideoUsesNativeSurface =
    surfaceSupport.remoteVideo === 'native-surface';
  const previewBounds = useMemo(
    () =>
      resolveVideoPreviewBounds({
        containerHeight: surfaceLayout.height,
        containerWidth: surfaceLayout.width,
        padding: previewPadding,
        previewHeight,
        previewWidth,
      }),
    [previewHeight, previewWidth, surfaceLayout.height, surfaceLayout.width],
  );
  const normalizedPreviewPosition = runtime?.selfPreviewPosition ?? null;

  useCameraSessionLifecycle(state === 'video' && effectiveCameraEnabled);

  useEffect(() => {
    callSummarySnapshotRef.current = {
      connectedDurationMs,
      remainingBalancePaise,
      videoDurationMs,
    };
  }, [connectedDurationMs, remainingBalancePaise, videoDurationMs]);

  const clearHideControlsTimeout = useCallback(() => {
    if (hideControlsTimeoutRef.current !== null) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);

  const scheduleControlsAutoHide = useCallback(() => {
    clearHideControlsTimeout();

    if (controlsPinned || returnSheetVisible) {
      setControlsVisible(true);
      return;
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      hideControlsTimeoutRef.current = null;
    }, videoControlAutoHideDelayMs);
  }, [clearHideControlsTimeout, controlsPinned, returnSheetVisible]);

  const registerUserActivity = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsAutoHide();
  }, [scheduleControlsAutoHide]);

  const persistPreviewPosition = useCallback(
    (position: VideoPreviewPosition) => {
      activeCall.setSelfPreviewPosition(
        normalizeVideoPreviewPosition(position, previewBounds),
      );
    },
    [activeCall, previewBounds],
  );

  useEffect(() => {
    clearHideControlsTimeout();

    if (
      state !== 'video' ||
      controlsPinned ||
      returnSheetVisible ||
      !controlsVisible
    ) {
      return clearHideControlsTimeout;
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      hideControlsTimeoutRef.current = null;
    }, videoControlAutoHideDelayMs);

    return clearHideControlsTimeout;
  }, [
    clearHideControlsTimeout,
    controlsPinned,
    controlsVisible,
    returnSheetVisible,
    state,
  ]);

  useEffect(() => {
    if (state === 'video' || state === null || session === null) {
      reconnectRouteHandledRef.current = false;
      return;
    }

    if (state === 'reconnecting') {
      if (reconnectRouteHandledRef.current) {
        return;
      }

      reconnectRouteHandledRef.current = true;
      router.replace(appRoutes.callReconnecting.path);
      return;
    }

    router.replace(appRoutes.callVoice.path);
  }, [router, session, state]);

  const applyCameraEnabled = useCallback(
    async (
      cameraEnabled: boolean,
      options: { fromBackground?: boolean } = {},
    ) => {
      if (session === null) {
        return;
      }

      setCameraUpdating(true);

      try {
        await activeCallSessionAdapter.setCameraEnabled({
          cameraEnabled,
          session,
        });
        activeCall.setCameraEnabled(cameraEnabled);
        if (cameraEnabled) {
          setCameraPausedNoticeVisible(false);
          setCameraSurfaceError(null);
        }
        setControlError(null);

        if (options.fromBackground) {
          setCameraPausedNoticeVisible(true);
        }
      } catch (error: unknown) {
        setControlError(normalizeApiError(error).message);
      } finally {
        setCameraUpdating(false);
      }
    },
    [activeCall, session],
  );

  const setMuted = useCallback(
    async (muted: boolean) => {
      if (session === null) {
        return;
      }

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
    },
    [activeCall, session],
  );

  const setSpeakerEnabled = useCallback(
    async (speakerEnabled: boolean) => {
      if (session === null) {
        return;
      }

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
    },
    [activeCall, session],
  );

  const switchCamera = useCallback(async () => {
    if (session === null) {
      return;
    }

    setSwitchingCamera(true);

    try {
      const nextFacing = await activeCallSessionAdapter.switchCamera({
        session,
      });
      activeCall.setCameraFacing(nextFacing);
      setControlError(null);
      haptics.selection();
    } catch (error: unknown) {
      setControlError(normalizeApiError(error).message);
    } finally {
      setSwitchingCamera(false);
    }
  }, [activeCall, haptics, session]);

  const finishVoiceDowngrade = useCallback(
    async (origin: 'manual' | 'remote-disconnect') => {
      if (session === null) {
        return;
      }

      if (
        voiceDowngradeInFlightRef.current ||
        sessionDowngradeLocks.has(session.id)
      ) {
        return;
      }

      voiceDowngradeInFlightRef.current = true;
      sessionDowngradeLocks.add(session.id);
      setRouteUpdating(true);

      try {
        await activeCallSessionAdapter.downgradeToVoice({
          reason:
            origin === 'remote-disconnect' ? 'remote-video-lost' : 'manual',
          session,
        });
        activeCall.setCameraEnabled(false);
        activeCall.transitionActive('downgrade-to-voice');
        setRemoteDisconnectStartedAtMs(null);
        setReturnSheetVisible(false);
        setControlError(null);
        router.replace(appRoutes.callVoice.path);

        if (origin === 'remote-disconnect') {
          haptics.warning();
        }
      } catch (error: unknown) {
        remoteFallbackInFlightRef.current = false;
        voiceDowngradeInFlightRef.current = false;
        sessionDowngradeLocks.delete(session.id);
        setControlError(normalizeApiError(error).message);
      } finally {
        setRouteUpdating(false);
      }
    },
    [activeCall, haptics, router, session],
  );

  const endCall = useCallback(
    async (reason: CallSummaryEndReason = 'manual') => {
      if (session === null) {
        return;
      }

      const summarySnapshot = callSummarySnapshotRef.current;
      const endedAtIso = new Date().toISOString();

      setLowBalanceModalVisible(false);
      reportSheetRef.current?.dismiss();
      addMoneySheetRef.current?.dismiss();
      setTopUpSheetOpenedAtMs(null);
      activeCall.transitionActive('end');

      await Promise.allSettled([
        activeCallSessionAdapter.disconnectSession({
          session,
        }),
        callSessionAdapter.endVoiceSession(session.id),
        callPreconnectAdapter.releaseVoiceResources(session.mediaResourceId),
      ]);

      activeCall.reset();
      void prePersistPostCallRecord({
        callId: session.callId,
        connectedDurationMs: summarySnapshot.connectedDurationMs,
        endedAtIso,
        hostId: session.hostId,
        hostName: session.hostName,
        mediaMode: 'video',
        reason,
        remainingBalancePaise: summarySnapshot.remainingBalancePaise,
        sessionId: session.id,
        videoDurationMs: summarySnapshot.videoDurationMs,
      }).catch(() => undefined);
      router.replace({
        params: createCallSummaryRouteParams({
          callId: session.callId,
          connectedDurationMs: summarySnapshot.connectedDurationMs,
          endedAtIso,
          hostId: session.hostId,
          hostName: session.hostName,
          mediaMode: 'video',
          remainingBalancePaise: summarySnapshot.remainingBalancePaise,
          reason,
          sessionId: session.id,
          videoDurationMs: summarySnapshot.videoDurationMs,
        }),
        pathname: appRoutes.callSummary.path,
      });
    },
    [activeCall, router, session],
  );

  const openAddMoneySheet = useCallback(() => {
    setCallNotice(null);
    setTopUpSheetOpenedAtMs(nowMs);
    addMoneySheetRef.current?.present();
  }, [nowMs]);

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
        returnTo: appRoutes.callVideo.path,
      },
      pathname: appRoutes.customerAddMoney.path,
    });
  }, [closeAddMoneySheet, router, selectedTopUpAmount, topUpGraceRemainingMs]);

  const openReportSheet = useCallback(() => {
    setCallNotice(null);
    reportSheetRef.current?.present();
  }, []);

  const closeReportSheet = useCallback(() => {
    reportSheetRef.current?.dismiss();
  }, []);

  const handleReportSubmitted = ({ endedCall }: { endedCall: boolean }) => {
    reportSheetRef.current?.dismiss();

    if (endedCall) {
      void endCall('report-submit-end');
      return;
    }

    setCallNotice({
      message:
        'The report was added to the mock safety service. Video can continue while review is pending.',
      title: 'Report submitted',
      tone: 'success',
    });
  };

  useEffect(() => {
    if (!lowBalanceWarningActive) {
      lowBalanceWarningHandledRef.current = false;
      lowBalanceModalShownRef.current = false;

      if (lowBalancePulseTimeoutRef.current !== null) {
        clearTimeout(lowBalancePulseTimeoutRef.current);
        lowBalancePulseTimeoutRef.current = null;
      }

      if (lowBalancePulseStartTimeoutRef.current !== null) {
        clearTimeout(lowBalancePulseStartTimeoutRef.current);
      }

      lowBalancePulseStartTimeoutRef.current = setTimeout(() => {
        setLowBalancePulseVisible(false);
        lowBalancePulseStartTimeoutRef.current = null;
      }, 0);
      return;
    }

    if (!lowBalanceWarningHandledRef.current) {
      lowBalanceWarningHandledRef.current = true;
      haptics.lowBalance();

      if (!reducedMotionEnabled) {
        if (lowBalancePulseStartTimeoutRef.current !== null) {
          clearTimeout(lowBalancePulseStartTimeoutRef.current);
        }

        lowBalancePulseStartTimeoutRef.current = setTimeout(() => {
          setLowBalancePulseVisible(true);
          lowBalancePulseStartTimeoutRef.current = null;
        }, 0);

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
      state !== 'video' ||
      zeroBalanceHandledRef.current ||
      session === null
    ) {
      return;
    }

    zeroBalanceHandledRef.current = true;
    void endCall('balance-zero');
  }, [endCall, remainingBalancePaise, session, state]);

  useEffect(() => {
    return () => {
      if (lowBalancePulseStartTimeoutRef.current !== null) {
        clearTimeout(lowBalancePulseStartTimeoutRef.current);
      }

      if (lowBalancePulseTimeoutRef.current !== null) {
        clearTimeout(lowBalancePulseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        return;
      }

      registerUserActivity();

      if (state === 'video' && effectiveCameraEnabled) {
        void applyCameraEnabled(false, { fromBackground: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [applyCameraEnabled, effectiveCameraEnabled, registerUserActivity, state]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // This synchronizes a UI-only grace timer to external media telemetry.
    if (state !== 'video' || telemetry === null) {
      setRemoteDisconnectStartedAtMs(null);
      remoteFallbackInFlightRef.current = false;
      voiceDowngradeInFlightRef.current = false;

      if (sessionId !== null) {
        sessionDowngradeLocks.delete(sessionId);
      }

      return;
    }

    if (telemetry.mediaMode === 'video' && remoteVideoConnected) {
      setRemoteDisconnectStartedAtMs(null);
      remoteFallbackInFlightRef.current = false;
      return;
    }

    setRemoteDisconnectStartedAtMs((current) => current ?? nowMs);
  }, [nowMs, remoteVideoConnected, sessionId, state, telemetry]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (
      state !== 'video' ||
      remoteDisconnectStartedAtMs === null ||
      remoteFallbackInFlightRef.current ||
      remoteVideoGraceRemainingMs > 0
    ) {
      return;
    }

    remoteFallbackInFlightRef.current = true;
    void finishVoiceDowngrade('remote-disconnect');
  }, [
    finishVoiceDowngrade,
    remoteDisconnectStartedAtMs,
    remoteVideoGraceRemainingMs,
    state,
  ]);

  const { gesture, previewStyle } = useVideoPreviewDragController({
    bounds: previewBounds,
    enabled: surfaceLayout.width > 0 && surfaceLayout.height > 0,
    normalizedPosition:
      normalizedPreviewPosition ?? defaultVideoPreviewPosition,
    onPersist: persistPreviewPosition,
    onTouchActivity: registerUserActivity,
  });

  const handleSurfaceLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setSurfaceLayout({ height, width });
  }, []);

  if (session === null || runtime === null) {
    return (
      <CallScreen testID="video-call-screen">
        <View style={styles.emptyStateWrap}>
          <EmptyState
            message="A connected video session is required before the video route can render."
            title="No active video session"
          />
          <Button
            onPress={() => {
              router.replace(appRoutes.callVoice.path);
            }}
            title="Return to voice"
          />
        </View>
      </CallScreen>
    );
  }

  return (
    <CallScreen testID="video-call-screen">
      <LinearGradient
        colors={[ui.color.call.videoOverlay, ui.color.call.backgroundEnd]}
        end={{ x: 0.95, y: 1 }}
        start={{ x: 0.04, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        onTouchStart={registerUserActivity}
        style={styles.screenContent}
        testID="video-call-touch-surface"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.hostName}>
              {session.hostName}
            </Text>
            <Text style={styles.hostMeta}>
              {session.hostLanguage} voice / video active
            </Text>
          </View>
          <View style={styles.headerActions}>
            <StatusBadge
              label={networkQuality.label}
              tone={toneForNetworkQuality(networkQuality.quality)}
            />
            <Button
              compact
              onPress={() => {
                const nextPinned = !controlsPinned;
                setControlsPinned(nextPinned);
                setControlsVisible(true);
              }}
              testID="video-toggle-control-visibility"
              title={controlsPinned ? 'Auto-hide controls' : 'Always show'}
              variant="secondary"
            />
          </View>
        </View>

        <View
          style={[
            styles.metricRow,
            isLandscape ? styles.metricRowLandscape : null,
          ]}
        >
          <MetricPill
            label="Total timer"
            value={formatActiveCallDuration(connectedDurationMs)}
          />
          <MetricPill
            label="Video duration"
            value={formatActiveCallDuration(videoDurationMs)}
          />
          <MetricPill
            label="Wallet"
            value={
              walletQuery.isPending
                ? 'Loading'
                : walletQuery.data === undefined
                  ? 'Unavailable'
                  : formatMoney(walletQuery.data.balance)
            }
          />
          <MetricPill
            label="Est. time"
            value={formatActiveCallDuration(estimatedRemainingTimeMs)}
          />
          <MetricPill label="Video price" value={currentPriceLabel} />
        </View>

        {walletQuery.isPending ? (
          <OverlayCard>
            <Skeleton lines={2} />
          </OverlayCard>
        ) : null}

        {walletQuery.isError ? (
          <Banner
            message={`${normalizeApiError(walletQuery.error).message} Video can continue while wallet data retries.`}
            title="Wallet refresh unavailable"
            tone="warning"
          />
        ) : null}

        {lowBalanceWarningActive ? (
          <LowBalanceNoticeCard
            currentRateLabel={currentPriceLabel}
            estimatedRemainingTimeLabel={estimatedRemainingTimeLabel}
            onAddMoney={openAddMoneySheet}
            pulse={lowBalancePulseVisible}
            remainingBalanceLabel={formatMoney({
              amountPaise: remainingBalancePaise,
              currency: session.videoRate.currency,
            })}
            testID="video-low-balance-card"
          />
        ) : null}

        {networkQuality.quality === 'poor' ||
        networkQuality.quality === 'reconnecting' ? (
          <Banner
            message="Video quality is degraded. If remote video does not recover, the call will continue on voice automatically."
            title="Network degraded"
            tone="warning"
          />
        ) : null}

        {remoteDisconnectStartedAtMs !== null ? (
          <Banner
            message={`Remote video is unavailable. Falling back to voice in ${formatVideoDisconnectGraceLabel(
              remoteVideoGraceRemainingMs,
            )} if the stream does not recover.`}
            title="Video recovering"
            tone="warning"
          />
        ) : null}

        {cameraPausedNoticeVisible ? (
          <Banner
            message="Your camera was turned off when the app left the foreground. You can re-enable it when ready."
            title="Camera paused"
            tone="info"
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
            title="Video controls unavailable"
            tone="warning"
          />
        ) : null}

        {cameraSurfaceError !== null ? (
          <Banner
            message={cameraSurfaceError}
            title="Camera preview unavailable"
            tone="warning"
          />
        ) : null}

        <View style={styles.videoSurfaceWrap}>
          <Animated.View
            layout={layoutTransitions.gentle}
            onLayout={handleSurfaceLayout}
            style={[
              styles.videoSurface,
              isLandscape ? styles.videoSurfaceLandscape : null,
            ]}
            testID="video-call-remote-surface"
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.08)',
                'rgba(255,255,255,0.02)',
                'rgba(0,0,0,0.18)',
              ]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.remoteStatusWrap}>
              <StatusBadge
                label={
                  remoteCameraEnabled && remoteVideoConnected
                    ? 'Remote video connected'
                    : remoteCameraEnabled
                      ? 'Waiting for remote video'
                      : 'Host camera off'
                }
                tone={
                  remoteCameraEnabled && remoteVideoConnected
                    ? 'success'
                    : 'warning'
                }
              />
            </View>
            {remoteVideoConnected && remoteVideoUsesNativeSurface ? (
              <ActiveCallRemoteVideoSurface
                sessionId={session.id}
                style={StyleSheet.absoluteFill}
                testID="video-call-remote-native-surface"
              />
            ) : null}
            {remoteCameraEnabled && remoteVideoConnected ? (
              remoteVideoUsesNativeSurface ? (
                <View
                  pointerEvents="none"
                  style={styles.nativeSurfaceLabelWrap}
                >
                  <Text style={styles.nativeSurfaceLabel}>
                    Native remote video surface
                  </Text>
                </View>
              ) : (
                <View style={styles.remotePlaceholderContent}>
                  <ConversationOrb
                    accessibilityLabel={`${session.hostName} video surface`}
                    size={isLandscape ? 180 : 220}
                    state={reducedMotionEnabled ? 'video' : 'video'}
                    testID="video-call-orb"
                  />
                  <View style={styles.remoteAvatarWrap}>
                    <Avatar
                      label={session.hostName}
                      size="lg"
                      testID="video-call-avatar"
                    />
                  </View>
                  <Text style={styles.surfaceTitle}>
                    Remote video placeholder
                  </Text>
                  <Text style={styles.surfaceBody}>
                    The CallAdapter will attach the native remote-video surface
                    here when the media bridge is connected.
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.remotePlaceholderContent}>
                <View style={styles.privacyBadge}>
                  <AlertTriangle color={ui.color.status.warning} size={28} />
                </View>
                <Text style={styles.surfaceTitle}>Privacy placeholder</Text>
                <Text style={styles.surfaceBody}>
                  {remoteCameraEnabled
                    ? 'Remote video is reconnecting. Voice remains active and billing will fall back to voice if video does not recover.'
                    : 'The host camera is currently off. Voice continues without interruption.'}
                </Text>
              </View>
            )}

            <GestureDetector gesture={gesture}>
              <Animated.View
                style={[
                  styles.selfPreview,
                  {
                    height: previewHeight,
                    width: previewWidth,
                  },
                  previewStyle,
                ]}
                testID="video-call-self-preview"
              >
                <Text style={styles.selfPreviewEyebrow}>Self preview</Text>
                <View style={styles.selfPreviewCard}>
                  {effectiveCameraEnabled ? (
                    localPreviewUsesNativeCamera ? (
                      <View style={styles.selfPreviewCameraFrame}>
                        <CameraView
                          active={state === 'video' && effectiveCameraEnabled}
                          facing={effectiveCameraFacing}
                          mirror={effectiveCameraFacing === 'front'}
                          mute
                          onMountError={(event) => {
                            setCameraSurfaceError(event.message);
                          }}
                          style={StyleSheet.absoluteFill}
                          testID="video-call-self-camera"
                        />
                        <View style={styles.selfPreviewCameraOverlay}>
                          <Text style={styles.selfPreviewTitle}>
                            {effectiveCameraFacing === 'front'
                              ? 'Front camera'
                              : 'Back camera'}
                          </Text>
                          <Text style={styles.selfPreviewHint}>
                            Native camera preview routed through the active-call
                            media bridge.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.selfPreviewAvatarWrap}>
                          <Avatar label="You" size="sm" />
                        </View>
                        <Text style={styles.selfPreviewTitle}>
                          {effectiveCameraFacing === 'front'
                            ? 'Front camera'
                            : 'Back camera'}
                        </Text>
                        <Text style={styles.selfPreviewHint}>
                          Local preview placeholder. Camera output is routed
                          through the CallAdapter.
                        </Text>
                      </>
                    )
                  ) : (
                    <>
                      <View style={styles.privacyBadgeCompact}>
                        <Camera color={ui.color.status.warning} size={20} />
                      </View>
                      <Text style={styles.selfPreviewTitle}>Camera off</Text>
                      <Text style={styles.selfPreviewHint}>
                        Privacy placeholder stays in place until you turn the
                        camera back on.
                      </Text>
                    </>
                  )}
                </View>
              </Animated.View>
            </GestureDetector>
          </Animated.View>
        </View>

        <Animated.View
          accessibilityElementsHidden={!controlsShown}
          importantForAccessibility={
            controlsShown ? 'auto' : 'no-hide-descendants'
          }
          pointerEvents={controlsShown ? 'auto' : 'none'}
          style={[
            styles.controlsOverlay,
            controlsFadeStyle,
            controlsSlideStyle,
          ]}
          testID="video-call-controls"
        >
          <View style={styles.controlsGrid}>
            <CallControlButton
              disabled={muteUpdating}
              icon={Mic}
              label="Mute"
              onPress={() => {
                void setMuted(!controls.muted);
              }}
              selected={controls.muted}
              testID="video-toggle-mute"
            />
            <CallControlButton
              disabled={speakerUpdating}
              icon={Volume2}
              label="Speaker"
              onPress={() => {
                void setSpeakerEnabled(!controls.speakerEnabled);
              }}
              selected={controls.speakerEnabled}
              testID="video-toggle-speaker"
            />
            <CallControlButton
              disabled={cameraUpdating}
              icon={Camera}
              label="Camera"
              onPress={() => {
                void applyCameraEnabled(!effectiveCameraEnabled);
              }}
              selected={effectiveCameraEnabled}
              testID="video-toggle-camera"
            />
            <CallControlButton
              disabled={switchingCamera || !effectiveCameraEnabled}
              icon={RefreshCw}
              label="Switch"
              onPress={() => {
                void switchCamera();
              }}
              testID="video-switch-camera"
            />
            <CallControlButton
              disabled={routeUpdating}
              icon={Video}
              label="Voice"
              onPress={() => {
                setReturnSheetVisible(true);
                setControlsVisible(true);
                returnSheetRef.current?.present();
              }}
              testID="video-open-return-sheet"
            />
            <CallControlButton
              icon={IndianRupee}
              label="Add Money"
              onPress={() => {
                openAddMoneySheet();
              }}
              testID="video-add-money"
            />
            <CallControlButton
              icon={Flag}
              label="Report"
              onPress={() => {
                openReportSheet();
              }}
              testID="video-report"
            />
          </View>
          <Button
            onPress={() => {
              if (connectedDurationMs >= activeCallEndConfirmationDurationMs) {
                setEndConfirmationVisible(true);
                return;
              }

              void endCall();
            }}
            style={styles.endCallButton}
            testID="video-end-call"
            title="End Call"
            variant="destructive"
          />
        </Animated.View>
      </View>

      <BottomSheetWrapper
        onDismiss={() => {
          setReturnSheetVisible(false);
        }}
        ref={returnSheetRef}
        snapPoints={['42%']}
      >
        <View style={styles.sheetContent}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            Return to voice?
          </Text>
          <Text style={styles.sheetBody}>
            Video billing is currently {currentPriceLabel}. Returning to voice
            will continue the same call at {voicePriceLabel} without
            disconnecting the host.
          </Text>
          <View style={styles.sheetActions}>
            <Button
              onPress={() => {
                setReturnSheetVisible(false);
                returnSheetRef.current?.dismiss();
              }}
              testID="video-cancel-return-voice"
              title="Keep video"
              variant="secondary"
            />
            <Button
              loading={routeUpdating}
              onPress={() => {
                void finishVoiceDowngrade('manual');
              }}
              testID="video-confirm-return-voice"
              title="Return to voice"
            />
          </View>
        </View>
      </BottomSheetWrapper>
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
            mediaMode: 'video',
            remainingBalancePaise,
            sessionId: session.id,
          }}
          onCancel={closeReportSheet}
          onSubmitted={handleReportSubmitted}
          showSubmitAndEnd
        />
      </BottomSheetWrapper>
      <AddMoneyDuringCallSheet
        currentRateLabel={currentPriceLabel}
        graceRemainingLabel={formatCallSafetyDuration(topUpGraceRemainingMs)}
        onDismiss={handleAddMoneySheetDismiss}
        onClose={closeAddMoneySheet}
        onContinue={continueToAddMoneyFlow}
        onSelectAmount={setSelectedTopUpAmount}
        selectedAmount={selectedTopUpAmount}
        sheetRef={addMoneySheetRef}
      />

      <ConfirmationDialog
        confirmLabel="Add Money"
        message={`Only ${estimatedRemainingTimeLabel} remains at ${currentPriceLabel}. Open the top-up flow now and return to this active call without exposing sensitive payment data on the call screen.`}
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
      <ConfirmationDialog
        confirmLabel="End Call"
        destructive
        message="This video call is already connected. End it now only if you're ready to disconnect immediately."
        onCancel={() => {
          setEndConfirmationVisible(false);
        }}
        onConfirm={() => {
          setEndConfirmationVisible(false);
          void endCall();
        }}
        title="End this call?"
        visible={endConfirmationVisible}
      />
    </CallScreen>
  );
}

const styles = StyleSheet.create({
  controlsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
    justifyContent: 'center',
  },
  controlsOverlay: {
    bottom: ui.spacing[4],
    gap: ui.spacing[3],
    left: ui.spacing[4],
    position: 'absolute',
    right: ui.spacing[4],
  },
  emptyStateWrap: {
    flex: 1,
    gap: ui.spacing[4],
    justifyContent: 'center',
  },
  endCallButton: {
    alignSelf: 'stretch',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: ui.spacing[2],
  },
  headerCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  hostMeta: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    opacity: 0.82,
  },
  hostName: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  metricLabel: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    opacity: 0.74,
    textTransform: 'uppercase',
  },
  metricPill: {
    backgroundColor: 'rgba(12, 14, 18, 0.48)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    gap: 2,
    minHeight: ui.minTouch,
    minWidth: 116,
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[3],
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  metricRowLandscape: {
    maxWidth: '88%',
  },
  metricValue: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.label.lineHeight,
  },
  nativeSurfaceLabel: {
    backgroundColor: 'rgba(6, 8, 12, 0.56)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    color: ui.color.text.inverse,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    overflow: 'hidden',
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[2],
  },
  nativeSurfaceLabelWrap: {
    bottom: ui.spacing[4],
    left: ui.spacing[4],
    position: 'absolute',
  },
  overlayCard: {
    gap: ui.spacing[2],
  },
  privacyBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: ui.radii.full,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  privacyBadgeCompact: {
    alignItems: 'center',
    backgroundColor: ui.color.status.warningSoft,
    borderRadius: ui.radii.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  remoteAvatarWrap: {
    position: 'absolute',
  },
  remotePlaceholderContent: {
    alignItems: 'center',
    gap: ui.spacing[3],
    justifyContent: 'center',
    maxWidth: 360,
    paddingHorizontal: ui.spacing[5],
    paddingVertical: ui.spacing[6],
  },
  remoteStatusWrap: {
    left: ui.spacing[4],
    position: 'absolute',
    right: ui.spacing[4],
    top: ui.spacing[4],
  },
  screenContent: {
    flex: 1,
    gap: ui.spacing[3],
  },
  selfPreview: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  selfPreviewAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfPreviewCameraFrame: {
    borderRadius: ui.radii.xl,
    flex: 1,
    overflow: 'hidden',
  },
  selfPreviewCameraOverlay: {
    backgroundColor: 'rgba(6, 8, 12, 0.38)',
    bottom: 0,
    gap: ui.spacing[1],
    left: 0,
    padding: ui.spacing[3],
    position: 'absolute',
    right: 0,
  },
  selfPreviewCard: {
    backgroundColor: 'rgba(6, 8, 12, 0.76)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: ui.radii.xl,
    borderWidth: 1,
    flex: 1,
    gap: ui.spacing[2],
    justifyContent: 'center',
    padding: ui.spacing[3],
  },
  selfPreviewEyebrow: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    marginBottom: ui.spacing[2],
    opacity: 0.78,
    textTransform: 'uppercase',
  },
  selfPreviewHint: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    opacity: 0.78,
  },
  selfPreviewTitle: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  sheetBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  sheetContent: {
    gap: ui.spacing[4],
  },
  sheetTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  surfaceBody: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    opacity: 0.82,
    textAlign: 'center',
  },
  surfaceTitle: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  videoSurface: {
    backgroundColor: 'rgba(8, 10, 14, 0.78)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: ui.radii.xxl,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 360,
    overflow: 'hidden',
    position: 'relative',
  },
  videoSurfaceLandscape: {
    minHeight: 240,
  },
  videoSurfaceWrap: {
    flex: 1,
  },
});
