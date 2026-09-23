import { z } from 'zod';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from 'expo-audio';

import {
  createFetchHttpClient,
  callTokenSchema,
  hostRankSchema,
  languageSchema,
  okResponseSchema,
  providerModeSchema,
  type CallToken,
  type HostSummary,
  type HttpClient,
  type Language,
  type Wallet,
} from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import type { ActiveVoiceCallSession } from '@/store/call.store';
import type { AuthAccountStatus, MobileAuthRole } from '@/store/auth.store';

const readParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const outgoingCallRouteParamsSchema = z.object({
  discoveryAutoConnect: z.string().optional(),
  discoveryCandidateHostIds: z.string().optional(),
  discoveryHostId: z.string().min(1).nullable().catch(null),
  discoveryHostLanguage: z.string().min(1).nullable().catch(null),
  discoveryHostName: z.string().min(1).nullable().catch(null),
  discoveryHostProfileImageUri: z.string().min(1).optional(),
  discoveryHostRank: hostRankSchema.nullable().catch(null),
  discoveryInitialState: z.string().optional(),
});
export type OutgoingCallRouteParams = z.infer<
  typeof outgoingCallRouteParamsSchema
>;

export const parseOutgoingCallRouteParams = (
  params: Record<string, string | string[] | undefined>,
): OutgoingCallRouteParams => {
  const discoveryHostProfileImageUri = readParam(
    params.discoveryHostProfileImageUri,
  );

  return outgoingCallRouteParamsSchema.parse({
    discoveryAutoConnect: readParam(params.discoveryAutoConnect),
    discoveryCandidateHostIds: readParam(params.discoveryCandidateHostIds),
    discoveryHostId: readParam(params.discoveryHostId),
    discoveryHostLanguage: readParam(params.discoveryHostLanguage),
    discoveryHostName: readParam(params.discoveryHostName),
    ...(discoveryHostProfileImageUri === undefined
      ? {}
      : { discoveryHostProfileImageUri }),
    discoveryHostRank: readParam(params.discoveryHostRank),
    discoveryInitialState: readParam(params.discoveryInitialState),
  });
};

export const outgoingCallRouteParamsForHost = (
  host: Pick<
    HostSummary,
    'displayName' | 'id' | 'language' | 'profileImageUri' | 'rank'
  >,
) =>
  ({
    discoveryAutoConnect: 'true',
    discoveryHostId: host.id,
    discoveryHostLanguage: host.language,
    discoveryHostName: host.displayName,
    ...(host.profileImageUri === undefined
      ? {}
      : { discoveryHostProfileImageUri: host.profileImageUri }),
    discoveryHostRank: host.rank,
  }) as const;

export const outgoingCallRouteParamsForRandomHosts = (
  hosts: readonly Pick<
    HostSummary,
    'displayName' | 'id' | 'language' | 'profileImageUri' | 'rank'
  >[],
) => {
  const [firstHost] = hosts;

  if (firstHost === undefined) {
    return {
      discoveryAutoConnect: 'false',
      discoveryCandidateHostIds: '',
      discoveryHostId: null,
      discoveryHostLanguage: null,
      discoveryHostName: null,
      discoveryHostRank: null,
      discoveryInitialState: 'random',
    } as const;
  }

  return {
    ...outgoingCallRouteParamsForHost(firstHost),
    discoveryCandidateHostIds: hosts.map((host) => host.id).join(','),
    discoveryInitialState: 'random',
  } as const;
};

export const minimumVoiceBalancePaise = (
  host: Pick<HostSummary, 'voiceRate'>,
) => Math.max(host.voiceRate.amountPaise * 3, 1500);

export type AccountGateInput = {
  accountStatus: AuthAccountStatus | null;
  role: MobileAuthRole | null;
  sessionId: string | null;
};

export type CallAccountBlockReason =
  'blocked' | 'signed-out' | 'suspended' | 'wrong-role';

export const resolveCallAccountGate = (
  input: AccountGateInput,
):
  { kind: 'allowed' } | { kind: 'blocked'; reason: CallAccountBlockReason } => {
  if (input.sessionId === null) {
    return { kind: 'blocked', reason: 'signed-out' };
  }

  if (input.role !== 'customer') {
    return { kind: 'blocked', reason: 'wrong-role' };
  }

  if (
    input.accountStatus === 'blocked' ||
    input.accountStatus === 'suspended'
  ) {
    return { kind: 'blocked', reason: input.accountStatus };
  }

  return { kind: 'allowed' };
};

