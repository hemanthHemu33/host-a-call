import { useEffect, useState } from 'react';

import {
  createFetchHttpClient,
  type ActiveCallState,
  type HttpClient,
} from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import type { ActiveVoiceCallSession } from '@/store/call.store';

import {
  type ActiveCallBackendAdapter,
  type ActiveCallVideoUpgrade,
  activeCallVideoUpgradeSchema,
  activeCallVideoUpgradeStatusSchema,
  createHttpActiveCallBackendAdapter,
  createMockActiveCallBackendAdapter,
} from './active-call.backend';
import {
  type ActiveCallMediaBridge,
  type ActiveCallMediaBridgeMode,
  type ActiveCallNativeBridge,
  type ActiveCallSurfaceSupport,
  ActiveCallRemoteVideoSurface,
  createMockActiveCallMediaBridge,
  createNativeActiveCallMediaBridge,
  hasNativeRemoteVideoSurface,
} from './active-call.media';
import {
  type ActiveCallSessionPatch,
  type ActiveCallTelemetrySnapshot,
  type RemoteVideoConnectedResult,
  type VideoFallbackReason,
  type VideoUpgradeInput,
} from './active-call.models';
import { callPreconnectRuntimeConfig } from './call.preconnect';

export type {
  ActiveCallSessionPatch,
  ActiveCallTelemetrySnapshot,
  RemoteVideoConnectedResult,
} from './active-call.models';
export { activeCallVideoUpgradeSchema, activeCallVideoUpgradeStatusSchema };
export type {
  ActiveCallMediaBridgeMode,
  ActiveCallNativeBridge,
  ActiveCallSurfaceSupport,
} from './active-call.media';
export type { ActiveCallVideoUpgrade } from './active-call.backend';
export { ActiveCallRemoteVideoSurface, hasNativeRemoteVideoSurface };

export interface ActiveCallSessionAdapter {
  activateVideoMode(
    input: VideoUpgradeInput & {
      videoUpgrade: ActiveCallVideoUpgrade;
    },
  ): Promise<ActiveCallSessionPatch>;
  cancelVideoUpgradeRequest(input: VideoUpgradeInput): Promise<void>;
  connectSession(input: { session: ActiveVoiceCallSession }): Promise<void>;
  disconnectSession(input: { session: ActiveVoiceCallSession }): Promise<void>;
  ensureVideoUpgradeRequest(
    input: VideoUpgradeInput,
  ): Promise<ActiveCallVideoUpgrade>;
  getVideoUpgradeRequest(sessionId: string): ActiveCallVideoUpgrade | null;
  getSurfaceSupport(): ActiveCallSurfaceSupport;
  pollVideoUpgrade(input: VideoUpgradeInput): Promise<ActiveCallVideoUpgrade>;
  readTelemetry(input: {
    session: ActiveVoiceCallSession;
  }): Promise<ActiveCallTelemetrySnapshot>;
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
  }): Promise<'back' | 'front'>;
  downgradeToVoice(input: {
    reason?: VideoFallbackReason;
    session: ActiveVoiceCallSession;
  }): Promise<void>;
  waitForRemoteVideoConnected(
    input: VideoUpgradeInput,
  ): Promise<RemoteVideoConnectedResult>;
}

export const createActiveCallSessionAdapter = ({
  backendAdapter,
  mediaBridge,
}: {
  backendAdapter: ActiveCallBackendAdapter;
  mediaBridge: ActiveCallMediaBridge;
}): ActiveCallSessionAdapter => ({
  async activateVideoMode({ session, signal, videoUpgrade }) {
    const patch = await backendAdapter.activateVideoMode(
      signal === undefined
        ? {
            session,
            videoUpgrade,
          }
        : {
            session,
            signal,
            videoUpgrade,
          },
    );

    await mediaBridge.activateVideoMode(
      signal === undefined
        ? {
            session,
            sessionPatch: patch,
            videoRequestId: videoUpgrade.id,
          }
        : {
            session,
            sessionPatch: patch,
            signal,
            videoRequestId: videoUpgrade.id,
          },
    );

    return patch;
  },
  cancelVideoUpgradeRequest: (input) =>
    backendAdapter.cancelVideoUpgradeRequest(input),
  connectSession: (input) => mediaBridge.connectSession(input),
  disconnectSession: (input) => mediaBridge.disconnectSession(input),
  ensureVideoUpgradeRequest: (input) =>
    backendAdapter.ensureVideoUpgradeRequest(input),
  getSurfaceSupport: () => mediaBridge.getSurfaceSupport(),
  getVideoUpgradeRequest: (sessionId) =>
    backendAdapter.getVideoUpgradeRequest(sessionId),
  pollVideoUpgrade: (input) => backendAdapter.pollVideoUpgrade(input),
  readTelemetry: (input) => mediaBridge.readTelemetry(input),
  setCameraEnabled: (input) => mediaBridge.setCameraEnabled(input),
  setMuted: (input) => mediaBridge.setMuted(input),
  setSpeakerEnabled: (input) => mediaBridge.setSpeakerEnabled(input),
  switchCamera: (input) => mediaBridge.switchCamera(input),
  async downgradeToVoice({ reason = 'manual', session }) {
    await backendAdapter.markVideoFallback({
      reason,
      session,
    });
    await mediaBridge.downgradeToVoice({ session });
  },
  async waitForRemoteVideoConnected({ session, signal }) {
    const connected = await mediaBridge.waitForRemoteVideoConnected(
      signal === undefined
        ? {
            session,
          }
        : {
            session,
            signal,
          },
    );
    const patch = await backendAdapter.verifyRemoteVideoConnected(
      signal === undefined
        ? {
            connectedAtIso: connected.connectedAtIso,
            session,
            videoUpgrade: backendAdapter.getVideoUpgradeRequest(session.id),
          }
        : {
            connectedAtIso: connected.connectedAtIso,
            session,
            signal,
            videoUpgrade: backendAdapter.getVideoUpgradeRequest(session.id),
          },
    );

    if (patch.rtcToken !== undefined || patch.tokenExpiresAtIso !== undefined) {
      Object.assign(session, patch);
    }

    return connected;
  },
});

