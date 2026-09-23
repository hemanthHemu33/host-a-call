import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  Clock3,
  Flag,
  Headphones,
  IndianRupee,
  Languages,
  MapPin,
  Mic,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  ShieldCheck,
  Video,
  Volume2,
} from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { getCustomerAvatarOptionsForGender } from '@/assets/avatars/customer-avatars';
import { ConversationOrb } from '@/components/animations/ConversationOrb';
import { VoiceWaveform } from '@/components/animations/SkiaVisuals';
import { CallScreen } from '@/components/layout';
import { Button, CallControlButton } from '@/components/ui/controls';
import { Avatar, Card, StatusBadge } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import type { IconComponent } from '@/components/ui/types';
import { appRoutes } from '@/navigation/routes';
import {
  layoutTransitions,
  useFadeStyle,
  useHaptics,
  useMotion,
  usePulseStyle,
} from '@/motion';
import { readMonotonicNowMs } from '@/store/call.store';

import {
  createMockWaveformSamples,
  defaultActiveCallClock,
  estimateActiveCallChargePaise,
  formatActiveCallDuration,
  useActiveCallTicker,
} from './active-call';

const callerAvatarUri =
  getCustomerAvatarOptionsForGender('man')[2]?.uri ??
  'asset://connecto/customer-avatar/male/03';
const videoOfferDelayMs = 180_000;

const hostIncomingCall = {
  balanceMinutes: 18,
  callerAvatarUri,
  callerId: 'customer_hemanth',
  callerName: 'Hemanth',
  connectionId: 'host-incoming-demo-001',
  language: 'Telugu',
  location: 'Andhra Pradesh',
  memberSince: 'Jul 2026',
  startedAtLabel: 'Just now',
  videoRatePaise: 1500,
  voiceRatePaise: 1000,
} as const;

const formatInrPaise = (amountPaise: number) =>
  new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amountPaise / 100);

type HostCallPhase =
  'video-active' | 'video-ringing' | 'voice-active' | 'voice-ringing';

type HostRouteMode = 'video' | 'voice';

const routeModeFromParam = (
  value: string | string[] | undefined,
): HostRouteMode => {
  const normalized = Array.isArray(value) ? value[0] : value;

  return normalized === 'video' ? 'video' : 'voice';
};

const testIdForPhase = (phase: HostCallPhase) => {
  if (phase === 'voice-ringing') {
    return 'host-incoming-call-screen';
  }

  if (phase === 'voice-active') {
    return 'host-active-call-screen';
  }

  if (phase === 'video-ringing') {
    return 'host-video-incoming-call-screen';
  }

  return 'host-video-active-call-screen';
};

function HostCallTopBar({
  label,
  tone,
  timer,
}: {
  label: string;
  timer?: string;
  tone: 'error' | 'info' | 'success' | 'warning';
}) {
  return (
    <View style={styles.topBar}>
      <View>
        <Text style={styles.logoText}>Connecto</Text>
        <Text style={styles.logoSubtext}>Host call</Text>
      </View>
      <View style={styles.topStatus}>
        <StatusBadge label={label} tone={tone} />
        {timer === undefined ? null : (
          <Text style={styles.topTimer}>{timer}</Text>
        )}
      </View>
    </View>
  );
}

function HostCallDetailPill({
  compact = false,
  Icon,
  label,
  value,
}: {
  compact?: boolean;
  Icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <Card
      style={[styles.detailPill, compact ? styles.detailPillCompact : null]}
      variant="strong"
    >
      <View
        style={[styles.detailIcon, compact ? styles.detailIconCompact : null]}
      >
        <Icon color={ui.color.brand.primary} size={compact ? 16 : 20} />
      </View>
      <View style={styles.flex}>
        <Text
          style={[
            styles.detailLabel,
            compact ? styles.detailLabelCompact : null,
          ]}
        >
          {label}
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.68}
          numberOfLines={1}
          style={styles.detailValue}
        >
          {value}
        </Text>
      </View>
    </Card>
  );
}

function HostCallMetricCard({
  children,
  label,
  value,
}: {
  children?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card style={styles.metricCard} variant="strong">
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        style={styles.metricValue}
      >
        {value}
      </Text>
      {children}
    </Card>
  );
}

