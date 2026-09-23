import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import { setAudioModeAsync } from 'expo-audio';
import {
  NativeModules,
  Platform,
  UIManager,
  requireNativeComponent,
  type ViewProps,
} from 'react-native';
import { z } from 'zod';

import { type ConnectionQuality } from '@connecto/domain';

import type {
  ActiveCallCameraFacing,
  ActiveVoiceCallSession,
} from '@/store/call.store';
import { useDevelopmentScenarioStore } from '@/store/development.store';

import type {
  ActiveCallSessionPatch,
  ActiveCallTelemetryInput,
  ActiveCallTelemetrySnapshot,
  RemoteVideoConnectedResult,
  SessionMediaMode,
  VideoUpgradeInput,
} from './active-call.models';
import type { CallRuntimeConfig } from './call.preconnect';

const audioLevelFloor = 0.08;
const remoteVideoSurfaceViewName = 'ConnectoRemoteVideoSurfaceView';

const connectionQualitySchema = z.enum([
  'excellent',
  'good',
  'offline',
  'poor',
  'reconnecting',
]);

const activeCallTelemetrySchema = z.object({
  audioLevel: z.number().min(0).max(1).optional(),
  cameraEnabled: z.boolean().optional(),
  cameraFacing: z.enum(['back', 'front']).optional(),
  mediaMode: z.enum(['video', 'voice']).optional(),
  mediaResourceReady: z.boolean().optional(),
  muted: z.boolean().optional(),
  networkQuality: connectionQualitySchema.optional(),
  remoteCameraEnabled: z.boolean().optional(),
  remoteVideoConnected: z.boolean().optional(),
  speakerEnabled: z.boolean().optional(),
});

type SessionControlState = {
  cameraEnabled: boolean;
  cameraFacing: ActiveCallCameraFacing;
  connected: boolean;
  mediaMode: SessionMediaMode;
  muted: boolean;
  remoteCameraEnabled: boolean;
  speakerEnabled: boolean;
};

type ActiveCallNativeBridgeTelemetry = Partial<{
  audioLevel: number;
  cameraEnabled: boolean;
  cameraFacing: ActiveCallCameraFacing;
  mediaMode: SessionMediaMode;
  mediaResourceReady: boolean;
  muted: boolean;
  networkQuality: ConnectionQuality;
  remoteCameraEnabled: boolean;
  remoteVideoConnected: boolean;
  speakerEnabled: boolean;
}>;

type NativeBridgeSessionPayload = {
  agoraAppId: string;
  callId: string;
  mediaResourceId: string;
  rtcChannelName: string;
  rtcToken: string;
  sessionId: string;
};

type NativeBridgeVideoPayload = NativeBridgeSessionPayload & {
  tokenExpiresAtIso: string;
  videoRequestId: string;
};

export type ActiveCallMediaBridgeMode = 'expo' | 'mock' | 'native';

export type ActiveCallSurfaceSupport = {
  localPreview: 'camera-view' | 'placeholder';
  remoteVideo: 'native-surface' | 'placeholder';
};

export interface ActiveCallMediaBridge {
  activateVideoMode(
    input: VideoUpgradeInput & {
      sessionPatch: ActiveCallSessionPatch;
      videoRequestId: string;
    },
  ): Promise<void>;
  connectSession(input: { session: ActiveVoiceCallSession }): Promise<void>;
  disconnectSession(input: { session: ActiveVoiceCallSession }): Promise<void>;
  downgradeToVoice(input: { session: ActiveVoiceCallSession }): Promise<void>;
  getSurfaceSupport(): ActiveCallSurfaceSupport;
  readTelemetry(
    input: ActiveCallTelemetryInput,
  ): Promise<ActiveCallTelemetrySnapshot>;
  setCameraEnabled(input: {
    cameraEnabled: boolean;
    session: ActiveVoiceCallSession;
  }): Promise<void>;
  setMuted(input: {
    muted: boolean;
    session: ActiveVoiceCallSession;
  }): Promise<void>;
  setSpeakerEnabled(input: {
    session: ActiveVoiceCallSession;
    speakerEnabled: boolean;
  }): Promise<void>;
  switchCamera(input: {
    session: ActiveVoiceCallSession;
  }): Promise<ActiveCallCameraFacing>;
  waitForRemoteVideoConnected(
    input: VideoUpgradeInput,
  ): Promise<RemoteVideoConnectedResult>;
}

