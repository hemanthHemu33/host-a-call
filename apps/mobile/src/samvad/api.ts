import { z } from 'zod';

import { mobileRuntimeConfig } from './runtime';

const samvadRoleSchema = z.enum(['CALLER', 'HOST']);
const accountStateSchema = z.object({
  reason: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETION_PENDING']),
  statusChangedAt: z.iso.datetime().nullable(),
});
const samvadTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
});
const samvadUserSchema = z.object({
  id: z.string().min(1),
  isNewUser: z.boolean(),
  isProfileComplete: z.boolean(),
  phoneNumber: z.string().min(1),
  role: samvadRoleSchema,
  accountState: accountStateSchema.optional(),
});
const samvadProfileSchema = z.record(z.string(), z.unknown()).nullable();
const samvadSessionSchema = z.object({
  profile: samvadProfileSchema,
  tokens: samvadTokensSchema,
  user: samvadUserSchema,
});
const samvadProfileResponseSchema = samvadSessionSchema.omit({ tokens: true });
const samvadRegistrationResponseSchema = z.object({
  profile: samvadProfileSchema,
  tokens: samvadTokensSchema,
  user: samvadUserSchema.pick({ id: true, phoneNumber: true, role: true }),
});
const samvadKycStatusSchema = z.object({
  age: z.number().optional(),
  bankDetailsSubmitted: z.boolean().optional(),
  idNumberMasked: z.string().optional(),
  isDigilockerVerified: z.boolean(),
  kycStatus: z.string().min(1),
  message: z.string().optional(),
  voiceIntroSubmitted: z.boolean().optional(),
  verifiedAt: z.iso.datetime().optional(),
});
const samvadKycInitiationSchema = z.object({
  authUrl: z.url(),
  expiresAt: z.iso.datetime(),
  instructions: z.string().min(1),
  isSandbox: z.boolean(),
  state: z.string().min(1),
});
const otpReservationSchema = z.object({
  provider: z.literal('firebase-client'),
  remainingResends: z.number().int().min(0).max(3),
  requestId: z.string().min(1),
  resendAfterSeconds: z.number().int().positive(),
  success: z.literal(true),
});
const appConfigSchema = z.object({
  maintenance: z.object({
    active: z.boolean(),
    message: z.string().min(1),
  }),
  update: z.object({
    minimumVersion: z.string().min(1),
    required: z.boolean(),
    url: z.string(),
  }),
});
const authSessionSummarySchema = z.object({
  createdAt: z.iso.datetime(),
  current: z.boolean(),
  deviceName: z.string().min(1),
  id: z.string().min(1),
  lastSeenAt: z.iso.datetime(),
  platform: z.string().min(1),
});
const accountStatusResponseSchema = z.object({
  accountState: accountStateSchema,
  deletionRequestedAt: z.iso.datetime().nullable(),
  deletionScheduledFor: z.iso.datetime().nullable(),
});

export type SamvadRole = z.infer<typeof samvadRoleSchema>;

export type SamvadTokens = z.infer<typeof samvadTokensSchema>;

export type SamvadUser = z.infer<typeof samvadUserSchema>;

export type SamvadSession = z.infer<typeof samvadSessionSchema>;

export type SamvadKycStatus = z.infer<typeof samvadKycStatusSchema>;

export type SamvadKycInitiation = z.infer<typeof samvadKycInitiationSchema>;
export type SamvadAccountState = z.infer<typeof accountStateSchema>;
export type SamvadAppConfig = z.infer<typeof appConfigSchema>;
export type SamvadAuthSessionSummary = z.infer<typeof authSessionSummarySchema>;
export type SamvadAccountStatus = z.infer<typeof accountStatusResponseSchema>;
export type SamvadOtpReservation = z.infer<typeof otpReservationSchema>;

export type SamvadDeviceContext = {
  deviceFingerprint: string;
  deviceName: string;
  fcmToken?: string;
  platform: 'android' | 'ios' | 'web' | 'unknown';
};

type SamvadRegistrationResponse = z.infer<
  typeof samvadRegistrationResponseSchema
>;