function HostAnimatedCallIcon({
  compact = false,
  pulsing,
  state,
}: {
  compact?: boolean;
  pulsing: boolean;
  state: 'ringing' | 'video' | 'videoRequested' | 'voice';
}) {
  const pulseStyle = usePulseStyle(pulsing);
  const size = compact ? 128 : 176;
  const stageSize = compact ? 156 : 216;

  return (
    <View
      style={[
        styles.callerStage,
        compact ? styles.callerStageCompact : null,
        { height: stageSize, width: stageSize },
      ]}
    >
      <View
        style={[
          styles.callerHaloOuter,
          {
            height: stageSize,
            width: stageSize,
          },
        ]}
      />
      <View
        style={[
          styles.callerHaloInner,
          {
            height: stageSize * 0.72,
            width: stageSize * 0.72,
          },
        ]}
      />
      <Animated.View style={[styles.orbWrap, pulseStyle]}>
        <ConversationOrb
          accessibilityLabel="Host call animation"
          quality="high"
          size={size}
          state={state}
          testID={`host-${state}-call-orb`}
        />
      </Animated.View>
      <View
        style={[styles.avatarRing, compact ? styles.avatarRingCompact : null]}
      >
        <Avatar
          label={hostIncomingCall.callerName}
          size={compact ? 'md' : 'lg'}
          source={{ uri: hostIncomingCall.callerAvatarUri }}
        />
      </View>
    </View>
  );
}

function HostCallHeroCard({
  children,
  compact = false,
  icon,
}: {
  children: ReactNode;
  compact?: boolean;
  icon: ReactNode;
}) {
  return (
    <Card
      style={[styles.heroCard, compact ? styles.heroCardCompact : null]}
      variant="floating"
    >
      {icon}
      <View style={styles.heroCopy}>{children}</View>
    </Card>
  );
}

function HostVoiceIncomingView({
  ringingDurationLabel,
}: {
  ringingDurationLabel: string;
}) {
  const fadeStyle = useFadeStyle(true, {
    duration: 'screen',
    easing: 'gentle',
  });

  return (
    <Animated.View
      layout={layoutTransitions.gentle}
      style={[styles.content, fadeStyle]}
    >
      <HostCallHeroCard icon={<HostAnimatedCallIcon pulsing state="ringing" />}>
        <Text accessibilityRole="header" style={styles.callerName}>
          {hostIncomingCall.callerName}
        </Text>
        <Text style={styles.callerMeta}>
          {hostIncomingCall.location} - {hostIncomingCall.language}
        </Text>
        <Text style={styles.ringingTime}>{ringingDurationLabel}</Text>
      </HostCallHeroCard>

      <View style={styles.detailGrid}>
        <HostCallDetailPill
          Icon={PhoneIncoming}
          label="Call type"
          value="Voice call"
        />
        <HostCallDetailPill
          Icon={IndianRupee}
          label="Rate"
          value={`${formatInrPaise(hostIncomingCall.voiceRatePaise)}/min`}
        />
        <HostCallDetailPill
          Icon={ShieldCheck}
          label="Safety"
          value="Balance verified"
        />
        <HostCallDetailPill
          Icon={Clock3}
          label="Caller balance"
          value={`${String(hostIncomingCall.balanceMinutes)} min left`}
        />
      </View>
    </Animated.View>
  );
}