export type ActiveCallNativeBridge = {
  connectSession?: (payload: NativeBridgeSessionPayload) => Promise<void>;
  disconnectSession?: (sessionId: string) => Promise<void>;
  downgradeToVoice?: (sessionId: string) => Promise<void>;
  getTelemetry?: (
    sessionId: string,
  ) => Promise<ActiveCallNativeBridgeTelemetry>;
  setCameraEnabled?: (
    sessionId: string,
    cameraEnabled: boolean,
  ) => Promise<void>;
  setMuted?: (sessionId: string, muted: boolean) => Promise<void>;
  setSpeakerEnabled?: (
    sessionId: string,
    speakerEnabled: boolean,
  ) => Promise<void>;
  switchCamera?: (
    sessionId: string,
  ) => Promise<ActiveCallCameraFacing | undefined>;
  upgradeToVideo?: (payload: NativeBridgeVideoPayload) => Promise<void>;
  waitForRemoteVideoConnected?: (sessionId: string) => Promise<void>;
};

type NativeRemoteVideoSurfaceProps = ViewProps & {
  sessionId: string;
};

const hasNativeRemoteVideoSurfaceView = (() => {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    return Boolean(UIManager.getViewManagerConfig(remoteVideoSurfaceViewName));
  } catch {
    return false;
  }
})();

const NativeRemoteVideoSurfaceComponent = hasNativeRemoteVideoSurfaceView
  ? requireNativeComponent<NativeRemoteVideoSurfaceProps>(
      remoteVideoSurfaceViewName,
    )
  : null;

const abortReasonAsError = (signal: AbortSignal) =>
  signal.reason instanceof Error
    ? signal.reason
    : new Error('operation-aborted');

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(abortReasonAsError(signal));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        reject(abortReasonAsError(signal));
      },
      { once: true },
    );
  });

const defaultSessionState = (): SessionControlState => ({
  cameraEnabled: true,
  cameraFacing: 'front',
  connected: false,
  mediaMode: 'voice',
  muted: false,
  remoteCameraEnabled: false,
  speakerEnabled: false,
});

const callAudioMode = (speakerEnabled: boolean) => ({
  allowsBackgroundRecording: false,
  allowsRecording: true,
  interruptionMode: 'doNotMix' as const,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: !speakerEnabled,
});

const clampAudioLevel = (value: number | undefined, muted: boolean) => {
  if (muted) {
    return audioLevelFloor;
  }

  if (value === undefined || !Number.isFinite(value)) {
    return audioLevelFloor;
  }

  return Math.max(0, Math.min(1, value));
};

const mapNetInfoToQuality = (
  state: Awaited<ReturnType<typeof NetInfo.fetch>>,
): ConnectionQuality => {
  if (state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }

  if (state.type === NetInfoStateType.wifi) {
    return 'excellent';
  }

  if (state.type === NetInfoStateType.cellular) {
    return 'good';
  }

  if (state.type === NetInfoStateType.unknown) {
    return 'poor';
  }

  return 'good';
};

