import { z } from 'zod';

import { mobileRuntimeConfig } from './runtime';

const samvadRoleSchema = z.enum(['CALLER', 'HOST']);
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

export type SamvadRole = z.infer<typeof samvadRoleSchema>;

export type SamvadTokens = z.infer<typeof samvadTokensSchema>;

export type SamvadUser = z.infer<typeof samvadUserSchema>;

export type SamvadSession = z.infer<typeof samvadSessionSchema>;

export type SamvadKycStatus = z.infer<typeof samvadKycStatusSchema>;

export type SamvadKycInitiation = z.infer<typeof samvadKycInitiationSchema>;

type SamvadRegistrationResponse = z.infer<
  typeof samvadRegistrationResponseSchema
>;

export class SamvadApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
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

const completedRegistrationSession = (
  response: SamvadRegistrationResponse,
): SamvadSession => ({
  ...response,
  user: {
    ...response.user,
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
    method: 'GET' | 'POST';
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
      throw new SamvadApiError(errorMessage(payload), response.status);
    }

    const parsed = input.schema.safeParse(payload);

    if (!parsed.success) {
      throw new SamvadApiError('Samvad returned an invalid response.', 502);
    }

    return parsed.data;
  };

  return {
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
    refresh: (refreshToken: string) =>
      request<SamvadTokens>({
        body: { refreshToken },
        method: 'POST',
        path: 'auth/refresh-token',
        schema: samvadTokensSchema,
      }),
    registerCaller: async (accessToken: string, displayName: string) =>
      completedRegistrationSession(
        await request<SamvadRegistrationResponse>({
          accessToken,
          body: {
            ageConfirmed: true,
            conversationIntents: ['Casual Conversation'],
            displayName,
            gender: 'MALE',
            preferredLanguages: ['English', 'Hindi'],
          },
          method: 'POST',
          path: 'auth/register/caller',
          schema: samvadRegistrationResponseSchema,
        }),
      ),
    registerHost: async (accessToken: string, displayName: string) =>
      completedRegistrationSession(
        await request<SamvadRegistrationResponse>({
          accessToken,
          body: {
            ageConfirmed: true,
            categories: ['Casual Conversation'],
            displayName,
            gender: 'FEMALE',
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
    verifyFirebasePhone: (phoneNumber: string, idToken: string) =>
      request<SamvadSession>({
        body: { idToken, phoneNumber },
        method: 'POST',
        path: 'auth/otp/verify',
        schema: samvadSessionSchema,
      }),
  };
};

export const samvadApi = createSamvadApi();

export const isUnauthorized = (error: unknown) =>
  error instanceof SamvadApiError && error.status === 401;