function HostVoiceActiveView({
  answeredDurationMs,
  muted,
  speakerEnabled,
  videoOfferRemainingMs,
}: {
  answeredDurationMs: number;
  muted: boolean;
  speakerEnabled: boolean;
  videoOfferRemainingMs: number;
}) {
  const { reducedMotionEnabled } = useMotion();
  const nowMs = useActiveCallTicker({
    clock: defaultActiveCallClock,
  });
  const waveformSamples = createMockWaveformSamples({
    active: !muted,
    nowMs,
    reducedMotionEnabled,
  });
  const earnedPaise = estimateActiveCallChargePaise({
    connectedDurationMs: answeredDurationMs,
    videoDurationMs: 0,
    videoRatePaise: hostIncomingCall.videoRatePaise,
    voiceRatePaise: hostIncomingCall.voiceRatePaise,
  });
  const videoReady = videoOfferRemainingMs <= 0;

  return (
    <Animated.View
      layout={layoutTransitions.gentle}
      style={[styles.content, styles.activeContent]}
    >
      <HostCallTopBar
        label="Voice connected"
        timer={formatActiveCallDuration(answeredDurationMs)}
        tone="success"
      />

      <HostCallHeroCard
        compact
        icon={<HostAnimatedCallIcon compact pulsing={false} state="voice" />}
      >
        <Text style={styles.activeCallerName}>
          {hostIncomingCall.callerName}
        </Text>
        <Text style={styles.callerMeta}>
          {muted ? 'Muted' : 'Mic live'} -{' '}
          {speakerEnabled ? 'Speaker on' : 'Earpiece'}
        </Text>
        <VoiceWaveform
          active={!muted}
          samples={waveformSamples}
          style={styles.waveformInline}
          testID="host-active-call-waveform"
        />
      </HostCallHeroCard>

      <View style={styles.metricGrid}>
        <HostCallMetricCard
          label="Live rate"
          value={`${formatInrPaise(hostIncomingCall.voiceRatePaise)}/min`}
        />
        <HostCallMetricCard
          label="Earned"
          value={formatInrPaise(earnedPaise)}
        />
      </View>

      <Card style={styles.videoUnlockCard} variant="strong">
        <View style={styles.contextIcon}>
          <Video color={ui.color.brand.primary} size={22} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.contextTitle}>
            {videoReady
              ? 'Video request ready'
              : `${formatActiveCallDuration(videoOfferRemainingMs)} to video`}
          </Text>
          <Text style={styles.contextBody}>
            Video incoming request appears after 3 minutes of connected voice.
          </Text>
          <View style={styles.unlockTrack}>
            <View
              style={[
                styles.unlockFill,
                {
                  flex: Math.max(
                    0.04,
                    Math.min(1, answeredDurationMs / videoOfferDelayMs),
                  ),
                },
              ]}
            />
            <View
              style={{
                flex: Math.max(
                  0,
                  1 - Math.min(1, answeredDurationMs / videoOfferDelayMs),
                ),
              }}
            />
          </View>
        </View>
      </Card>

      <View style={styles.detailGrid}>
        <HostCallDetailPill
          compact
          Icon={Languages}
          label="Language"
          value={hostIncomingCall.language}
        />
        <HostCallDetailPill
          compact
          Icon={MapPin}
          label="Location"
          value={hostIncomingCall.location}
        />
        <HostCallDetailPill
          compact
          Icon={Headphones}
          label="Audio"
          value={speakerEnabled ? 'Speaker' : 'Earpiece'}
        />
        <HostCallDetailPill
          compact
          Icon={Phone}
          label="Session"
          value={hostIncomingCall.connectionId}
        />
      </View>
    </Animated.View>
  );
}

function HostVideoIncomingView({
  ringingDurationLabel,
  voiceDurationLabel,
}: {
  ringingDurationLabel: string;
  voiceDurationLabel: string;
}) {
  const fadeStyle = useFadeStyle(true, {
    duration: 'screen',
    easing: 'gentle',
  });

  return (
    <Animated.View
      layout={layoutTransitions.gentle}
      style={[styles.content, fadeStyle]}
    >
      <HostCallTopBar
        label="Video request"
        timer={voiceDurationLabel}
        tone="warning"
      />

      <HostCallHeroCard icon={<HostAnimatedCallIcon pulsing state="ringing" />}>
        <Text accessibilityRole="header" style={styles.heroEyebrow}>
          Incoming Video Call
        </Text>
        <Text style={styles.callerName}>{hostIncomingCall.callerName}</Text>
        <Text style={styles.callerMeta}>
          Voice connected for {voiceDurationLabel}
        </Text>
        <Text style={styles.ringingTime}>{ringingDurationLabel}</Text>
      </HostCallHeroCard>

      <View style={styles.detailGrid}>
        <HostCallDetailPill Icon={Video} label="Request" value="Video call" />
        <HostCallDetailPill
          Icon={IndianRupee}
          label="Video rate"
          value={`${formatInrPaise(hostIncomingCall.videoRatePaise)}/min`}
        />
        <HostCallDetailPill
          Icon={Clock3}
          label="Unlocked"
          value="After 3 min"
        />
        <HostCallDetailPill
          Icon={ShieldCheck}
          label="Safety"
          value="Voice stays live"
        />
      </View>
    </Animated.View>
  );
}

