import {
  transitionActiveCall,
  transitionOutgoingCall,
  type ActiveCallEvent,
  type ActiveCallState,
  type CallState,
  type Language,
  type Money,
  type OutgoingCallEvent,
  type OutgoingCallState,
} from '@connecto/domain';
import { create } from 'zustand';

export const activeCallUnlockDurationMs = 180_000;
export const activeCallEndConfirmationDurationMs = 30_000;
export const activeCallTickerIntervalMs = 1_000;

export type ConnectedActiveCallState = Exclude<
  ActiveCallState,
  'ended' | 'reconnecting'
>;

export type ActiveVoiceCallSession = {
  agoraAppId: string;
  callId: string;
  customerId: string;
  hostAge: number;
  hostId: string;
  hostLanguage: Language;
  hostName: string;
  hostProfileImageUri?: string;
  id: string;
  mediaResourceId: string;
  provider: 'agora' | 'mock';
  rtcChannelName: string;
  rtcToken: string;
  startedAtIso: string;
  tokenExpiresAtIso: string;
  videoAvailableAfterMinutes: number;
  videoRate: Money;
  voiceRate: Money;
};

export type ActiveCallCameraFacing = 'back' | 'front';

export type ActiveCallSelfPreviewPosition = {
  x: number;
  y: number;
};

export type ActiveCallControls = {
  cameraEnabled: boolean;
  cameraFacing: ActiveCallCameraFacing;
  muted: boolean;
  speakerEnabled: boolean;
};

export type ActiveCallRuntime = {
  connectedAccumulatedMs: number;
  connectedSinceMs: number | null;
  lastNowMs: number;
  reconnectStartedAtMs: number | null;
  reconnectTarget: ConnectedActiveCallState;
  selfPreviewPosition: ActiveCallSelfPreviewPosition | null;
  videoAccumulatedMs: number;
  videoSinceMs: number | null;
  videoUnlockCelebratedAtMs: number | null;
  videoUnlockEmittedAtMs: number | null;
};

export type CallStoreSnapshot = {
  activeControls: ActiveCallControls;
  activeRuntime: ActiveCallRuntime | null;
  activeSession: ActiveVoiceCallSession | null;
  activeState: ActiveCallState | null;
  activeCallId: string | null;
  outgoingState: OutgoingCallState;
  state: CallState | null;
};

const connectedActiveStates = new Set<ConnectedActiveCallState>([
  'video',
  'video-rejected',
  'video-requested',
  'voice',
  'voice-eligible',
  'voice-locked',
]);

const defaultActiveCallControls: ActiveCallControls = {
  cameraEnabled: true,
  cameraFacing: 'front',
  muted: false,
  speakerEnabled: false,
};

export const initialCallStore: CallStoreSnapshot = {
  activeControls: defaultActiveCallControls,
  activeRuntime: null,
  activeSession: null,
  activeState: null,
  activeCallId: null,
  outgoingState: 'idle',
  state: null,
};

export const readMonotonicNowMs = () =>
  typeof globalThis.performance.now === 'function'
    ? globalThis.performance.now()
    : Date.now();

export const isConnectedActiveCallState = (
  state: ActiveCallState | null,
): state is ConnectedActiveCallState =>
  state !== null &&
  connectedActiveStates.has(state as ConnectedActiveCallState);

const callStateForActiveState = (state: ActiveCallState): CallState =>
  state === 'voice-locked'
    ? 'video-locked'
    : state === 'video-requested'
      ? 'video-requested'
      : state === 'video'
        ? 'connected-video'
        : state === 'reconnecting'
          ? 'reconnecting'
          : state === 'ended'
            ? 'ended'
            : 'connected-voice';

const restoreEventForState = (
  state: ConnectedActiveCallState,
): ActiveCallEvent =>
  state === 'voice-locked'
    ? 'connection-restored-voice-locked'
    : state === 'voice-eligible'
      ? 'connection-restored-voice-eligible'
      : state === 'voice'
        ? 'connection-restored-voice'
        : state === 'video-requested'
          ? 'connection-restored-video-requested'
          : state === 'video-rejected'
            ? 'connection-restored-video-rejected'
            : 'connection-restored-video';

const normalizeActiveCallNowMs = (runtime: ActiveCallRuntime, nowMs: number) =>
  Math.max(0, nowMs, runtime.lastNowMs, runtime.connectedSinceMs ?? 0);

