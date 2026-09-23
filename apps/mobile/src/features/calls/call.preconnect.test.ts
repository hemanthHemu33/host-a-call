import { describe, expect, it, vi } from 'vitest';

import {
  fixtureHosts,
  fixtureWallet,
  type HostSummary,
  type HttpClient,
} from '@connecto/domain';

import {
  createHttpCallPreconnectAdapter,
  createHttpCallSessionAdapter,
  createMockCallPreconnectAdapter,
  createMockCallMediaBridge,
  createMockCallSessionAdapter,
  minimumVoiceBalancePaise,
  parseCallRuntimeConfig,
  parseOutgoingCallRouteParams,
  resolveCallAccountGate,
  resolveCallPreconnect,
  ringWithTimeout,
  type CallIntent,
  type CallMediaResource,
  type CallRuntimeConfig,
} from './call.preconnect';

const hostAt = (index: number): HostSummary => {
  const host = fixtureHosts[index];

  if (host === undefined) {
    throw new Error(`Missing host fixture at index ${String(index)}.`);
  }

  return host;
};

const activeCustomer = {
  accountStatus: 'active',
  role: 'customer',
  sessionId: 'session_1',
} as const;

const fixedNow = () => new Date('2026-07-16T10:00:00.000Z');

const createIntent = (host: HostSummary = hostAt(0)): CallIntent => ({
  createdAtIso: fixedNow().toISOString(),
  customerId: 'customer_1',
  hostId: host.id,
  id: 'call_1',
  language: host.language,
  minimumRequiredBalancePaise: 3000,
  rtcChannelName: 'rtc_channel_1',
  status: 'created',
});

const createMediaResource = (): CallMediaResource => ({
  id: 'media_1',
  kind: 'voice',
  preparedAtIso: fixedNow().toISOString(),
  provider: 'mock',
});

