import { mobileRuntimeConfig } from '@/config/runtime';

export type SamvadMobileRole = 'CALLER' | 'HOST';
export type SamvadKycStatus = 'not-started' | 'pending' | 'verified';

export type SamvadTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
};

export type SamvadUser = {
  id: string;
  isNewUser: boolean;
  isProfileComplete: boolean;
  phoneNumber: string;
  role: SamvadMobileRole;
};

export type SamvadAuthResponse = {
  profile: Record<string, unknown> | null;
  tokens: SamvadTokens;
  user: SamvadUser;
};

export type SamvadKycResult = {
  age?: number;
  isDigilockerVerified: boolean;
  kycStatus: string;
  message?: string;
  verifiedAt?: string;
};

export type SamvadKycInitiation = {
  authUrl: string;
  expiresAt: string;
  instructions: string;
  isSandbox: boolean;
  state: string;
};

export class SamvadApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SamvadApiError';
  }
}

const apiBaseUrl = () => mobileRuntimeConfig.apiBaseUrl.replace(/\/$/, '');

const endpoint = (path: string) => `${apiBaseUrl()}/${path.replace(/^\//, '')}`;

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

const messageFromPayload = (payload: unknown, fallback: string) => {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message.filter((value): value is string => typeof value === 'string').join(' ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
};

const request = async <T>(input: {
  accessToken?: string;
  body?: Record<string, unknown>;
  method: 'GET' | 'PATCH' | 'POST';
  path: string;
}): Promise<T> => {
  const response = await fetch(endpoint(input.path), {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers: {
      Accept: 'application/json',
      ...(input.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(input.accessToken === undefined
        ? {}
        : { Authorization: `Bearer ${input.accessToken}` }),
    },
    method: input.method,
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new SamvadApiError(
      messageFromPayload(payload, 'The request could not be completed.'),
      response.status,
    );
  }

  return payload as T;
};

export const isSamvadUnauthorized = (error: unknown) =>
  error instanceof SamvadApiError && error.status === 401;

export const verifyFirebasePhoneIdentity = (input: {
  idToken: string;
  phoneNumber: string;
}) =>
  request<SamvadAuthResponse>({
    body: input,
    method: 'POST',
    path: 'auth/otp/verify',
  });

export const registerSamvadCaller = (
  accessToken: string,
  input: {
    conversationIntents: string[];
    displayName: string;
    preferredLanguages: string[];
    stateCity?: string;
  },
) =>
  request<SamvadAuthResponse>({
    accessToken,
    body: {
      ...input,
      ageConfirmed: true,
      gender: 'MALE',
    },
    method: 'POST',
    path: 'auth/register/caller',
  });

export const registerSamvadHost = (
  accessToken: string,
  input: {
    categories: string[];
    displayName: string;
    languages: string[];
    referralCode?: string | null;
  },
) =>
  request<SamvadAuthResponse>({
    accessToken,
    body: {
      ...input,
      ageConfirmed: true,
      gender: 'FEMALE',
      referralCode: input.referralCode?.trim() || undefined,
    },
    method: 'POST',
    path: 'auth/register/host',
  });

export const refreshSamvadTokens = (refreshToken: string) =>
  request<SamvadTokens>({
    body: { refreshToken },
    method: 'POST',
    path: 'auth/refresh-token',
  });

export const getSamvadProfile = (accessToken: string) =>
  request<{ profile: Record<string, unknown> | null; user: SamvadUser }>({
    accessToken,
    method: 'GET',
    path: 'auth/me',
  });

export const logoutSamvadSession = (accessToken: string) =>
  request<{ success: boolean }>({
    accessToken,
    method: 'POST',
    path: 'auth/logout',
  });

export const getSamvadKycStatus = (accessToken: string) =>
  request<SamvadKycResult>({
    accessToken,
    method: 'GET',
    path: 'verification/digilocker/status',
  });

export const initiateSamvadKyc = (accessToken: string) =>
  request<SamvadKycInitiation>({
    accessToken,
    method: 'POST',
    path: 'verification/digilocker/initiate',
  });

export const simulateSamvadKyc = (accessToken: string) =>
  request<unknown>({
    accessToken,
    body: { scenario: 'VALID_FEMALE' },
    method: 'POST',
    path: 'verification/digilocker/simulate',
  });
