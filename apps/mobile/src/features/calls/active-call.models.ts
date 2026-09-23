import type { ConnectionQuality } from '@connecto/domain';

import type {
  ActiveCallCameraFacing,
  ActiveVoiceCallSession,
} from '@/store/call.store';

export type SessionMediaMode = 'video' | 'voice';

export type ActiveCallTelemetrySnapshot = {
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
  updatedAtIso: string;
};

export type ActiveCallTelemetryInput = {
  session: ActiveVoiceCallSession;
};

export type VideoUpgradeInput = {
  session: ActiveVoiceCallSession;
  signal?: AbortSignal;
};

export type RemoteVideoConnectedResult = {
  connectedAtIso: string;
};

export type ActiveCallSessionPatch = Partial<
  Pick<ActiveVoiceCallSession, 'rtcToken' | 'tokenExpiresAtIso'>
>;

export type VideoFallbackReason = 'manual' | 'remote-video-lost';