export const microphonePermissionSchema = z.enum([
  'denied',
  'granted',
  'prompt',
]);
export type MicrophonePermissionState = z.infer<
  typeof microphonePermissionSchema
>;

export type CallPreconnectResult =
  | {
      kind: 'account-blocked';
      reason: CallAccountBlockReason;
    }
  | {
      kind: 'host-blocked';
    }
  | {
      kind: 'host-unavailable';
      reason: 'busy' | 'offline';
    }
  | {
      kind: 'insufficient-balance';
      minimumRequiredBalancePaise: number;
      shortfallPaise: number;
    }
  | {
      kind: 'microphone-denied';
    }
  | {
      kind: 'microphone-explanation';
    }
  | {
      kind: 'ready';
      minimumRequiredBalancePaise: number;
    };

export const resolveCallPreconnect = (input: {
  account: AccountGateInput;
  blockedHostIds: readonly string[];
  host: HostSummary;
  microphonePermission: MicrophonePermissionState;
  wallet: Wallet;
}): CallPreconnectResult => {
  const account = resolveCallAccountGate(input.account);

  if (account.kind === 'blocked') {
    return {
      kind: 'account-blocked',
      reason: account.reason,
    };
  }

  if (input.blockedHostIds.includes(input.host.id)) {
    return { kind: 'host-blocked' };
  }

  if (input.host.availability !== 'online') {
    return {
      kind: 'host-unavailable',
      reason: input.host.availability === 'busy' ? 'busy' : 'offline',
    };
  }

  const minimumRequiredBalancePaise = minimumVoiceBalancePaise(input.host);

  if (input.wallet.balance.amountPaise < minimumRequiredBalancePaise) {
    return {
      kind: 'insufficient-balance',
      minimumRequiredBalancePaise,
      shortfallPaise:
        minimumRequiredBalancePaise - input.wallet.balance.amountPaise,
    };
  }

  if (input.microphonePermission === 'denied') {
    return { kind: 'microphone-denied' };
  }

  if (input.microphonePermission === 'prompt') {
    return { kind: 'microphone-explanation' };
  }

  return {
    kind: 'ready',
    minimumRequiredBalancePaise,
  };
};

export const callRingOutcomeSchema = z.enum([
  'accepted',
  'busy',
  'failed',
  'no-answer',
  'rejected',
  'timeout',
]);
export type CallRingOutcome = z.infer<typeof callRingOutcomeSchema>;

export const callVideoRequestOutcomeSchema = z.enum([
  'accepted',
  'failed',
  'pending',
  'rejected',
  'timeout',
]);
export type CallVideoRequestOutcome = z.infer<
  typeof callVideoRequestOutcomeSchema
>;

export const callVideoConnectOutcomeSchema = z.enum(['connected', 'failed']);
export type CallVideoConnectOutcome = z.infer<
  typeof callVideoConnectOutcomeSchema
>;

export const activeCallBackendModeSchema = z.enum(['http', 'mock']);
export type ActiveCallBackendMode = z.infer<typeof activeCallBackendModeSchema>;

export const activeCallMediaBridgeModeSchema = z.enum([
  'expo',
  'mock',
  'native',
]);
export type ActiveCallMediaBridgeMode = z.infer<
  typeof activeCallMediaBridgeModeSchema
>;

export const callRuntimeConfigSchema = z.object({
  activeCallBackendMode: activeCallBackendModeSchema,
  activeCallMediaBridgeMode: activeCallMediaBridgeModeSchema,
  audioMeteringEnabled: z.boolean(),
  cameraPermission: microphonePermissionSchema,
  cameraRequestOutcome: z.enum(['denied', 'granted']),
  microphonePermission: microphonePermissionSchema,
  microphoneRequestOutcome: z.enum(['denied', 'granted']),
  providerMode: providerModeSchema.catch('mock'),
  ringDelayMs: z.coerce.number().int().min(0).max(30_000),
  ringOutcome: callRingOutcomeSchema,
  ringTimeoutMs: z.coerce.number().int().min(500).max(60_000),
  videoConnectDelayMs: z.coerce.number().int().min(0).max(60_000),
  videoConnectOutcome: callVideoConnectOutcomeSchema,
  videoCountdownMs: z.coerce.number().int().min(1_000).max(10_000),
  videoRequestDelayMs: z.coerce.number().int().min(0).max(60_000),
  videoRequestOutcome: callVideoRequestOutcomeSchema,
  videoRejectCooldownMs: z.coerce.number().int().min(1_000).max(300_000),
  videoRequestTimeoutMs: z.coerce.number().int().min(500).max(120_000),
});
export type CallRuntimeConfig = z.infer<typeof callRuntimeConfigSchema>;