const createActiveCallRuntime = (nowMs: number): ActiveCallRuntime => ({
  connectedAccumulatedMs: 0,
  connectedSinceMs: nowMs,
  lastNowMs: nowMs,
  reconnectStartedAtMs: null,
  reconnectTarget: 'voice-locked',
  selfPreviewPosition: null,
  videoAccumulatedMs: 0,
  videoSinceMs: null,
  videoUnlockCelebratedAtMs: null,
  videoUnlockEmittedAtMs: null,
});

export const transitionOutgoingCallStore = (
  snapshot: CallStoreSnapshot,
  event: OutgoingCallEvent,
): CallStoreSnapshot => ({
  ...snapshot,
  outgoingState: transitionOutgoingCall(snapshot.outgoingState, event),
});

export const getActiveCallConnectedDurationMs = (
  snapshot: CallStoreSnapshot,
  nowMs: number,
) => {
  if (snapshot.activeRuntime === null || snapshot.activeState === null) {
    return 0;
  }

  const normalizedNow = normalizeActiveCallNowMs(snapshot.activeRuntime, nowMs);
  const liveConnectedMs =
    isConnectedActiveCallState(snapshot.activeState) &&
    snapshot.activeRuntime.connectedSinceMs !== null
      ? normalizedNow - snapshot.activeRuntime.connectedSinceMs
      : 0;

  return Math.max(
    0,
    snapshot.activeRuntime.connectedAccumulatedMs + liveConnectedMs,
  );
};

export const getActiveCallVideoDurationMs = (
  snapshot: CallStoreSnapshot,
  nowMs: number,
) => {
  if (snapshot.activeRuntime === null) {
    return 0;
  }

  const normalizedNow = normalizeActiveCallNowMs(snapshot.activeRuntime, nowMs);
  const liveVideoMs =
    snapshot.activeState === 'video' &&
    snapshot.activeRuntime.videoSinceMs !== null
      ? normalizedNow - snapshot.activeRuntime.videoSinceMs
      : 0;

  return Math.max(0, snapshot.activeRuntime.videoAccumulatedMs + liveVideoMs);
};

export const getActiveCallVideoUnlockRemainingMs = (
  snapshot: CallStoreSnapshot,
  nowMs: number,
) =>
  Math.max(
    0,
    activeCallUnlockDurationMs -
      getActiveCallConnectedDurationMs(snapshot, nowMs),
  );

export const startActiveCallStore = (
  snapshot: CallStoreSnapshot,
  activeCallId: string,
  activeSession: ActiveVoiceCallSession | null = null,
  nowMs = 0,
): CallStoreSnapshot => {
  const normalizedNow = Math.max(0, nowMs);

  return {
    ...snapshot,
    activeCallId,
    activeControls: defaultActiveCallControls,
    activeRuntime: createActiveCallRuntime(normalizedNow),
    activeSession,
    activeState: 'voice-locked',
    state: callStateForActiveState('voice-locked'),
  };
};

export const syncActiveCallStore = (
  snapshot: CallStoreSnapshot,
  nowMs: number,
): CallStoreSnapshot => {
  if (snapshot.activeRuntime === null || snapshot.activeState === null) {
    return snapshot;
  }

  const normalizedNow = normalizeActiveCallNowMs(snapshot.activeRuntime, nowMs);
  const connectedDurationMs = getActiveCallConnectedDurationMs(
    snapshot,
    normalizedNow,
  );
  const baseRuntime: ActiveCallRuntime = {
    ...snapshot.activeRuntime,
    lastNowMs: normalizedNow,
    reconnectTarget: isConnectedActiveCallState(snapshot.activeState)
      ? snapshot.activeState
      : snapshot.activeRuntime.reconnectTarget,
  };

  if (
    snapshot.activeState === 'voice-locked' &&
    connectedDurationMs >= activeCallUnlockDurationMs
  ) {
    return {
      ...snapshot,
      activeRuntime: {
        ...baseRuntime,
        reconnectTarget: 'voice-eligible',
        videoUnlockEmittedAtMs:
          baseRuntime.videoUnlockEmittedAtMs ?? normalizedNow,
      },
      activeState: transitionActiveCall(snapshot.activeState, 'unlock-video'),
      state: callStateForActiveState('voice-eligible'),
    };
  }

  if (
    connectedDurationMs >= activeCallUnlockDurationMs &&
    baseRuntime.videoUnlockEmittedAtMs === null
  ) {
    return {
      ...snapshot,
      activeRuntime: {
        ...baseRuntime,
        videoUnlockEmittedAtMs: normalizedNow,
      },
    };
  }

  if (baseRuntime.lastNowMs === snapshot.activeRuntime.lastNowMs) {
    return snapshot;
  }

  return {
    ...snapshot,
    activeRuntime: baseRuntime,
  };
};