function HostVideoActiveView({
  answeredDurationMs,
  cameraEnabled,
  muted,
  onEndCall,
  onReport,
  onToggleCamera,
  onToggleMute,
  onToggleSpeaker,
  speakerEnabled,
}: {
  answeredDurationMs: number;
  cameraEnabled: boolean;
  muted: boolean;
  onEndCall: () => void;
  onReport: () => void;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  speakerEnabled: boolean;
}) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeFadeStyle = useFadeStyle(chromeVisible, {
    duration: 'component',
    easing: 'gentle',
  });

  return (
    <Animated.View
      layout={layoutTransitions.gentle}
      style={styles.videoActiveScreen}
    >
      <LinearGradient
        colors={[
          'rgba(87,22,56,0.92)',
          'rgba(201,54,116,0.76)',
          'rgba(239,106,116,0.72)',
          'rgba(255,231,238,0.95)',
        ]}
        end={{ x: 0.95, y: 1 }}
        start={{ x: 0.05, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.videoActiveGlowTop} />
      <View pointerEvents="none" style={styles.videoActiveGlowBottom} />

      <View pointerEvents="none" style={styles.videoActiveTopOverlay}>
        <View style={styles.videoActiveTopCopy}>
          <Text style={styles.videoActiveCallerName}>
            {hostIncomingCall.callerName}
          </Text>
          <StatusBadge label="Video connected" tone="success" />
        </View>
        <Text style={styles.videoActiveTimer}>
          {formatActiveCallDuration(answeredDurationMs)}
        </Text>
      </View>

      <Pressable
        accessibilityHint={
          chromeVisible
            ? 'Hides video call controls.'
            : 'Shows video call controls.'
        }
        accessibilityLabel="Toggle video call controls"
        accessibilityRole="button"
        onPress={() => {
          setChromeVisible((current) => !current);
        }}
        style={styles.videoRemoteStage}
        testID="host-video-active-toggle-chrome"
      >
        <View style={styles.videoRemoteFocus}>
          <View style={styles.videoRemoteRingOuter} />
          <View style={styles.videoRemoteRingInner} />
          <View style={styles.videoRemoteAvatar}>
            <Avatar
              label={hostIncomingCall.callerName}
              size="lg"
              source={{ uri: hostIncomingCall.callerAvatarUri }}
            />
          </View>
        </View>
      </Pressable>

      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[styles.videoSelfPreview, chromeFadeStyle]}
      >
        <View style={styles.videoSelfIcon}>
          {cameraEnabled ? (
            <Camera color={ui.color.brand.primary} size={26} />
          ) : (
            <Video color={ui.color.text.tertiary} size={26} />
          )}
        </View>
        <Text style={styles.videoSelfText}>
          {cameraEnabled ? 'You' : 'Camera off'}
        </Text>
      </Animated.View>

      <Animated.View
        pointerEvents={chromeVisible ? 'auto' : 'none'}
        style={[styles.videoActiveBottomOverlay, chromeFadeStyle]}
      >
        <View style={styles.videoControlRow}>
          <CallControlButton
            icon={Mic}
            label="Mute"
            onPress={onToggleMute}
            selected={muted}
            testID="host-video-active-toggle-mute"
          />
          <CallControlButton
            icon={Volume2}
            label="Speaker"
            onPress={onToggleSpeaker}
            selected={speakerEnabled}
            testID="host-video-active-toggle-speaker"
          />
          <CallControlButton
            icon={Camera}
            label="Camera"
            onPress={onToggleCamera}
            selected={cameraEnabled}
            testID="host-video-active-toggle-camera"
          />
          <CallControlButton
            icon={Flag}
            label="Report"
            onPress={onReport}
            testID="host-video-active-report"
          />
        </View>
        <Button
          accessibilityHint="Ends the connected host video call."
          icon={PhoneOff}
          onPress={onEndCall}
          testID="host-video-active-end-call"
          title="End Call"
          variant="destructive"
        />
      </Animated.View>
    </Animated.View>
  );
}

