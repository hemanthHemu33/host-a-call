import { setAudioModeAsync } from 'expo-audio';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpClient } from '@connecto/domain';

import type { ActiveVoiceCallSession } from '@/store/call.store';
import { useDevelopmentScenarioStore } from '@/store/development.store';

import {
  createMockActiveCallSessionAdapter,
  createProviderActiveCallSessionAdapter,
} from './active-call.adapter';
import { parseCallRuntimeConfig } from './call.preconnect';

const createSession = (): ActiveVoiceCallSession => ({
  agoraAppId: 'agora-app-id',
  callId: 'call_1',
  customerId: 'customer_1',
  hostAge: 25,
  hostId: 'host_anjali',
  hostLanguage: 'Telugu',
  hostName: 'Anjali',
  id: 'session_1',
  mediaResourceId: 'media_1',
  provider: 'agora',
  rtcChannelName: 'rtc_channel_1',
  rtcToken: 'voice-token',
  startedAtIso: '2026-07-16T10:00:00.000Z',
  tokenExpiresAtIso: '2026-07-16T10:10:00.000Z',
  videoAvailableAfterMinutes: 3,
  videoRate: { amountPaise: 1600, currency: 'INR' },
  voiceRate: { amountPaise: 1000, currency: 'INR' },
});

const runtimeConfig = (
  input: Partial<ReturnType<typeof parseCallRuntimeConfig>> = {},
) =>
  parseCallRuntimeConfig({
    EXPO_PUBLIC_CONNECTO_CALL_ACTIVE_BACKEND:
      input.activeCallBackendMode ?? 'mock',
    EXPO_PUBLIC_CONNECTO_CALL_ACTIVE_MEDIA_BRIDGE:
      input.activeCallMediaBridgeMode ?? 'mock',
    EXPO_PUBLIC_CONNECTO_CALL_AUDIO_METERING: String(
      input.audioMeteringEnabled ?? false,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_CAMERA_PERMISSION:
      input.cameraPermission ?? 'granted',
    EXPO_PUBLIC_CONNECTO_CALL_CAMERA_REQUEST_OUTCOME:
      input.cameraRequestOutcome ?? 'granted',
    EXPO_PUBLIC_CONNECTO_CALL_MIC_PERMISSION:
      input.microphonePermission ?? 'granted',
    EXPO_PUBLIC_CONNECTO_CALL_MIC_REQUEST_OUTCOME:
      input.microphoneRequestOutcome ?? 'granted',
    EXPO_PUBLIC_CONNECTO_CALL_PROVIDER: input.providerMode ?? 'mock',
    EXPO_PUBLIC_CONNECTO_CALL_RING_DELAY_MS: String(input.ringDelayMs ?? 20),
    EXPO_PUBLIC_CONNECTO_CALL_RING_OUTCOME: input.ringOutcome ?? 'accepted',
    EXPO_PUBLIC_CONNECTO_CALL_RING_TIMEOUT_MS: String(
      input.ringTimeoutMs ?? 500,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_DELAY_MS: String(
      input.videoConnectDelayMs ?? 800,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_OUTCOME:
      input.videoConnectOutcome ?? 'connected',
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_COUNTDOWN_MS: String(
      input.videoCountdownMs ?? 3_000,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_DELAY_MS: String(
      input.videoRequestDelayMs ?? 1_000,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REJECT_COOLDOWN_MS: String(
      input.videoRejectCooldownMs ?? 30_000,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_OUTCOME:
      input.videoRequestOutcome ?? 'accepted',
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_TIMEOUT_MS: String(
      input.videoRequestTimeoutMs ?? 5_000,
    ),
  });

describe('active call session adapter', () => {
  beforeEach(() => {
    useDevelopmentScenarioStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    useDevelopmentScenarioStore.getState().reset();
  });

  it('uses the developer scenario network quality and connects remote video only after the adapter emits it', async () => {
    let currentNow = new Date('2026-07-16T10:00:00.000Z');
    const session = createSession();
    useDevelopmentScenarioStore
      .getState()
      .setScenario({ networkQuality: 'excellent' });

    const adapter = createMockActiveCallSessionAdapter({
      now: () => currentNow,
      runtimeConfig: runtimeConfig({
        videoConnectDelayMs: 300,
        videoConnectOutcome: 'connected',
        videoRequestDelayMs: 1_000,
        videoRequestOutcome: 'accepted',
        videoRequestTimeoutMs: 5_000,
      }),
    });

    await adapter.connectSession({ session });

    await expect(adapter.readTelemetry({ session })).resolves.toMatchObject({
      cameraFacing: 'front',
      mediaMode: 'voice',
      mediaResourceReady: true,
      networkQuality: 'excellent',
      remoteCameraEnabled: false,
      remoteVideoConnected: false,
    });

    await expect(
      adapter.ensureVideoUpgradeRequest({ session }),
    ).resolves.toMatchObject({
      status: 'pending',
    });

    currentNow = new Date('2026-07-16T10:00:01.500Z');

    const resolvedRequest = await adapter.pollVideoUpgrade({ session });
    expect(resolvedRequest).toMatchObject({
      rtcToken: 'mock_video_rtc_call_1',
      status: 'accepted',
    });

    await expect(
      adapter.activateVideoMode({
        session,
        videoUpgrade: resolvedRequest,
      }),
    ).resolves.toEqual({
      rtcToken: 'mock_video_rtc_call_1',
      tokenExpiresAtIso: '2026-07-16T10:10:01.500Z',
    });

    await expect(adapter.readTelemetry({ session })).resolves.toMatchObject({
      cameraFacing: 'front',
      mediaMode: 'voice',
      networkQuality: 'excellent',
      remoteCameraEnabled: false,
      remoteVideoConnected: false,
    });

    currentNow = new Date('2026-07-16T10:00:01.900Z');

    await expect(
      adapter.waitForRemoteVideoConnected({ session }),
    ).resolves.toMatchObject({
      connectedAtIso: '2026-07-16T10:00:01.900Z',
    });

    await expect(adapter.readTelemetry({ session })).resolves.toMatchObject({
      cameraFacing: 'front',
      mediaMode: 'video',
      networkQuality: 'excellent',
      remoteCameraEnabled: true,
      remoteVideoConnected: true,
    });
  });

  it('times out mock video requests safely when no host decision arrives', async () => {
    let currentNow = new Date('2026-07-16T10:00:00.000Z');
    const session = createSession();
    const adapter = createMockActiveCallSessionAdapter({
      now: () => currentNow,
      runtimeConfig: runtimeConfig({
        videoRequestDelayMs: 1_000,
        videoRequestOutcome: 'pending',
        videoRequestTimeoutMs: 4_000,
      }),
    });

    await adapter.connectSession({ session });
    await adapter.ensureVideoUpgradeRequest({ session });

    currentNow = new Date('2026-07-16T10:00:04.500Z');

    await expect(adapter.pollVideoUpgrade({ session })).resolves.toMatchObject({
      status: 'timeout',
    });
  });

  it('fails the mock remote-video connection cleanly after host acceptance', async () => {
    let currentNow = new Date('2026-07-16T10:00:00.000Z');
    const session = createSession();
    const adapter = createMockActiveCallSessionAdapter({
      now: () => currentNow,
      runtimeConfig: runtimeConfig({
        videoConnectDelayMs: 400,
        videoConnectOutcome: 'failed',
        videoRequestDelayMs: 1_000,
        videoRequestOutcome: 'accepted',
        videoRequestTimeoutMs: 5_000,
      }),
    });

    await adapter.connectSession({ session });
    await adapter.ensureVideoUpgradeRequest({ session });

    currentNow = new Date('2026-07-16T10:00:01.500Z');
    const accepted = await adapter.pollVideoUpgrade({ session });

    await adapter.activateVideoMode({
      session,
      videoUpgrade: accepted,
    });

    currentNow = new Date('2026-07-16T10:00:01.950Z');

    await expect(
      adapter.waitForRemoteVideoConnected({ session }),
    ).rejects.toThrow(/Remote video could not connect/);

    await expect(adapter.readTelemetry({ session })).resolves.toMatchObject({
      cameraFacing: 'front',
      mediaMode: 'voice',
      remoteCameraEnabled: false,
      remoteVideoConnected: false,
    });
  });

  it('uses typed provider contracts for telemetry, speaker routing, camera switching, request cancellation, and remote video connection', async () => {
    const session = createSession();
    const requests: Array<{
      body?: unknown;
      method: string;
      path: string;
    }> = [];
    const httpClient: HttpClient = {
      request(request) {
        requests.push({
          body: request.body,
          method: request.method,
          path: request.path,
        });

        if (request.path === '/v1/calls/call_1/video-upgrade') {
          return Promise.resolve(
            request.responseSchema.parse({
              createdAtIso: '2026-07-16T10:00:00.000Z',
              id: 'video_request_1',
              rtcToken: null,
              status: 'pending',
              tokenExpiresAtIso: null,
              updatedAtIso: '2026-07-16T10:00:00.000Z',
            }),
          );
        }

        if (request.path === '/v1/calls/call_1/video-upgrade/video_request_1') {
          return Promise.resolve(
            request.responseSchema.parse({
              createdAtIso: '2026-07-16T10:00:00.000Z',
              id: 'video_request_1',
              rtcToken: 'video-token',
              status: 'accepted',
              tokenExpiresAtIso: '2026-07-16T10:05:00.000Z',
              updatedAtIso: '2026-07-16T10:00:03.000Z',
            }),
          );
        }

        if (
          request.path ===
          '/v1/calls/call_1/video-upgrade/video_request_1/cancel'
        ) {
          return Promise.resolve(request.responseSchema.parse({ ok: true }));
        }

        if (request.path === '/v1/calls/sessions/session_1/video/activate') {
          return Promise.resolve(
            request.responseSchema.parse({
              rtcToken: 'video-token',
              tokenExpiresAtIso: '2026-07-16T10:05:00.000Z',
            }),
          );
        }

        if (request.path === '/v1/calls/sessions/session_1/video/connected') {
          return Promise.resolve(
            request.responseSchema.parse({
              connectedAtIso: '2026-07-16T10:00:00.000Z',
              rtcToken: 'verified-video-token',
              tokenExpiresAtIso: '2026-07-16T10:06:00.000Z',
              verificationStatus: 'verified',
              videoBillingStatus: 'active',
            }),
          );
        }

        return Promise.reject(new Error(`Unexpected path ${request.path}.`));
      },
    };
    const nativeBridge = {
      connectSession: vi.fn(() => Promise.resolve()),
      getTelemetry: vi.fn(() =>
        Promise.resolve({
          audioLevel: 0.73,
          cameraEnabled: false,
          cameraFacing: 'back' as const,
          mediaMode: 'voice' as const,
          mediaResourceReady: true,
          muted: false,
          networkQuality: 'poor' as const,
          remoteCameraEnabled: false,
          remoteVideoConnected: false,
          speakerEnabled: false,
        }),
      ),
      setCameraEnabled: vi.fn(() => Promise.resolve()),
      setMuted: vi.fn(() => Promise.resolve()),
      setSpeakerEnabled: vi.fn(() => Promise.resolve()),
      switchCamera: vi.fn(() => Promise.resolve('front' as const)),
      upgradeToVideo: vi.fn(() => Promise.resolve()),
      waitForRemoteVideoConnected: vi.fn(() => Promise.resolve()),
    };
    const adapter = createProviderActiveCallSessionAdapter({
      activeCallBackendMode: 'http',
      activeCallMediaBridgeMode: 'native',
      audioMeteringEnabled: true,
      httpClient,
      nativeBridge,
      now: () => new Date('2026-07-16T10:00:00.000Z'),
    });

    await adapter.connectSession({ session });
    expect(nativeBridge.connectSession).toHaveBeenCalledWith({
      agoraAppId: 'agora-app-id',
      callId: 'call_1',
      mediaResourceId: 'media_1',
      rtcChannelName: 'rtc_channel_1',
      rtcToken: 'voice-token',
      sessionId: 'session_1',
    });
    expect(adapter.getSurfaceSupport()).toEqual({
      localPreview: 'camera-view',
      remoteVideo: 'placeholder',
    });

    await expect(adapter.readTelemetry({ session })).resolves.toMatchObject({
      audioLevel: 0.73,
      cameraFacing: 'back',
      networkQuality: 'poor',
      remoteVideoConnected: false,
    });

    await adapter.setSpeakerEnabled({
      session,
      speakerEnabled: true,
    });
    expect(setAudioModeAsync).toHaveBeenCalled();
    expect(nativeBridge.setSpeakerEnabled).toHaveBeenCalledWith(
      'session_1',
      true,
    );

    await expect(adapter.switchCamera({ session })).resolves.toBe('front');
    expect(nativeBridge.switchCamera).toHaveBeenCalledWith('session_1');

    await expect(
      adapter.ensureVideoUpgradeRequest({ session }),
    ).resolves.toMatchObject({
      id: 'video_request_1',
      status: 'pending',
    });
    const accepted = await adapter.pollVideoUpgrade({ session });
    expect(accepted).toMatchObject({
      rtcToken: 'video-token',
      status: 'accepted',
    });

    await expect(
      adapter.activateVideoMode({
        session,
        videoUpgrade: accepted,
      }),
    ).resolves.toEqual({
      rtcToken: 'video-token',
      tokenExpiresAtIso: '2026-07-16T10:05:00.000Z',
    });
    expect(nativeBridge.upgradeToVideo).toHaveBeenCalledWith({
      agoraAppId: 'agora-app-id',
      callId: 'call_1',
      mediaResourceId: 'media_1',
      rtcChannelName: 'rtc_channel_1',
      rtcToken: 'video-token',
      sessionId: 'session_1',
      tokenExpiresAtIso: '2026-07-16T10:05:00.000Z',
      videoRequestId: 'video_request_1',
    });

    await expect(
      adapter.waitForRemoteVideoConnected({ session }),
    ).resolves.toMatchObject({
      connectedAtIso: '2026-07-16T10:00:00.000Z',
    });
    expect(nativeBridge.waitForRemoteVideoConnected).toHaveBeenCalledWith(
      'session_1',
    );
    expect(session.rtcToken).toBe('verified-video-token');
    expect(session.tokenExpiresAtIso).toBe('2026-07-16T10:06:00.000Z');

    await expect(
      adapter.cancelVideoUpgradeRequest({ session }),
    ).resolves.toBeUndefined();

    expect(requests).toEqual([
      {
        body: undefined,
        method: 'POST',
        path: '/v1/calls/call_1/video-upgrade',
      },
      {
        body: undefined,
        method: 'GET',
        path: '/v1/calls/call_1/video-upgrade/video_request_1',
      },
      {
        body: {
          callId: 'call_1',
          currentRtcToken: 'voice-token',
          currentTokenExpiresAtIso: '2026-07-16T10:10:00.000Z',
          videoRequestId: 'video_request_1',
        },
        method: 'POST',
        path: '/v1/calls/sessions/session_1/video/activate',
      },
      {
        body: {
          callId: 'call_1',
          connectedAtIso: '2026-07-16T10:00:00.000Z',
          videoRequestId: 'video_request_1',
        },
        method: 'POST',
        path: '/v1/calls/sessions/session_1/video/connected',
      },
      {
        body: undefined,
        method: 'POST',
        path: '/v1/calls/call_1/video-upgrade/video_request_1/cancel',
      },
    ]);
  });
});