export const transitionActiveCallStore = (
  snapshot: CallStoreSnapshot,
  event: ActiveCallEvent,
  nowMs = 0,
): CallStoreSnapshot => {
  if (snapshot.activeState === null || snapshot.activeRuntime === null) {
    throw new Error('active call cannot transition before it starts');
  }

  const current = syncActiveCallStore(snapshot, nowMs);
  const runtime = current.activeRuntime;
  const currentState = current.activeState;

  if (runtime === null || currentState === null) {
    throw new Error('active call cannot transition before it starts');
  }

  const normalizedNow = normalizeActiveCallNowMs(runtime, nowMs);
  const nextState = transitionActiveCall(currentState, event);
  const connectedDurationMs = getActiveCallConnectedDurationMs(
    current,
    normalizedNow,
  );
  const videoDurationMs = getActiveCallVideoDurationMs(current, normalizedNow);
  const currentlyConnected = isConnectedActiveCallState(currentState);
  const nextConnected = isConnectedActiveCallState(nextState);
  const videoCurrentlyConnected = currentState === 'video';
  const videoNextConnected = nextState === 'video';

  const nextRuntime: ActiveCallRuntime = {
    ...runtime,
    connectedAccumulatedMs:
      currentlyConnected && !nextConnected
        ? connectedDurationMs
        : runtime.connectedAccumulatedMs,
    connectedSinceMs:
      currentlyConnected && !nextConnected
        ? null
        : !currentlyConnected && nextConnected
          ? normalizedNow
          : nextConnected && runtime.connectedSinceMs === null
            ? normalizedNow
            : runtime.connectedSinceMs,
    lastNowMs: normalizedNow,
    videoAccumulatedMs:
      videoCurrentlyConnected && !videoNextConnected
        ? videoDurationMs
        : runtime.videoAccumulatedMs,
    videoSinceMs:
      videoCurrentlyConnected && !videoNextConnected
        ? null
        : !videoCurrentlyConnected && videoNextConnected
          ? normalizedNow
          : videoNextConnected && runtime.videoSinceMs === null
            ? normalizedNow
            : runtime.videoSinceMs,
    reconnectStartedAtMs:
      nextState === 'reconnecting'
        ? (runtime.reconnectStartedAtMs ?? normalizedNow)
        : null,
    reconnectTarget:
      nextState === 'reconnecting'
        ? currentlyConnected
          ? currentState
          : runtime.reconnectTarget
        : nextConnected
          ? nextState
          : runtime.reconnectTarget,
  };

  return syncActiveCallStore(
    {
      ...current,
      activeRuntime: nextRuntime,
      activeState: nextState,
      state: callStateForActiveState(nextState),
    },
    normalizedNow,
  );
};

export const restoreActiveCallStore = (
  snapshot: CallStoreSnapshot,
  nowMs = 0,
): CallStoreSnapshot => {
  if (
    snapshot.activeState !== 'reconnecting' ||
    snapshot.activeRuntime === null
  ) {
    return snapshot;
  }

  return transitionActiveCallStore(
    snapshot,
    restoreEventForState(snapshot.activeRuntime.reconnectTarget),
    nowMs,
  );
};

export const markVideoUnlockCelebratedStore = (
  snapshot: CallStoreSnapshot,
  nowMs: number,
): CallStoreSnapshot => {
  if (snapshot.activeRuntime === null) {
    return snapshot;
  }

  const normalizedNow = normalizeActiveCallNowMs(snapshot.activeRuntime, nowMs);

  return {
    ...snapshot,
    activeRuntime: {
      ...snapshot.activeRuntime,
      lastNowMs: normalizedNow,
      videoUnlockCelebratedAtMs: normalizedNow,
    },
  };
};

export const setActiveCallMutedStore = (
  snapshot: CallStoreSnapshot,
  muted: boolean,
): CallStoreSnapshot => ({
  ...snapshot,
  activeControls: {
    ...snapshot.activeControls,
    muted,
  },
});