export const parseCallRuntimeConfig = (
  input: Record<string, string | undefined>,
): CallRuntimeConfig =>
  (() => {
    const providerMode = providerModeSchema.parse(
      input.EXPO_PUBLIC_CONNECTO_CALL_PROVIDER ?? 'mock',
    );

    return callRuntimeConfigSchema.parse({
      activeCallBackendMode: activeCallBackendModeSchema
        .catch(providerMode === 'mock' ? 'mock' : 'http')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_ACTIVE_BACKEND),
      activeCallMediaBridgeMode: activeCallMediaBridgeModeSchema
        .catch(providerMode === 'mock' ? 'mock' : 'expo')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_ACTIVE_MEDIA_BRIDGE),
      audioMeteringEnabled: z
        .enum(['false', 'true'])
        .catch(providerMode === 'mock' ? 'false' : 'true')
        .transform((value) => value === 'true')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_AUDIO_METERING),
      cameraPermission: microphonePermissionSchema
        .catch('granted')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_CAMERA_PERMISSION),
      cameraRequestOutcome: z
        .enum(['denied', 'granted'])
        .catch('granted')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_CAMERA_REQUEST_OUTCOME),
      microphonePermission: microphonePermissionSchema
        .catch('granted')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_MIC_PERMISSION),
      microphoneRequestOutcome: z
        .enum(['denied', 'granted'])
        .catch('granted')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_MIC_REQUEST_OUTCOME),
      providerMode,
      ringDelayMs: z.coerce
        .number()
        .int()
        .min(0)
        .max(30_000)
        .catch(900)
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_RING_DELAY_MS),
      ringOutcome: callRingOutcomeSchema
        .catch('accepted')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_RING_OUTCOME),
      ringTimeoutMs: z.coerce
        .number()
        .int()
        .min(500)
        .max(60_000)
        .catch(15_000)
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_RING_TIMEOUT_MS),
      videoConnectDelayMs: z.coerce
        .number()
        .int()
        .min(0)
        .max(60_000)
        .catch(1_800)
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_DELAY_MS),
      videoConnectOutcome: callVideoConnectOutcomeSchema
        .catch('connected')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_OUTCOME),
      videoCountdownMs: z.coerce
        .number()
        .int()
        .min(1_000)
        .max(10_000)
        .catch(3_000)
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_VIDEO_COUNTDOWN_MS),
      videoRequestDelayMs: z.coerce
        .number()
        .int()
        .min(0)
        .max(60_000)
        .catch(2_500)
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_DELAY_MS),
      videoRequestOutcome: callVideoRequestOutcomeSchema
        .catch('accepted')
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_OUTCOME),
      videoRejectCooldownMs: z.coerce
        .number()
        .int()
        .min(1_000)
        .max(300_000)
        .catch(30_000)
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REJECT_COOLDOWN_MS),
      videoRequestTimeoutMs: z.coerce
        .number()
        .int()
        .min(500)
        .max(120_000)
        .catch(12_000)
        .parse(input.EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_TIMEOUT_MS),
    });
  })();

export type CallIntent = {
  createdAtIso: string;
  customerId: string;
  hostId: string;
  id: string;
  language: Language;
  minimumRequiredBalancePaise: number;
  rtcChannelName: string;
  status: 'created' | 'released' | 'ringing';
};

export const callIntentSchema = z.object({
  createdAtIso: z.iso.datetime(),
  customerId: z.string().min(1),
  hostId: z.string().min(1),
  id: z.string().min(1),
  language: languageSchema,
  minimumRequiredBalancePaise: z.number().int().nonnegative(),
  rtcChannelName: z.string().min(1),
  status: z.enum(['created', 'released', 'ringing']),
}) satisfies z.ZodType<CallIntent>;