const parseNativeBridge = (value: unknown): ActiveCallNativeBridge | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const hasMethod = (name: keyof ActiveCallNativeBridge) =>
    typeof candidate[name] === 'function';

  if (
    !hasMethod('connectSession') &&
    !hasMethod('disconnectSession') &&
    !hasMethod('getTelemetry') &&
    !hasMethod('upgradeToVideo')
  ) {
    return null;
  }

  const bridge: ActiveCallNativeBridge = {};

  if (hasMethod('connectSession')) {
    bridge.connectSession = candidate.connectSession as NonNullable<
      ActiveCallNativeBridge['connectSession']
    >;
  }

  if (hasMethod('disconnectSession')) {
    bridge.disconnectSession = candidate.disconnectSession as NonNullable<
      ActiveCallNativeBridge['disconnectSession']
    >;
  }

  if (hasMethod('downgradeToVoice')) {
    bridge.downgradeToVoice = candidate.downgradeToVoice as NonNullable<
      ActiveCallNativeBridge['downgradeToVoice']
    >;
  }

  if (hasMethod('getTelemetry')) {
    bridge.getTelemetry = candidate.getTelemetry as NonNullable<
      ActiveCallNativeBridge['getTelemetry']
    >;
  }

  if (hasMethod('setCameraEnabled')) {
    bridge.setCameraEnabled = candidate.setCameraEnabled as NonNullable<
      ActiveCallNativeBridge['setCameraEnabled']
    >;
  }

  if (hasMethod('setMuted')) {
    bridge.setMuted = candidate.setMuted as NonNullable<
      ActiveCallNativeBridge['setMuted']
    >;
  }

  if (hasMethod('setSpeakerEnabled')) {
    bridge.setSpeakerEnabled = candidate.setSpeakerEnabled as NonNullable<
      ActiveCallNativeBridge['setSpeakerEnabled']
    >;
  }

  if (hasMethod('switchCamera')) {
    bridge.switchCamera = candidate.switchCamera as NonNullable<
      ActiveCallNativeBridge['switchCamera']
    >;
  }

  if (hasMethod('upgradeToVideo')) {
    bridge.upgradeToVideo = candidate.upgradeToVideo as NonNullable<
      ActiveCallNativeBridge['upgradeToVideo']
    >;
  }

  if (hasMethod('waitForRemoteVideoConnected')) {
    bridge.waitForRemoteVideoConnected =
      candidate.waitForRemoteVideoConnected as NonNullable<
        ActiveCallNativeBridge['waitForRemoteVideoConnected']
      >;
  }

  return bridge;
};

const readNativeBridge = (
  providedBridge?: ActiveCallNativeBridge | null,
): ActiveCallNativeBridge | null => {
  if (providedBridge !== undefined) {
    return providedBridge;
  }

  const modules = NativeModules as {
    ConnectoActiveCallBridge?: unknown;
  };

  return parseNativeBridge(modules.ConnectoActiveCallBridge);
};

const createNativeSessionPayload = (
  session: ActiveVoiceCallSession,
  patch: ActiveCallSessionPatch = {},
): NativeBridgeSessionPayload => ({
  agoraAppId: session.agoraAppId,
  callId: session.callId,
  mediaResourceId: session.mediaResourceId,
  rtcChannelName: session.rtcChannelName,
  rtcToken: patch.rtcToken ?? session.rtcToken,
  sessionId: session.id,
});

const createTelemetrySnapshot = (
  state: SessionControlState,
  nowIso: string,
  overrides: Partial<ActiveCallTelemetrySnapshot> = {},
): ActiveCallTelemetrySnapshot => ({
  audioLevel: audioLevelFloor,
  cameraEnabled: state.cameraEnabled,
  cameraFacing: state.cameraFacing,
  mediaMode: state.mediaMode,
  mediaResourceReady: state.connected,
  muted: state.muted,
  networkQuality: 'good',
  remoteCameraEnabled: state.remoteCameraEnabled,
  remoteVideoConnected: state.mediaMode === 'video',
  speakerEnabled: state.speakerEnabled,
  updatedAtIso: nowIso,
  ...overrides,
});

export const hasNativeRemoteVideoSurface = () =>
  NativeRemoteVideoSurfaceComponent !== null;

export const ActiveCallRemoteVideoSurface = ({
  sessionId,
  ...props
}: NativeRemoteVideoSurfaceProps) => {
  const Surface = NativeRemoteVideoSurfaceComponent;

  if (Surface === null) {
    return null;
  }

  return <Surface sessionId={sessionId} {...props} />;
};