export class SamvadApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
    readonly retryAfterSeconds: number | null = null,
    readonly accountState: SamvadAccountState | null = null,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'SamvadApiError';
  }
}

type FetchLike = typeof fetch;

const readPayload = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const errorMessage = (payload: unknown) => {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message
        .filter((item): item is string => typeof item === 'string')
        .join(' ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Samvad could not complete that request.';
};

const errorDetails = (payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) {
    return {
      accountState: null,
      code: null,
      retryAfterSeconds: null,
    };
  }
  const candidate = payload as Record<string, unknown>;
  const parsedState = accountStateSchema.safeParse(candidate.accountState);
  return {
    accountState: parsedState.success ? parsedState.data : null,
    code: typeof candidate.code === 'string' ? candidate.code : null,
    retryAfterSeconds:
      typeof candidate.retryAfterSeconds === 'number'
        ? candidate.retryAfterSeconds
        : null,
  };
};

const completedRegistrationSession = (
  response: SamvadRegistrationResponse,
): SamvadSession => ({
  ...response,
  user: {
    ...response.user,
    accountState: {
      reason: null,
      status: 'ACTIVE',
      statusChangedAt: null,
    },
    isNewUser: false,
    isProfileComplete: true,
  },
});

export const createSamvadApi = (
  baseUrl = mobileRuntimeConfig.apiBaseUrl,
  fetchImpl: FetchLike = fetch,
) => {
  const endpoint = (path: string) =>
    `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

  const request = async <T>(input: {
    accessToken?: string;
    body?: Record<string, unknown>;
    method: 'DELETE' | 'GET' | 'PATCH' | 'POST';
    path: string;
    schema: z.ZodType<T>;
  }): Promise<T> => {
    const response = await fetchImpl(endpoint(input.path), {
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      headers: {
        Accept: 'application/json',
        ...(input.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(input.accessToken === undefined
          ? {}
          : { Authorization: `Bearer ${input.accessToken}` }),
      },
      method: input.method,
    });
    const payload = await readPayload(response);

    if (!response.ok) {
      const details = errorDetails(payload);
      throw new SamvadApiError(
        errorMessage(payload),
        response.status,
        details.code,
        details.retryAfterSeconds,
        details.accountState,
        payload,
      );
    }

    const parsed = input.schema.safeParse(payload);

    if (!parsed.success) {
      throw new SamvadApiError('Samvad returned an invalid response.', 502);
    }

    return parsed.data;
  };

  return {
    getAppConfig: (platform: string, version: string) =>
      request<SamvadAppConfig>({
        method: 'GET',
        path: `auth/app-config?platform=${encodeURIComponent(platform)}&version=${encodeURIComponent(version)}`,
        schema: appConfigSchema,
      }),
    getAccountStatus: (accessToken: string) =>
      request<SamvadAccountStatus>({
        accessToken,
        method: 'GET',
        path: 'auth/account-status',
        schema: accountStatusResponseSchema,
      }),
    getKycStatus: (accessToken: string) =>
      request<SamvadKycStatus>({
        accessToken,
        method: 'GET',
        path: 'verification/digilocker/status',
        schema: samvadKycStatusSchema,
      }),
    getProfile: (accessToken: string) =>
      request<Omit<SamvadSession, 'tokens'>>({
        accessToken,
        method: 'GET',
        path: 'auth/me',
        schema: samvadProfileResponseSchema,
      }),
    initiateKyc: (accessToken: string) =>
      request<SamvadKycInitiation>({
        accessToken,
        method: 'POST',
        path: 'verification/digilocker/initiate',
        schema: samvadKycInitiationSchema,
      }),
    logout: (accessToken: string) =>
      request<{ success: boolean }>({
        accessToken,
        method: 'POST',
        path: 'auth/logout',
        schema: z.object({ success: z.boolean() }),
      }),
    logoutAll: (accessToken: string) =>
      request<{ success: boolean }>({
        accessToken,
        method: 'POST',
        path: 'auth/logout-all',
        schema: z.object({ success: z.boolean() }),
      }),
    listSessions: (accessToken: string) =>
      request<{ sessions: SamvadAuthSessionSummary[] }>({
        accessToken,
        method: 'GET',
        path: 'auth/sessions',
        schema: z.object({ sessions: z.array(authSessionSummarySchema) }),
      }),
    revokeSession: (accessToken: string, sessionId: string) =>
      request<{ currentSessionRevoked: boolean; success: boolean }>({
        accessToken,
        method: 'DELETE',
        path: `auth/sessions/${encodeURIComponent(sessionId)}`,
        schema: z.object({
          currentSessionRevoked: z.boolean(),
          success: z.boolean(),
        }),
      }),
    registerDeviceToken: (accessToken: string, token: string) =>
      request<{ registered: boolean }>({
        accessToken,
        body: { token },
        method: 'POST',
        path: 'auth/device-token',
        schema: z.object({ registered: z.boolean() }),
      }),
    unregisterDeviceToken: (accessToken: string, token: string) =>
      request<{ unregistered: boolean }>({
        accessToken,
        body: { token },
        method: 'DELETE',
        path: 'auth/device-token',
        schema: z.object({ unregistered: z.boolean() }),
      }),
    refresh: (refreshToken: string) =>
      request<SamvadTokens>({
        body: { refreshToken },
        method: 'POST',
        path: 'auth/refresh-token',
        schema: samvadTokensSchema,
      }),
    registerCaller: async (
      accessToken: string,
      input: {
        dateOfBirth: string;
        displayName: string;
        gender: 'FEMALE' | 'MALE';
      },
    ) =>
      completedRegistrationSession(
        await request<SamvadRegistrationResponse>({
          accessToken,
          body: {
            conversationIntents: ['Casual Conversation'],
            ...input,
            preferredLanguages: ['English', 'Hindi'],
          },
          method: 'POST',
          path: 'auth/register/caller',
          schema: samvadRegistrationResponseSchema,
        }),
      ),
    registerHost: async (
      accessToken: string,
      input: {
        dateOfBirth: string;
        displayName: string;
        gender: 'FEMALE' | 'MALE';
      },
    ) =>
      completedRegistrationSession(
        await request<SamvadRegistrationResponse>({
          accessToken,
          body: {
            categories: ['Casual Conversation'],
            ...input,
            languages: ['English', 'Hindi'],
          },
          method: 'POST',
          path: 'auth/register/host',
          schema: samvadRegistrationResponseSchema,
        }),
      ),
    simulateKyc: (accessToken: string) =>
      request<unknown>({
        accessToken,
        body: { scenario: 'VALID_FEMALE' },
        method: 'POST',
        path: 'verification/digilocker/simulate',
        schema: z.unknown(),
      }),
    requestOtp: (phoneNumber: string) =>
      request<SamvadOtpReservation>({
        body: { phoneNumber },
        method: 'POST',
        path: 'auth/otp/send',
        schema: otpReservationSchema,
      }),
    verifyFirebasePhone: (
      phoneNumber: string,
      idToken: string,
      device: SamvadDeviceContext,
    ) =>
      request<SamvadSession>({
        body: { idToken, phoneNumber, ...device },
        method: 'POST',
        path: 'auth/otp/verify',
        schema: samvadSessionSchema,
      }),
    updateProfile: (accessToken: string, profile: Record<string, unknown>) =>
      request<Omit<SamvadSession, 'tokens'>>({
        accessToken,
        body: profile,
        method: 'PATCH',
        path: 'auth/me',
        schema: samvadProfileResponseSchema,
      }),
    deleteAccount: (accessToken: string) =>
      request<SamvadAccountStatus>({
        accessToken,
        body: { confirmation: 'DELETE' },
        method: 'DELETE',
        path: 'auth/me',
        schema: accountStatusResponseSchema,
      }),
  };
};

export const samvadApi = createSamvadApi();

export const isUnauthorized = (error: unknown) =>
  error instanceof SamvadApiError && error.status === 401;

export const isAccountStateError = (
  error: unknown,
): error is SamvadApiError & { accountState: SamvadAccountState } =>
  error instanceof SamvadApiError && error.accountState !== null;