export type CreateCallIntentInput = {
  customerId: string;
  host: Pick<HostSummary, 'id' | 'language'>;
  minimumRequiredBalancePaise: number;
};

export type CallMediaResource = {
  id: string;
  kind: 'voice';
  preparedAtIso: string;
  provider: 'expo-audio' | 'mock';
};

export type StartVoiceSessionInput = {
  host: Pick<
    HostSummary,
    | 'age'
    | 'displayName'
    | 'id'
    | 'language'
    | 'profileImageUri'
    | 'videoAvailableAfterMinutes'
    | 'videoRate'
    | 'voiceRate'
  >;
  intent: CallIntent;
  mediaResource: CallMediaResource;
};

export type RingHostInput = {
  intent: CallIntent;
  signal: AbortSignal;
};

export interface CallPreconnectAdapter {
  createCallIntent(input: CreateCallIntentInput): Promise<CallIntent>;
  getMicrophonePermission(): Promise<MicrophonePermissionState>;
  prepareVoiceResources(intent: CallIntent): Promise<CallMediaResource>;
  releaseCallIntent(intentId: string): Promise<void> | void;
  releaseVoiceResources(resourceId: string): Promise<void> | void;
  requestMicrophonePermission(): Promise<
    Exclude<MicrophonePermissionState, 'prompt'>
  >;
  ringHost(input: RingHostInput): Promise<Exclude<CallRingOutcome, 'timeout'>>;
}

export interface CallSessionAdapter {
  endVoiceSession(sessionId: string): Promise<void>;
  startVoiceSession(
    input: StartVoiceSessionInput,
  ): Promise<ActiveVoiceCallSession>;
}

export type CallMediaBridge = Pick<
  CallPreconnectAdapter,
  | 'getMicrophonePermission'
  | 'prepareVoiceResources'
  | 'releaseVoiceResources'
  | 'requestMicrophonePermission'
>;

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

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortReasonAsError(signal));
      },
      { once: true },
    );
  });