const runtimeConfig = (input: Partial<CallRuntimeConfig> = {}) =>
  parseCallRuntimeConfig({
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
      input.videoConnectDelayMs ?? 1_800,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_OUTCOME:
      input.videoConnectOutcome ?? 'connected',
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_COUNTDOWN_MS: String(
      input.videoCountdownMs ?? 3_000,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_DELAY_MS: String(
      input.videoRequestDelayMs ?? 2_500,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REJECT_COOLDOWN_MS: String(
      input.videoRejectCooldownMs ?? 30_000,
    ),
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_OUTCOME:
      input.videoRequestOutcome ?? 'accepted',
    EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_TIMEOUT_MS: String(
      input.videoRequestTimeoutMs ?? 12_000,
    ),
  });

describe('call preconnect models', () => {
  it('parses outgoing call route params safely', () => {
    expect(
      parseOutgoingCallRouteParams({
        discoveryAutoConnect: 'true',
        discoveryHostId: 'host_anjali',
        discoveryHostLanguage: 'Telugu',
        discoveryHostName: 'Anjali',
        discoveryHostRank: 'gold',
      }),
    ).toEqual({
      discoveryAutoConnect: 'true',
      discoveryHostId: 'host_anjali',
      discoveryHostLanguage: 'Telugu',
      discoveryHostName: 'Anjali',
      discoveryHostRank: 'gold',
      discoveryInitialState: undefined,
    });

    expect(
      parseOutgoingCallRouteParams({
        discoveryHostRank: 'invalid',
      }),
    ).toMatchObject({
      discoveryHostId: null,
      discoveryHostLanguage: null,
      discoveryHostName: null,
      discoveryHostRank: null,
    });
  });

  it('gates accounts before host, balance, or permission checks', () => {
    expect(
      resolveCallAccountGate({
        accountStatus: 'active',
        role: 'customer',
        sessionId: null,
      }),
    ).toEqual({ kind: 'blocked', reason: 'signed-out' });

    expect(
      resolveCallPreconnect({
        account: {
          accountStatus: 'suspended',
          role: 'customer',
          sessionId: 'session_1',
        },
        blockedHostIds: [hostAt(0).id],
        host: { ...hostAt(0), availability: 'busy' },
        microphonePermission: 'denied',
        wallet: {
          ...fixtureWallet,
          balance: { amountPaise: 0, currency: 'INR' },
        },
      }),
    ).toEqual({ kind: 'account-blocked', reason: 'suspended' });
  });

  it('covers blocked host and availability branches before balance', () => {
    expect(
      resolveCallPreconnect({
        account: activeCustomer,
        blockedHostIds: [hostAt(0).id],
        host: hostAt(0),
        microphonePermission: 'granted',
        wallet: fixtureWallet,
      }),
    ).toEqual({ kind: 'host-blocked' });

    expect(
      resolveCallPreconnect({
        account: activeCustomer,
        blockedHostIds: [],
        host: { ...hostAt(0), availability: 'busy' },
        microphonePermission: 'granted',
        wallet: {
          ...fixtureWallet,
          balance: { amountPaise: 0, currency: 'INR' },
        },
      }),
    ).toEqual({ kind: 'host-unavailable', reason: 'busy' });
  });

  it('requires three voice minutes before microphone permission', () => {
    const host = {
      ...hostAt(0),
      availability: 'online',
      voiceRate: { amountPaise: 1200, currency: 'INR' },
    } satisfies HostSummary;

    expect(minimumVoiceBalancePaise(host)).toBe(3600);
    expect(
      resolveCallPreconnect({
        account: activeCustomer,
        blockedHostIds: [],
        host,
        microphonePermission: 'denied',
        wallet: {
          ...fixtureWallet,
          balance: { amountPaise: 1500, currency: 'INR' },
        },
      }),
    ).toEqual({
      kind: 'insufficient-balance',
      minimumRequiredBalancePaise: 3600,
      shortfallPaise: 2100,
    });
  });

  it('covers microphone explanation, denial, and ready outcomes', () => {
    const host = { ...hostAt(0), availability: 'online' } satisfies HostSummary;

    expect(
      resolveCallPreconnect({
        account: activeCustomer,
        blockedHostIds: [],
        host,
        microphonePermission: 'prompt',
        wallet: fixtureWallet,
      }),
    ).toEqual({ kind: 'microphone-explanation' });

    expect(
      resolveCallPreconnect({
        account: activeCustomer,
        blockedHostIds: [],
        host,
        microphonePermission: 'denied',
        wallet: fixtureWallet,
      }),
    ).toEqual({ kind: 'microphone-denied' });

    expect(
      resolveCallPreconnect({
        account: activeCustomer,
        blockedHostIds: [],
        host,
        microphonePermission: 'granted',
        wallet: fixtureWallet,
      }),
    ).toEqual({
      kind: 'ready',
      minimumRequiredBalancePaise: 3000,
    });
  });
});

describe('call preconnect adapter', () => {
  it('deduplicates rapid repeated call intents for the same host', async () => {
    const adapter = createMockCallPreconnectAdapter({
      now: fixedNow,
      runtimeConfig: runtimeConfig(),
    });

    const [first, second] = await Promise.all([
      adapter.createCallIntent({
        customerId: 'customer_1',
        host: hostAt(0),
        minimumRequiredBalancePaise: 3000,
      }),
      adapter.createCallIntent({
        customerId: 'customer_1',
        host: hostAt(0),
        minimumRequiredBalancePaise: 3000,
      }),
    ]);

    expect(first.id).toBe(second.id);
    expect(first.rtcChannelName).toBe('mock_channel_host_anjali_001');
    expect(adapter.getCreatedIntentCount()).toBe(1);
  });

  it('prepares and releases mock voice media resources', async () => {
    const adapter = createMockCallPreconnectAdapter({
      now: fixedNow,
      runtimeConfig: runtimeConfig(),
    });
    const intent = await adapter.createCallIntent({
      customerId: 'customer_1',
      host: hostAt(0),
      minimumRequiredBalancePaise: 3000,
    });

    await expect(adapter.prepareVoiceResources(intent)).resolves.toEqual({
      id: `mock_audio_${intent.id}`,
      kind: 'voice',
      preparedAtIso: '2026-07-16T10:00:00.000Z',
      provider: 'mock',
    });
    await expect(
      adapter.releaseVoiceResources(`mock_audio_${intent.id}`),
    ).resolves.toBeUndefined();
  });

  it('uses typed HTTP contracts for call intent, ring, and release', async () => {
    const requests: Array<{
      body?: unknown;
      method: string;
      path: string;
    }> = [];
    const intent = createIntent();
    const httpClient: HttpClient = {
      request(request) {
        requests.push({
          body: request.body,
          method: request.method,
          path: request.path,
        });

        if (request.path === '/v1/calls/intents') {
          return Promise.resolve(request.responseSchema.parse(intent));
        }

        if (request.path === '/v1/calls/intents/call_1/ring') {
          return Promise.resolve(
            request.responseSchema.parse({ outcome: 'accepted' }),
          );
        }

        if (request.path === '/v1/calls/intents/call_1/release') {
          return Promise.resolve(request.responseSchema.parse({ ok: true }));
        }

        return Promise.reject(new Error(`Unexpected path ${request.path}.`));
      },
    };
    const adapter = createHttpCallPreconnectAdapter({
      httpClient,
      mediaBridge: createMockCallMediaBridge({
        now: fixedNow,
        runtimeConfig: runtimeConfig(),
      }),
    });

    await expect(
      adapter.createCallIntent({
        customerId: 'customer_1',
        host: hostAt(0),
        minimumRequiredBalancePaise: 3000,
      }),
    ).resolves.toEqual(intent);
    await expect(
      adapter.ringHost({
        intent,
        signal: new AbortController().signal,
      }),
    ).resolves.toBe('accepted');
    await expect(adapter.releaseCallIntent(intent.id)).resolves.toBeUndefined();

    expect(requests).toEqual([
      {
        body: {
          customerId: 'customer_1',
          hostId: 'host_anjali',
          language: 'Telugu',
          minimumRequiredBalancePaise: 3000,
        },
        method: 'POST',
        path: '/v1/calls/intents',
      },
      {
        body: { hostId: 'host_anjali' },
        method: 'POST',
        path: '/v1/calls/intents/call_1/ring',
      },
      {
        body: undefined,
        method: 'POST',
        path: '/v1/calls/intents/call_1/release',
      },
    ]);
  });

  it('resolves ring timeout without leaving timers behind', async () => {
    const adapter = createMockCallPreconnectAdapter({
      runtimeConfig: runtimeConfig({
        ringDelayMs: 50,
        ringOutcome: 'timeout',
        ringTimeoutMs: 250,
      }),
    });
    const intent = await adapter.createCallIntent({
      customerId: 'customer_1',
      host: hostAt(0),
      minimumRequiredBalancePaise: 3000,
    });

    vi.useFakeTimers();

    const outcomePromise = ringWithTimeout({
      adapter,
      intent,
      signal: new AbortController().signal,
      timeoutMs: 250,
    });

    await vi.advanceTimersByTimeAsync(260);

    await expect(outcomePromise).resolves.toBe('timeout');
    vi.useRealTimers();
  });

  it('cancels ringing timers cleanly', async () => {
    const adapter = createMockCallPreconnectAdapter({
      runtimeConfig: runtimeConfig({
        ringDelayMs: 1_000,
        ringOutcome: 'accepted',
        ringTimeoutMs: 5_000,
      }),
    });
    const intent = await adapter.createCallIntent({
      customerId: 'customer_1',
      host: hostAt(0),
      minimumRequiredBalancePaise: 3000,
    });

    vi.useFakeTimers();

    const controller = new AbortController();
    const outcomePromise = ringWithTimeout({
      adapter,
      intent,
      signal: controller.signal,
      timeoutMs: 5_000,
    });

    controller.abort(new Error('user-cancelled'));
    await vi.advanceTimersByTimeAsync(1);

    await expect(outcomePromise).resolves.toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('creates mock active voice sessions for accepted calls', async () => {
    const adapter = createMockCallSessionAdapter({ now: fixedNow });

    await expect(
      adapter.startVoiceSession({
        host: hostAt(0),
        intent: createIntent(),
        mediaResource: createMediaResource(),
      }),
    ).resolves.toMatchObject({
      agoraAppId: 'mock-agora-app-id',
      callId: 'call_1',
      hostAge: hostAt(0).age,
      hostLanguage: hostAt(0).language,
      hostName: hostAt(0).displayName,
      mediaResourceId: 'media_1',
      provider: 'mock',
      rtcChannelName: 'rtc_channel_1',
      rtcToken: 'mock_rtc_token_call_1',
      tokenExpiresAtIso: '2026-07-16T10:10:00.000Z',
      videoAvailableAfterMinutes: hostAt(0).videoAvailableAfterMinutes,
      videoRate: hostAt(0).videoRate,
      voiceRate: hostAt(0).voiceRate,
    });
  });

  it('creates API-backed active sessions from call tokens', async () => {
    const requestToken = vi.fn(() =>
      Promise.resolve({
        expiresAtIso: '2026-07-16T10:05:00.000Z',
        token: 'rtc-token-from-api',
      }),
    );
    const adapter = createHttpCallSessionAdapter({
      agoraAppId: 'agora-app-id',
      now: fixedNow,
      requestToken,
    });

    await expect(
      adapter.startVoiceSession({
        host: hostAt(0),
        intent: createIntent(),
        mediaResource: createMediaResource(),
      }),
    ).resolves.toMatchObject({
      agoraAppId: 'agora-app-id',
      callId: 'call_1',
      hostAge: hostAt(0).age,
      hostLanguage: hostAt(0).language,
      hostName: hostAt(0).displayName,
      id: 'active_session_call_1',
      mediaResourceId: 'media_1',
      provider: 'agora',
      rtcChannelName: 'rtc_channel_1',
      rtcToken: 'rtc-token-from-api',
      tokenExpiresAtIso: '2026-07-16T10:05:00.000Z',
      videoAvailableAfterMinutes: hostAt(0).videoAvailableAfterMinutes,
      videoRate: hostAt(0).videoRate,
      voiceRate: hostAt(0).voiceRate,
    });
    expect(requestToken).toHaveBeenCalledWith({
      callId: 'call_1',
      role: 'customer',
    });
  });

  it('requests active session tokens through the HTTP call contract', async () => {
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

        return Promise.resolve(
          request.responseSchema.parse({
            expiresAtIso: '2026-07-16T10:05:00.000Z',
            token: 'rtc-token-from-http',
          }),
        );
      },
    };
    const adapter = createHttpCallSessionAdapter({
      agoraAppId: 'agora-app-id',
      httpClient,
      now: fixedNow,
    });

    await expect(
      adapter.startVoiceSession({
        host: hostAt(0),
        intent: createIntent(),
        mediaResource: createMediaResource(),
      }),
    ).resolves.toMatchObject({
      provider: 'agora',
      rtcToken: 'rtc-token-from-http',
    });
    expect(requests).toEqual([
      {
        body: {
          callId: 'call_1',
          role: 'customer',
        },
        method: 'POST',
        path: '/v1/calls/token',
      },
    ]);
  });

  it('ends API-backed active sessions through the HTTP call contract', async () => {
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

        return Promise.resolve(request.responseSchema.parse({ ok: true }));
      },
    };
    const adapter = createHttpCallSessionAdapter({
      agoraAppId: 'agora-app-id',
      httpClient,
      now: fixedNow,
    });

    await expect(adapter.endVoiceSession('session_1')).resolves.toBeUndefined();
    expect(requests).toEqual([
      {
        body: undefined,
        method: 'POST',
        path: '/v1/calls/sessions/session_1/end',
      },
    ]);
  });
});