export function HostIncomingCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const initialMode = routeModeFromParam(params.mode);
  const haptics = useHaptics();
  const nowMs = useActiveCallTicker({
    clock: defaultActiveCallClock,
  });
  const [ringingStartedAtMs, setRingingStartedAtMs] = useState(() =>
    readMonotonicNowMs(),
  );
  const [phase, setPhase] = useState<HostCallPhase>(() =>
    initialMode === 'video' ? 'video-ringing' : 'voice-ringing',
  );
  const [answeredAtMs, setAnsweredAtMs] = useState<number | null>(() =>
    initialMode === 'video' ? readMonotonicNowMs() - videoOfferDelayMs : null,
  );
  const [videoOfferDeclined, setVideoOfferDeclined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const answerPulseStyle = usePulseStyle(
    phase === 'voice-ringing' || phase === 'video-ringing',
  );
  const ringingDurationMs = Math.max(0, nowMs - ringingStartedAtMs);
  const answeredDurationMs =
    answeredAtMs === null ? 0 : Math.max(0, nowMs - answeredAtMs);
  const videoOfferRemainingMs = Math.max(
    0,
    videoOfferDelayMs - answeredDurationMs,
  );

  useEffect(() => {
    if (routeModeFromParam(params.mode) !== 'video') {
      return undefined;
    }

    const timeout = setTimeout(() => {
      const atMs = readMonotonicNowMs();

      setAnsweredAtMs(atMs - videoOfferDelayMs);
      setPhase('video-ringing');
      setRingingStartedAtMs(atMs);
      setVideoOfferDeclined(false);
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [params.mode]);

  useEffect(() => {
    if (
      phase !== 'voice-active' ||
      videoOfferDeclined ||
      answeredAtMs === null
    ) {
      return undefined;
    }

    const remainingMs = Math.max(
      0,
      videoOfferDelayMs - Math.max(0, readMonotonicNowMs() - answeredAtMs),
    );
    const timeout = setTimeout(() => {
      setPhase('video-ringing');
      setRingingStartedAtMs(readMonotonicNowMs());
      haptics.warning();
    }, remainingMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [answeredAtMs, haptics, phase, videoOfferDeclined]);

  const closeToDashboard = () => {
    router.replace(appRoutes.hostDashboard.path);
  };
  const answerVoiceCall = () => {
    const atMs = readMonotonicNowMs();

    setAnsweredAtMs(atMs);
    setPhase('voice-active');
    haptics.callAccepted();
  };
  const acceptVideoCall = () => {
    const atMs = readMonotonicNowMs();

    if (answeredAtMs === null) {
      setAnsweredAtMs(atMs - videoOfferDelayMs);
    }

    setCameraEnabled(true);
    setPhase('video-active');
    haptics.callAccepted();
  };
  const declineVoiceCall = () => {
    haptics.reject();
    closeToDashboard();
  };
  const declineVideoCall = () => {
    setVideoOfferDeclined(true);
    setPhase('voice-active');
    haptics.reject();
  };
  const endCall = () => {
    haptics.reject();
    closeToDashboard();
  };

  const activeControls = (
    <View style={styles.activeControls}>
      <View style={styles.controlRow}>
        <CallControlButton
          icon={Mic}
          label="Mute"
          onPress={() => {
            setMuted((current) => !current);
          }}
          selected={muted}
          testID="host-active-toggle-mute"
        />
        <CallControlButton
          icon={Volume2}
          label="Speaker"
          onPress={() => {
            setSpeakerEnabled((current) => !current);
          }}
          selected={speakerEnabled}
          testID="host-active-toggle-speaker"
        />
        <CallControlButton
          icon={Flag}
          label="Report"
          onPress={() => {
            haptics.warning();
          }}
          testID="host-active-report"
        />
      </View>
      <Button
        accessibilityHint="Ends the connected host voice call."
        icon={PhoneOff}
        onPress={endCall}
        testID="host-active-end-call"
        title="End Call"
        variant="destructive"
      />
    </View>
  );

  return (
    <CallScreen
      callTintColor={
        phase === 'video-active'
          ? 'rgba(36,17,27,0.04)'
          : 'rgba(255,250,252,0.10)'
      }
      controlsBorderColor="rgba(255,255,255,0.96)"
      controlsOverlayColor="rgba(255,255,255,0.78)"
      controlsTint="light"
      edges={
        phase === 'video-active'
          ? ['right', 'bottom', 'left']
          : ['top', 'right', 'bottom', 'left']
      }
      controls={
        phase === 'voice-ringing' ? (
          <View style={styles.ringingControls}>
            <Button
              accessibilityHint="Declines the incoming host call."
              icon={PhoneOff}
              onPress={declineVoiceCall}
              style={styles.ringingActionButton}
              testID="host-incoming-decline"
              title="Decline"
              variant="destructive"
            />
            <Animated.View style={[styles.ringingActionWrap, answerPulseStyle]}>
              <Button
                accessibilityHint="Answers the incoming host call."
                icon={PhoneCall}
                onPress={answerVoiceCall}
                style={styles.ringingActionButton}
                testID="host-incoming-answer"
                title="Answer"
              />
            </Animated.View>
          </View>
        ) : phase === 'video-ringing' ? (
          <View style={styles.ringingControls}>
            <Button
              accessibilityHint="Keeps the current voice call active."
              icon={Phone}
              onPress={declineVideoCall}
              style={styles.ringingActionButton}
              testID="host-video-incoming-decline"
              title="Keep Voice"
              variant="secondary"
            />
            <Animated.View style={[styles.ringingActionWrap, answerPulseStyle]}>
              <Button
                accessibilityHint="Accepts the incoming host video call."
                icon={Video}
                onPress={acceptVideoCall}
                style={styles.ringingActionButton}
                testID="host-video-incoming-answer"
                title="Accept Video"
              />
            </Animated.View>
          </View>
        ) : phase === 'video-active' ? undefined : (
          activeControls
        )
      }
      testID={testIdForPhase(phase)}
    >
      {phase === 'voice-ringing' ? (
        <HostVoiceIncomingView
          ringingDurationLabel={`Ringing ${formatActiveCallDuration(
            ringingDurationMs,
          )}`}
        />
      ) : phase === 'voice-active' ? (
        <HostVoiceActiveView
          answeredDurationMs={answeredDurationMs}
          muted={muted}
          speakerEnabled={speakerEnabled}
          videoOfferRemainingMs={videoOfferRemainingMs}
        />
      ) : phase === 'video-ringing' ? (
        <HostVideoIncomingView
          ringingDurationLabel={`Requesting ${formatActiveCallDuration(
            ringingDurationMs,
          )}`}
          voiceDurationLabel={formatActiveCallDuration(answeredDurationMs)}
        />
      ) : (
        <HostVideoActiveView
          answeredDurationMs={answeredDurationMs}
          cameraEnabled={cameraEnabled}
          muted={muted}
          onEndCall={endCall}
          onReport={() => {
            haptics.warning();
          }}
          onToggleCamera={() => {
            setCameraEnabled((current) => !current);
          }}
          onToggleMute={() => {
            setMuted((current) => !current);
          }}
          onToggleSpeaker={() => {
            setSpeakerEnabled((current) => !current);
          }}
          speakerEnabled={speakerEnabled}
        />
      )}
    </CallScreen>
  );
}

const styles = StyleSheet.create({
  activeCallerName: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  activeContent: {
    gap: ui.spacing[3],
    justifyContent: 'flex-start',
  },
  activeControls: {
    gap: ui.spacing[3],
  },
  avatarRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: ui.radii.full,
    borderWidth: 5,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
    position: 'absolute',
  },
  avatarRingCompact: {
    borderWidth: 4,
    padding: 3,
  },
  callerHaloInner: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: ui.radii.full,
    position: 'absolute',
  },
  callerHaloOuter: {
    backgroundColor: 'rgba(201,54,116,0.10)',
    borderColor: 'rgba(201,54,116,0.18)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    position: 'absolute',
  },
  callerMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  callerName: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  callerStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerStageCompact: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: ui.spacing[4],
    justifyContent: 'space-between',
    padding: ui.spacing[4],
  },
  contextBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  contextCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  contextIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  contextTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
    justifyContent: 'center',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  detailIconCompact: {
    height: 34,
    width: 34,
  },
  detailLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  detailLabelCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  detailPill: {
    alignItems: 'center',
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: ui.spacing[3],
    minWidth: 150,
    padding: ui.spacing[3],
  },
  detailPillCompact: {
    gap: ui.spacing[2],
    minWidth: 142,
    padding: ui.spacing[2],
  },
  detailValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  heroCard: {
    alignItems: 'center',
    gap: ui.spacing[3],
  },
  heroCardCompact: {
    flexDirection: 'row',
    padding: ui.spacing[3],
  },
  heroCopy: {
    alignItems: 'center',
    flex: 1,
    gap: ui.spacing[1],
    minWidth: 0,
  },
  heroEyebrow: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'uppercase',
  },
  logoSubtext: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  logoText: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  metricCard: {
    flex: 1,
    gap: ui.spacing[1],
    minWidth: 0,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  metricLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.title.lineHeight,
  },
  metricValueCompact: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  networkCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
    padding: ui.spacing[3],
  },
  networkCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  orbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringingActionButton: {
    flex: 1,
    minWidth: 132,
  },
  ringingActionWrap: {
    flex: 1,
    minWidth: 132,
  },
  ringingControls: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  ringingTime: {
    color: ui.color.status.success,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topStatus: {
    alignItems: 'flex-end',
    gap: ui.spacing[1],
  },
  topTimer: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  unlockFill: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
  },
  unlockTrack: {
    backgroundColor: 'rgba(201,54,116,0.12)',
    borderRadius: ui.radii.full,
    flexDirection: 'row',
    height: 7,
    marginTop: ui.spacing[2],
    overflow: 'hidden',
  },
  videoActiveBottomOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(31,20,32,0.54)',
    borderColor: 'rgba(255,255,255,0.56)',
    borderRadius: 28,
    borderWidth: 1,
    bottom: ui.spacing[3],
    gap: ui.spacing[3],
    left: ui.spacing[3],
    padding: ui.spacing[3],
    position: 'absolute',
    right: ui.spacing[3],
    zIndex: 5,
  },
  videoActiveCallerName: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 30,
    lineHeight: 36,
    textShadowColor: 'rgba(31,20,32,0.32)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 8,
  },
  videoActiveGlowBottom: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderRadius: 170,
    bottom: 120,
    height: 340,
    position: 'absolute',
    right: -160,
    width: 340,
  },
  videoActiveGlowTop: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 140,
    height: 280,
    left: -130,
    position: 'absolute',
    top: 130,
    width: 280,
  },
  videoActiveScreen: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  videoActiveTimer: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 42,
    fontVariant: ['tabular-nums'],
    lineHeight: 48,
    textShadowColor: 'rgba(31,20,32,0.28)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 10,
  },
  videoActiveTopCopy: {
    alignItems: 'flex-start',
    gap: ui.spacing[2],
    minWidth: 0,
  },
  videoActiveTopOverlay: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
    left: ui.spacing[4],
    position: 'absolute',
    right: ui.spacing[4],
    top: 56,
    zIndex: 5,
  },
  videoControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
    justifyContent: 'center',
  },
  videoRemoteAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    borderColor: 'rgba(255,255,255,0.92)',
    borderRadius: 58,
    borderWidth: 5,
    height: 116,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 116,
    zIndex: 2,
  },
  videoRemoteFocus: {
    alignItems: 'center',
    height: 340,
    justifyContent: 'center',
    width: 340,
  },
  videoRemoteRingInner: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 106,
    borderWidth: 1,
    height: 212,
    position: 'absolute',
    width: 212,
  },
  videoRemoteRingOuter: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.38)',
    borderRadius: 160,
    borderWidth: 1,
    height: 320,
    position: 'absolute',
    width: 320,
  },
  videoRemoteStage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100,
    paddingTop: 88,
  },
  videoSelfIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: ui.radii.full,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  videoSelfPreview: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderColor: 'rgba(255,255,255,0.86)',
    borderRadius: 26,
    borderWidth: 1,
    gap: ui.spacing[2],
    minHeight: 128,
    minWidth: 104,
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[3],
    position: 'absolute',
    right: ui.spacing[4],
    top: 148,
    zIndex: 6,
  },
  videoSelfText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  videoUnlockCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[3],
  },
  waveformInline: {
    alignSelf: 'center',
    height: 58,
  },
});