export const ringWithTimeout = async (
  input: RingHostInput & {
    adapter: Pick<CallPreconnectAdapter, 'ringHost'>;
    timeoutMs: number;
  },
): Promise<CallRingOutcome | 'cancelled'> => {
  if (input.signal.aborted) {
    return 'cancelled';
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve('timeout');
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([
      input.adapter
        .ringHost({ intent: input.intent, signal: input.signal })
        .catch((error: unknown) => {
          if (input.signal.aborted) {
            return 'cancelled' as const;
          }

          throw error;
        }),
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

export type MockCallPreconnectAdapterOptions = {
  now?: () => Date;
  runtimeConfig: CallRuntimeConfig;
};

export const createMockCallPreconnectAdapter = ({
  now = () => new Date(),
  runtimeConfig,
}: MockCallPreconnectAdapterOptions): CallPreconnectAdapter & {
  getCreatedIntentCount: () => number;
} => {
  const activeIntents = new Map<string, CallIntent>();
  let createdIntentCount = 0;
  const mediaBridge = createMockCallMediaBridge({ now, runtimeConfig });

  return {
    async createCallIntent(input) {
      await wait(120);

      const key = `${input.customerId}:${input.host.id}`;
      const existing = activeIntents.get(key);

      if (existing !== undefined && existing.status !== 'released') {
        return existing;
      }

      createdIntentCount += 1;

      const intent: CallIntent = {
        createdAtIso: now().toISOString(),
        customerId: input.customerId,
        hostId: input.host.id,
        id: `mock_call_${input.host.id}_${String(createdIntentCount).padStart(
          3,
          '0',
        )}`,
        language: input.host.language,
        minimumRequiredBalancePaise: input.minimumRequiredBalancePaise,
        rtcChannelName: `mock_channel_${input.host.id}_${String(
          createdIntentCount,
        ).padStart(3, '0')}`,
        status: 'created',
      };

      activeIntents.set(key, intent);

      return intent;
    },
    getCreatedIntentCount: () => createdIntentCount,
    getMicrophonePermission: mediaBridge.getMicrophonePermission,
    prepareVoiceResources: mediaBridge.prepareVoiceResources,
    releaseCallIntent(intentId) {
      for (const [key, intent] of activeIntents.entries()) {
        if (intent.id === intentId) {
          activeIntents.set(key, { ...intent, status: 'released' });
        }
      }
    },
    releaseVoiceResources: mediaBridge.releaseVoiceResources,
    requestMicrophonePermission: mediaBridge.requestMicrophonePermission,
    async ringHost({ signal }) {
      await wait(runtimeConfig.ringDelayMs, signal);

      if (runtimeConfig.ringOutcome === 'timeout') {
        await wait(runtimeConfig.ringTimeoutMs + 50, signal);
        return 'no-answer';
      }

      return runtimeConfig.ringOutcome;
    },
  };
};

export const createMockCallMediaBridge = ({
  now = () => new Date(),
  runtimeConfig,
}: MockCallPreconnectAdapterOptions): CallMediaBridge => ({
  async getMicrophonePermission() {
    await wait(100);
    return runtimeConfig.microphonePermission;
  },
  async prepareVoiceResources(intent) {
    await wait(80);
    return {
      id: `mock_audio_${intent.id}`,
      kind: 'voice',
      preparedAtIso: now().toISOString(),
      provider: 'mock',
    };
  },
  async releaseVoiceResources() {
    await wait(0);
  },
  async requestMicrophonePermission() {
    await wait(160);
    return runtimeConfig.microphoneRequestOutcome;
  },
});

const nativePermissionResponseSchema = z.object({
  granted: z.boolean(),
  status: z.string().min(1),
});

const microphonePermissionFromNative = (
  value: unknown,
): MicrophonePermissionState => {
  const response = nativePermissionResponseSchema.parse(value);

  if (response.granted || response.status === 'granted') {
    return 'granted';
  }

  if (response.status === 'denied') {
    return 'denied';
  }

  return 'prompt';
};

export const createExpoCallMediaBridge = ({
  now = () => new Date(),
}: {
  now?: () => Date;
} = {}): CallMediaBridge => ({
  async getMicrophonePermission() {
    return microphonePermissionFromNative(await getRecordingPermissionsAsync());
  },
  async prepareVoiceResources(intent) {
    await setAudioModeAsync({
      allowsBackgroundRecording: false,
      allowsRecording: true,
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    await setIsAudioActiveAsync(true);

    return {
      id: `expo_audio_${intent.id}`,
      kind: 'voice',
      preparedAtIso: now().toISOString(),
      provider: 'expo-audio',
    };
  },
  async releaseVoiceResources() {
    await setIsAudioActiveAsync(false);
    await setAudioModeAsync({
      allowsBackgroundRecording: false,
      allowsRecording: false,
      shouldPlayInBackground: false,
    });
  },
  async requestMicrophonePermission() {
    const permission = microphonePermissionFromNative(
      await requestRecordingPermissionsAsync(),
    );

    return permission === 'prompt' ? 'denied' : permission;
  },
});

const hostRingResponseSchema = z.object({
  outcome: z.enum(['accepted', 'busy', 'failed', 'no-answer', 'rejected']),
});

export const createHttpCallPreconnectAdapter = ({
  httpClient,
  mediaBridge,
}: {
  httpClient: HttpClient;
  mediaBridge: CallMediaBridge;
}): CallPreconnectAdapter => ({
  createCallIntent: (input) =>
    httpClient.request({
      body: {
        customerId: input.customerId,
        hostId: input.host.id,
        language: input.host.language,
        minimumRequiredBalancePaise: input.minimumRequiredBalancePaise,
      },
      method: 'POST',
      path: '/v1/calls/intents',
      responseSchema: callIntentSchema,
    }),
  getMicrophonePermission: mediaBridge.getMicrophonePermission,
  prepareVoiceResources: mediaBridge.prepareVoiceResources,
  releaseCallIntent: async (intentId) => {
    if (intentId.trim().length === 0) {
      return;
    }

    await httpClient.request({
      method: 'POST',
      path: `/v1/calls/intents/${encodeURIComponent(intentId)}/release`,
      responseSchema: okResponseSchema,
    });
  },
  releaseVoiceResources: mediaBridge.releaseVoiceResources,
  requestMicrophonePermission: mediaBridge.requestMicrophonePermission,
  ringHost: async ({ intent, signal }) => {
    const response = await httpClient.request({
      body: { hostId: intent.hostId },
      method: 'POST',
      path: `/v1/calls/intents/${encodeURIComponent(intent.id)}/ring`,
      responseSchema: hostRingResponseSchema,
      signal,
    });

    return response.outcome;
  },
});

export const createMockCallSessionAdapter = ({
  now = () => new Date(),
}: {
  now?: () => Date;
} = {}): CallSessionAdapter => ({
  async endVoiceSession() {
    await wait(0);
  },
  async startVoiceSession({ host, intent, mediaResource }) {
    await wait(60);
    const startedAt = now();

    return {
      agoraAppId: 'mock-agora-app-id',
      callId: intent.id,
      customerId: intent.customerId,
      hostAge: host.age,
      hostId: intent.hostId,
      hostLanguage: host.language,
      hostName: host.displayName,
      ...(host.profileImageUri === undefined
        ? {}
        : { hostProfileImageUri: host.profileImageUri }),
      id: `mock_session_${intent.id}`,
      mediaResourceId: mediaResource.id,
      provider: 'mock',
      rtcChannelName: intent.rtcChannelName,
      rtcToken: `mock_rtc_token_${intent.id}`,
      startedAtIso: startedAt.toISOString(),
      tokenExpiresAtIso: new Date(
        startedAt.getTime() + 10 * 60 * 1000,
      ).toISOString(),
      videoAvailableAfterMinutes: host.videoAvailableAfterMinutes,
      videoRate: host.videoRate,
      voiceRate: host.voiceRate,
    };
  },
});

export const createHttpCallSessionAdapter = ({
  agoraAppId,
  httpClient,
  now = () => new Date(),
  requestToken,
}: {
  agoraAppId: string;
  httpClient?: HttpClient;
  now?: () => Date;
  requestToken?: (input: {
    callId: string;
    role: 'customer';
  }) => Promise<CallToken>;
}): CallSessionAdapter => {
  const tokenRequester =
    requestToken ??
    ((input: { callId: string; role: 'customer' }) => {
      if (httpClient === undefined) {
        throw new Error('HTTP call token client is not configured.');
      }

      return httpClient.request({
        body: input,
        method: 'POST',
        path: '/v1/calls/token',
        responseSchema: callTokenSchema,
      });
    });

  return {
    async endVoiceSession(sessionId) {
      if (httpClient === undefined) {
        await Promise.resolve();
        return;
      }

      await httpClient.request({
        method: 'POST',
        path: `/v1/calls/sessions/${encodeURIComponent(sessionId)}/end`,
        responseSchema: okResponseSchema,
      });
    },
    async startVoiceSession({ host, intent, mediaResource }) {
      const token = await tokenRequester({
        callId: intent.id,
        role: 'customer',
      });

      return {
        agoraAppId,
        callId: intent.id,
        customerId: intent.customerId,
        hostAge: host.age,
        hostId: intent.hostId,
        hostLanguage: host.language,
        hostName: host.displayName,
        ...(host.profileImageUri === undefined
          ? {}
          : { hostProfileImageUri: host.profileImageUri }),
        id: `active_session_${intent.id}`,
        mediaResourceId: mediaResource.id,
        provider: 'agora',
        rtcChannelName: intent.rtcChannelName,
        rtcToken: token.token,
        startedAtIso: now().toISOString(),
        tokenExpiresAtIso: token.expiresAtIso,
        videoAvailableAfterMinutes: host.videoAvailableAfterMinutes,
        videoRate: host.videoRate,
        voiceRate: host.voiceRate,
      };
    },
  };
};

const runtimeConfig = parseCallRuntimeConfig(process.env);
const httpClient = createFetchHttpClient({
  baseUrl: mobileRuntimeConfig.apiBaseUrl,
});
const nativeMediaBridge = createExpoCallMediaBridge();

export const callPreconnectAdapter =
  runtimeConfig.providerMode === 'mock'
    ? createMockCallPreconnectAdapter({ runtimeConfig })
    : createHttpCallPreconnectAdapter({
        httpClient,
        mediaBridge: nativeMediaBridge,
      });

export const callSessionAdapter =
  runtimeConfig.providerMode === 'mock'
    ? createMockCallSessionAdapter()
    : createHttpCallSessionAdapter({
        agoraAppId: mobileRuntimeConfig.agoraAppId,
        httpClient,
      });

export const callPreconnectRuntimeConfig = runtimeConfig;