export const createMockActiveCallMediaBridge = ({
  getScenario = () => useDevelopmentScenarioStore.getState().scenario,
  now = () => new Date(),
  runtimeConfig,
}: {
  getScenario?: () => {
    networkQuality: ConnectionQuality;
  };
  now?: () => Date;
  runtimeConfig: CallRuntimeConfig;
}): ActiveCallMediaBridge => {
  const sessionState = new Map<string, SessionControlState>();

  const ensureSessionState = (sessionId: string) => {
    const existing = sessionState.get(sessionId);

    if (existing !== undefined) {
      return existing;
    }

    const next = defaultSessionState();
    sessionState.set(sessionId, next);
    return next;
  };

  return {
    activateVideoMode({ session }) {
      const state = ensureSessionState(session.id);
      state.cameraEnabled = true;
      state.remoteCameraEnabled = false;
      return Promise.resolve();
    },
    connectSession({ session }) {
      const state = ensureSessionState(session.id);
      state.connected = true;
      return Promise.resolve();
    },
    disconnectSession({ session }) {
      sessionState.delete(session.id);
      return Promise.resolve();
    },
    downgradeToVoice({ session }) {
      const state = ensureSessionState(session.id);
      state.cameraEnabled = false;
      state.mediaMode = 'voice';
      state.remoteCameraEnabled = false;
      return Promise.resolve();
    },
    getSurfaceSupport: () => ({
      localPreview: 'placeholder',
      remoteVideo: 'placeholder',
    }),
    readTelemetry({ session }) {
      const state = ensureSessionState(session.id);
      const quality = getScenario().networkQuality;
      const baseLevel =
        quality === 'excellent'
          ? 0.8
          : quality === 'good'
            ? 0.62
            : quality === 'poor'
              ? 0.34
              : quality === 'reconnecting'
                ? 0.18
                : audioLevelFloor;

      return Promise.resolve(
        createTelemetrySnapshot(state, now().toISOString(), {
          audioLevel: clampAudioLevel(baseLevel, state.muted),
          networkQuality: quality,
          remoteCameraEnabled:
            state.mediaMode === 'video' ? state.remoteCameraEnabled : false,
          remoteVideoConnected: state.mediaMode === 'video',
        }),
      );
    },
    setCameraEnabled({ cameraEnabled, session }) {
      const state = ensureSessionState(session.id);
      state.cameraEnabled = cameraEnabled;
      return Promise.resolve();
    },
    setMuted({ muted, session }) {
      const state = ensureSessionState(session.id);
      state.muted = muted;
      return Promise.resolve();
    },
    setSpeakerEnabled({ session, speakerEnabled }) {
      const state = ensureSessionState(session.id);
      state.speakerEnabled = speakerEnabled;
      return Promise.resolve();
    },
    switchCamera({ session }) {
      const state = ensureSessionState(session.id);
      state.cameraFacing = state.cameraFacing === 'front' ? 'back' : 'front';
      return Promise.resolve(state.cameraFacing);
    },
    async waitForRemoteVideoConnected({ session, signal }) {
      await wait(runtimeConfig.videoConnectDelayMs, signal);

      if (runtimeConfig.videoConnectOutcome === 'failed') {
        throw new Error(
          'Remote video could not connect. Continuing the call in voice mode.',
        );
      }

      const state = ensureSessionState(session.id);
      state.mediaMode = 'video';
      state.remoteCameraEnabled = true;

      return {
        connectedAtIso: now().toISOString(),
      };
    },
  };
};