export const setActiveCallCameraEnabledStore = (
  snapshot: CallStoreSnapshot,
  cameraEnabled: boolean,
): CallStoreSnapshot => ({
  ...snapshot,
  activeControls: {
    ...snapshot.activeControls,
    cameraEnabled,
  },
});

export const setActiveCallCameraFacingStore = (
  snapshot: CallStoreSnapshot,
  cameraFacing: ActiveCallCameraFacing,
): CallStoreSnapshot => ({
  ...snapshot,
  activeControls: {
    ...snapshot.activeControls,
    cameraFacing,
  },
});

export const setActiveCallSpeakerEnabledStore = (
  snapshot: CallStoreSnapshot,
  speakerEnabled: boolean,
): CallStoreSnapshot => ({
  ...snapshot,
  activeControls: {
    ...snapshot.activeControls,
    speakerEnabled,
  },
});

export const setActiveCallSelfPreviewPositionStore = (
  snapshot: CallStoreSnapshot,
  position: ActiveCallSelfPreviewPosition,
): CallStoreSnapshot => ({
  ...snapshot,
  activeRuntime:
    snapshot.activeRuntime === null
      ? null
      : {
          ...snapshot.activeRuntime,
          selfPreviewPosition: position,
        },
});

export const updateActiveCallSessionStore = (
  snapshot: CallStoreSnapshot,
  patch: Partial<ActiveVoiceCallSession>,
): CallStoreSnapshot => ({
  ...snapshot,
  activeSession:
    snapshot.activeSession === null
      ? null
      : {
          ...snapshot.activeSession,
          ...patch,
        },
});

type ActiveCallStoreState = CallStoreSnapshot & {
  markVideoUnlockCelebrated: (atMs?: number) => void;
  reset: () => void;
  restoreActiveConnection: (atMs?: number) => void;
  setCameraFacing: (cameraFacing: ActiveCallCameraFacing) => void;
  setCameraEnabled: (cameraEnabled: boolean) => void;
  setMuted: (muted: boolean) => void;
  setSelfPreviewPosition: (position: ActiveCallSelfPreviewPosition) => void;
  setSpeakerEnabled: (speakerEnabled: boolean) => void;
  startActiveCall: (
    activeCallId: string,
    activeSession?: ActiveVoiceCallSession,
    atMs?: number,
  ) => void;
  syncActiveCall: (atMs?: number) => void;
  transitionActive: (event: ActiveCallEvent, atMs?: number) => void;
  transitionOutgoing: (event: OutgoingCallEvent) => void;
  updateActiveSession: (patch: Partial<ActiveVoiceCallSession>) => void;
};

export const useActiveCallStore = create<ActiveCallStoreState>((set, get) => ({
  ...initialCallStore,
  markVideoUnlockCelebrated: (atMs = readMonotonicNowMs()) => {
    set(markVideoUnlockCelebratedStore(get(), atMs));
  },
  reset: () => {
    set(initialCallStore);
  },
  restoreActiveConnection: (atMs = readMonotonicNowMs()) => {
    set(restoreActiveCallStore(get(), atMs));
  },
  setCameraFacing: (cameraFacing) => {
    set(setActiveCallCameraFacingStore(get(), cameraFacing));
  },
  setCameraEnabled: (cameraEnabled) => {
    set(setActiveCallCameraEnabledStore(get(), cameraEnabled));
  },
  setMuted: (muted) => {
    set(setActiveCallMutedStore(get(), muted));
  },
  setSelfPreviewPosition: (position) => {
    set(setActiveCallSelfPreviewPositionStore(get(), position));
  },
  setSpeakerEnabled: (speakerEnabled) => {
    set(setActiveCallSpeakerEnabledStore(get(), speakerEnabled));
  },
  startActiveCall: (
    activeCallId,
    activeSession,
    atMs = readMonotonicNowMs(),
  ) => {
    set(startActiveCallStore(get(), activeCallId, activeSession ?? null, atMs));
  },
  syncActiveCall: (atMs = readMonotonicNowMs()) => {
    set(syncActiveCallStore(get(), atMs));
  },
  transitionActive: (event, atMs = readMonotonicNowMs()) => {
    set(transitionActiveCallStore(get(), event, atMs));
  },
  transitionOutgoing: (event) => {
    set(transitionOutgoingCallStore(get(), event));
  },
  updateActiveSession: (patch) => {
    set(updateActiveCallSessionStore(get(), patch));
  },
}));