export const createMockActiveCallSessionAdapter = ({
  now = () => new Date(),
  runtimeConfig,
}: {
  now?: () => Date;
  runtimeConfig: typeof callPreconnectRuntimeConfig;
}): ActiveCallSessionAdapter =>
  createActiveCallSessionAdapter({
    backendAdapter: createMockActiveCallBackendAdapter({
      now,
      runtimeConfig,
    }),
    mediaBridge: createMockActiveCallMediaBridge({
      now,
      runtimeConfig,
    }),
  });

export const createProviderActiveCallSessionAdapter = ({
  activeCallBackendMode = callPreconnectRuntimeConfig.activeCallBackendMode,
  activeCallMediaBridgeMode = callPreconnectRuntimeConfig.activeCallMediaBridgeMode,
  audioMeteringEnabled = callPreconnectRuntimeConfig.audioMeteringEnabled,
  httpClient,
  nativeBridge,
  now = () => new Date(),
}: {
  activeCallBackendMode?: 'http' | 'mock';
  activeCallMediaBridgeMode?: ActiveCallMediaBridgeMode;
  audioMeteringEnabled?: boolean;
  httpClient: HttpClient;
  nativeBridge?: ActiveCallNativeBridge | null;
  now?: () => Date;
}): ActiveCallSessionAdapter => {
  const backendAdapter =
    activeCallBackendMode === 'mock'
      ? createMockActiveCallBackendAdapter({
          now,
          runtimeConfig: callPreconnectRuntimeConfig,
        })
      : createHttpActiveCallBackendAdapter({
          httpClient,
          now,
        });
  const mediaBridge =
    activeCallMediaBridgeMode === 'mock'
      ? createMockActiveCallMediaBridge({
          now,
          runtimeConfig: callPreconnectRuntimeConfig,
        })
      : createNativeActiveCallMediaBridge({
          activeCallMediaBridgeMode,
          audioMeteringEnabled,
          ...(nativeBridge === undefined ? {} : { nativeBridge }),
          now,
        });

  return createActiveCallSessionAdapter({
    backendAdapter,
    mediaBridge,
  });
};

const httpClient = createFetchHttpClient({
  baseUrl: mobileRuntimeConfig.apiBaseUrl,
});

const backendAdapter =
  callPreconnectRuntimeConfig.activeCallBackendMode === 'mock'
    ? createMockActiveCallBackendAdapter({
        runtimeConfig: callPreconnectRuntimeConfig,
      })
    : createHttpActiveCallBackendAdapter({
        httpClient,
      });

export const activeCallMediaBridge =
  callPreconnectRuntimeConfig.activeCallMediaBridgeMode === 'mock'
    ? createMockActiveCallMediaBridge({
        runtimeConfig: callPreconnectRuntimeConfig,
      })
    : createNativeActiveCallMediaBridge({
        activeCallMediaBridgeMode:
          callPreconnectRuntimeConfig.activeCallMediaBridgeMode,
        audioMeteringEnabled: callPreconnectRuntimeConfig.audioMeteringEnabled,
      });

export const activeCallSessionAdapter = createActiveCallSessionAdapter({
  backendAdapter,
  mediaBridge: activeCallMediaBridge,
});

export const useActiveCallSessionTelemetry = ({
  activeState,
  enabled,
  session,
}: {
  activeState: ActiveCallState;
  enabled: boolean;
  session: ActiveVoiceCallSession | null;
}) => {
  const [telemetry, setTelemetry] =
    useState<ActiveCallTelemetrySnapshot | null>(null);

  useEffect(() => {
    if (!enabled || session === null) {
      setTelemetry(null);
      return;
    }

    const controller = new AbortController();
    let inFlight = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const intervalMs = activeState === 'video' ? 500 : 800;

    const refresh = async () => {
      if (controller.signal.aborted || inFlight) {
        return;
      }

      inFlight = true;

      try {
        const next = await activeCallSessionAdapter.readTelemetry({
          session,
        });
        setTelemetry(next);
      } catch {
      } finally {
        inFlight = false;
        timeoutId = setTimeout(() => {
          if (!controller.signal.aborted) {
            void refresh();
          }
        }, intervalMs);
      }
    };

    void refresh();

    return () => {
      controller.abort(new Error('active-call-telemetry-unmounted'));

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeState, enabled, session]);

  return telemetry;
};