export const createNativeActiveCallMediaBridge = ({
  activeCallMediaBridgeMode,
  audioMeteringEnabled,
  nativeBridge,
  netInfo = NetInfo,
  now = () => new Date(),
}: {
  activeCallMediaBridgeMode: ActiveCallMediaBridgeMode;
  audioMeteringEnabled: boolean;
  nativeBridge?: ActiveCallNativeBridge | null;
  netInfo?: Pick<typeof NetInfo, 'fetch'>;
  now?: () => Date;
}): ActiveCallMediaBridge => {
  const bridge = readNativeBridge(nativeBridge);
  const sessionState = new Map<string, SessionControlState>();

  const ensureSessionState = (sessionId: string) => {
    const existing = sessionState.get(sessionId);

    if (existing !== undefined) {
      return existing;
    }

    const next = defaultSessionState();
    sessionState.set(sessionId, next);
    return next;
  };

  const readNetworkQuality = async () => {
    const state = await netInfo.fetch();
    return mapNetInfoToQuality(state);
  };

  return {
    async activateVideoMode({ session, sessionPatch, videoRequestId }) {
      const state = ensureSessionState(session.id);

      if (bridge?.upgradeToVideo !== undefined) {
        await bridge.upgradeToVideo({
          ...createNativeSessionPayload(session, sessionPatch),
          tokenExpiresAtIso:
            sessionPatch.tokenExpiresAtIso ?? session.tokenExpiresAtIso,
          videoRequestId,
        });
      }

      state.cameraEnabled = true;
    },
    async connectSession({ session }) {
      const state = ensureSessionState(session.id);

      if (state.connected) {
        return;
      }

      if (bridge?.connectSession !== undefined) {
        await bridge.connectSession(createNativeSessionPayload(session));
      }

      state.connected = true;
    },
    async disconnectSession({ session }) {
      if (bridge?.disconnectSession !== undefined) {
        await bridge.disconnectSession(session.id);
      }

      sessionState.delete(session.id);
    },
    async downgradeToVoice({ session }) {
      const state = ensureSessionState(session.id);

      if (bridge?.downgradeToVoice !== undefined) {
        await bridge.downgradeToVoice(session.id);
      }

      state.cameraEnabled = false;
      state.mediaMode = 'voice';
      state.remoteCameraEnabled = false;
    },
    getSurfaceSupport: () => ({
      localPreview:
        activeCallMediaBridgeMode === 'mock' ? 'placeholder' : 'camera-view',
      remoteVideo: hasNativeRemoteVideoSurface()
        ? 'native-surface'
        : 'placeholder',
    }),
    async readTelemetry({ session }) {
      const state = ensureSessionState(session.id);
      const nativeTelemetry =
        bridge?.getTelemetry === undefined
          ? null
          : activeCallTelemetrySchema.parse(
              await bridge.getTelemetry(session.id),
            );
      const networkQuality =
        nativeTelemetry?.networkQuality ?? (await readNetworkQuality());
      const audioLevel =
        audioMeteringEnabled && nativeTelemetry?.audioLevel !== undefined
          ? nativeTelemetry.audioLevel
          : undefined;

      return createTelemetrySnapshot(state, now().toISOString(), {
        audioLevel: clampAudioLevel(audioLevel, state.muted),
        cameraEnabled: nativeTelemetry?.cameraEnabled ?? state.cameraEnabled,
        cameraFacing: nativeTelemetry?.cameraFacing ?? state.cameraFacing,
        mediaMode: nativeTelemetry?.mediaMode ?? state.mediaMode,
        mediaResourceReady:
          nativeTelemetry?.mediaResourceReady ?? state.connected,
        muted: nativeTelemetry?.muted ?? state.muted,
        networkQuality,
        remoteCameraEnabled:
          nativeTelemetry?.remoteCameraEnabled ?? state.remoteCameraEnabled,
        remoteVideoConnected:
          nativeTelemetry?.remoteVideoConnected ?? state.mediaMode === 'video',
        speakerEnabled: nativeTelemetry?.speakerEnabled ?? state.speakerEnabled,
      });
    },
    async setCameraEnabled({ cameraEnabled, session }) {
      const state = ensureSessionState(session.id);

      if (bridge?.setCameraEnabled !== undefined) {
        await bridge.setCameraEnabled(session.id, cameraEnabled);
      }

      state.cameraEnabled = cameraEnabled;
    },
    async setMuted({ muted, session }) {
      const state = ensureSessionState(session.id);

      if (bridge?.setMuted !== undefined) {
        await bridge.setMuted(session.id, muted);
      }

      state.muted = muted;
    },
    async setSpeakerEnabled({ session, speakerEnabled }) {
      const state = ensureSessionState(session.id);

      await setAudioModeAsync(callAudioMode(speakerEnabled));

      if (bridge?.setSpeakerEnabled !== undefined) {
        await bridge.setSpeakerEnabled(session.id, speakerEnabled);
      }

      state.speakerEnabled = speakerEnabled;
    },
    async switchCamera({ session }) {
      const state = ensureSessionState(session.id);

      const nextFacing =
        bridge?.switchCamera === undefined
          ? state.cameraFacing === 'front'
            ? 'back'
            : 'front'
          : await bridge.switchCamera(session.id);

      state.cameraFacing =
        nextFacing === 'back' || nextFacing === 'front'
          ? nextFacing
          : state.cameraFacing === 'front'
            ? 'back'
            : 'front';

      return state.cameraFacing;
    },
    async waitForRemoteVideoConnected({ session, signal }) {
      const state = ensureSessionState(session.id);

      if (bridge?.waitForRemoteVideoConnected !== undefined) {
        await bridge.waitForRemoteVideoConnected(session.id);
      } else {
        await wait(1_200, signal);
      }

      if (signal?.aborted === true) {
        throw abortReasonAsError(signal);
      }

      state.mediaMode = 'video';
      state.remoteCameraEnabled = true;

      return {
        connectedAtIso: now().toISOString(),
      };
    },
  };
};
