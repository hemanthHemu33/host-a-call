import { z } from 'zod';

import {
  createApiError,
  okResponseSchema,
  type HttpClient,
} from '@connecto/domain';

import type { ActiveVoiceCallSession } from '@/store/call.store';
import type {
  ActiveCallSessionPatch,
  VideoFallbackReason,
  VideoUpgradeInput,
} from './active-call.models';
import type { CallRuntimeConfig } from './call.preconnect';

export const activeCallVideoUpgradeStatusSchema = z.enum([
  'accepted',
  'failed',
  'pending',
  'rejected',
  'timeout',
]);
export type ActiveCallVideoUpgradeStatus = z.infer<
  typeof activeCallVideoUpgradeStatusSchema
>;

export const activeCallVideoUpgradeSchema = z.object({
  createdAtIso: z.iso.datetime(),
  id: z.string().min(1),
  rtcToken: z.string().min(1).nullable(),
  status: activeCallVideoUpgradeStatusSchema,
  tokenExpiresAtIso: z.iso.datetime().nullable(),
  updatedAtIso: z.iso.datetime(),
});
export type ActiveCallVideoUpgrade = z.infer<
  typeof activeCallVideoUpgradeSchema
>;

const activeCallSessionPatchSchema = z.object({
  rtcToken: z.string().min(1).nullable().optional(),
  tokenExpiresAtIso: z.iso.datetime().nullable().optional(),
});

const activeCallRemoteVideoVerificationSchema = z.object({
  connectedAtIso: z.iso.datetime(),
  rtcToken: z.string().min(1).nullable().optional(),
  tokenExpiresAtIso: z.iso.datetime().nullable().optional(),
  verificationStatus: z.enum(['pending', 'verified']).catch('verified'),
  videoBillingStatus: z
    .enum(['active', 'verification-pending', 'voice-only'])
    .catch('active'),
});

const createVideoUpgradeError = (message: string) =>
  createApiError({
    code: 'server',
    message,
  });

const asSessionPatch = (value: z.infer<typeof activeCallSessionPatchSchema>) =>
  ({
    ...(value.rtcToken === undefined || value.rtcToken === null
      ? {}
      : { rtcToken: value.rtcToken }),
    ...(value.tokenExpiresAtIso === undefined ||
    value.tokenExpiresAtIso === null
      ? {}
      : { tokenExpiresAtIso: value.tokenExpiresAtIso }),
  }) satisfies ActiveCallSessionPatch;

const createMockVideoUpgrade = ({
  now,
  session,
  status,
}: {
  now: Date;
  session: ActiveVoiceCallSession;
  status: ActiveCallVideoUpgradeStatus;
}): ActiveCallVideoUpgrade =>
  activeCallVideoUpgradeSchema.parse({
    createdAtIso: now.toISOString(),
    id: `mock_video_${session.callId}_${String(now.getTime())}`,
    rtcToken: status === 'accepted' ? `mock_video_rtc_${session.callId}` : null,
    status,
    tokenExpiresAtIso:
      status === 'accepted'
        ? new Date(now.getTime() + 10 * 60 * 1_000).toISOString()
        : null,
    updatedAtIso: now.toISOString(),
  });

export interface ActiveCallBackendAdapter {
  activateVideoMode(
    input: VideoUpgradeInput & {
      videoUpgrade: ActiveCallVideoUpgrade;
    },
  ): Promise<ActiveCallSessionPatch>;
  cancelVideoUpgradeRequest(input: VideoUpgradeInput): Promise<void>;
  ensureVideoUpgradeRequest(
    input: VideoUpgradeInput,
  ): Promise<ActiveCallVideoUpgrade>;
  getVideoUpgradeRequest(sessionId: string): ActiveCallVideoUpgrade | null;
  markVideoFallback(
    input: VideoUpgradeInput & {
      reason: VideoFallbackReason;
    },
  ): Promise<void>;
  pollVideoUpgrade(input: VideoUpgradeInput): Promise<ActiveCallVideoUpgrade>;
  verifyRemoteVideoConnected(
    input: VideoUpgradeInput & {
      connectedAtIso: string;
      videoUpgrade: ActiveCallVideoUpgrade | null;
    },
  ): Promise<ActiveCallSessionPatch>;
}

export const createMockActiveCallBackendAdapter = ({
  now = () => new Date(),
  runtimeConfig,
}: {
  now?: () => Date;
  runtimeConfig: CallRuntimeConfig;
}): ActiveCallBackendAdapter => {
  const requestState = new Map<string, ActiveCallVideoUpgrade | null>();

  const resolveMockVideoUpgrade = (
    session: ActiveVoiceCallSession,
  ): ActiveCallVideoUpgrade => {
    const request = requestState.get(session.id) ?? null;

    if (request === null) {
      throw new Error(
        createVideoUpgradeError('Video request has not started.').message,
      );
    }

    const nowDate = now();
    const elapsedMs = Math.max(
      0,
      nowDate.getTime() - new Date(request.createdAtIso).getTime(),
    );

    let nextStatus = request.status;

    if (
      runtimeConfig.videoRequestOutcome === 'pending' ||
      runtimeConfig.videoRequestOutcome === 'timeout'
    ) {
      nextStatus =
        elapsedMs >= runtimeConfig.videoRequestTimeoutMs
          ? 'timeout'
          : 'pending';
    } else if (elapsedMs >= runtimeConfig.videoRequestDelayMs) {
      nextStatus = runtimeConfig.videoRequestOutcome;
    } else {
      nextStatus = 'pending';
    }

    const resolved = activeCallVideoUpgradeSchema.parse({
      ...request,
      rtcToken:
        nextStatus === 'accepted'
          ? `mock_video_rtc_${session.callId}`
          : request.rtcToken,
      status: nextStatus,
      tokenExpiresAtIso:
        nextStatus === 'accepted'
          ? new Date(nowDate.getTime() + 10 * 60 * 1_000).toISOString()
          : request.tokenExpiresAtIso,
      updatedAtIso: nowDate.toISOString(),
    });

    requestState.set(session.id, resolved);
    return resolved;
  };

  return {
    activateVideoMode({ videoUpgrade }) {
      if (videoUpgrade.status !== 'accepted') {
        throw new Error(
          createVideoUpgradeError(
            'Video cannot start until the host accepts the request.',
          ).message,
        );
      }

      return Promise.resolve({
        ...(videoUpgrade.rtcToken === null
          ? {}
          : { rtcToken: videoUpgrade.rtcToken }),
        ...(videoUpgrade.tokenExpiresAtIso === null
          ? {}
          : { tokenExpiresAtIso: videoUpgrade.tokenExpiresAtIso }),
      });
    },
    cancelVideoUpgradeRequest({ session }) {
      requestState.set(session.id, null);
      return Promise.resolve();
    },
    ensureVideoUpgradeRequest({ session }) {
      const existing = requestState.get(session.id) ?? null;

      if (existing !== null && existing.status === 'pending') {
        return Promise.resolve(existing);
      }

      const request = createMockVideoUpgrade({
        now: now(),
        session,
        status: 'pending',
      });
      requestState.set(session.id, request);
      return Promise.resolve(request);
    },
    getVideoUpgradeRequest(sessionId) {
      return requestState.get(sessionId) ?? null;
    },
    markVideoFallback({ session }) {
      requestState.set(session.id, null);
      return Promise.resolve();
    },
    pollVideoUpgrade({ session }) {
      return Promise.resolve(resolveMockVideoUpgrade(session));
    },
    verifyRemoteVideoConnected({ videoUpgrade }) {
      return Promise.resolve({
        ...(videoUpgrade?.rtcToken === null ||
        videoUpgrade?.rtcToken === undefined
          ? {}
          : { rtcToken: videoUpgrade.rtcToken }),
        ...(videoUpgrade?.tokenExpiresAtIso === null ||
        videoUpgrade?.tokenExpiresAtIso === undefined
          ? {}
          : { tokenExpiresAtIso: videoUpgrade.tokenExpiresAtIso }),
      });
    },
  };
};

export const createHttpActiveCallBackendAdapter = ({
  httpClient,
  now = () => new Date(),
}: {
  httpClient: HttpClient;
  now?: () => Date;
}): ActiveCallBackendAdapter => {
  const requestState = new Map<string, ActiveCallVideoUpgrade | null>();

  return {
    async activateVideoMode({ session, signal, videoUpgrade }) {
      if (videoUpgrade.status !== 'accepted') {
        throw new Error(
          createVideoUpgradeError(
            'Video cannot start until the host accepts the request.',
          ).message,
        );
      }

      const response = await httpClient.request({
        body: {
          callId: session.callId,
          currentRtcToken: session.rtcToken,
          currentTokenExpiresAtIso: session.tokenExpiresAtIso,
          videoRequestId: videoUpgrade.id,
        },
        method: 'POST',
        path: `/v1/calls/sessions/${encodeURIComponent(session.id)}/video/activate`,
        responseSchema: activeCallSessionPatchSchema,
        signal,
      });

      return asSessionPatch(response);
    },
    async cancelVideoUpgradeRequest({ session, signal }) {
      const request = requestState.get(session.id) ?? null;

      if (request === null) {
        return;
      }

      await httpClient.request({
        method: 'POST',
        path: `/v1/calls/${encodeURIComponent(session.callId)}/video-upgrade/${encodeURIComponent(request.id)}/cancel`,
        responseSchema: okResponseSchema,
        signal,
      });

      requestState.set(session.id, null);
    },
    async ensureVideoUpgradeRequest({ session, signal }) {
      const request = await httpClient.request({
        method: 'POST',
        path: `/v1/calls/${encodeURIComponent(session.callId)}/video-upgrade`,
        responseSchema: activeCallVideoUpgradeSchema,
        signal,
      });
      requestState.set(session.id, request);
      return request;
    },
    getVideoUpgradeRequest(sessionId) {
      return requestState.get(sessionId) ?? null;
    },
    async markVideoFallback({ reason, session, signal }) {
      await httpClient.request({
        body: {
          atIso: now().toISOString(),
          reason,
        },
        method: 'POST',
        path: `/v1/calls/sessions/${encodeURIComponent(session.id)}/video/voice-fallback`,
        responseSchema: okResponseSchema,
        signal,
      });

      requestState.set(session.id, null);
    },
    async pollVideoUpgrade({ session, signal }) {
      const request = requestState.get(session.id) ?? null;

      if (request === null) {
        throw new Error(
          createVideoUpgradeError('Video request has not started.').message,
        );
      }

      const next = await httpClient.request({
        method: 'GET',
        path: `/v1/calls/${encodeURIComponent(session.callId)}/video-upgrade/${encodeURIComponent(request.id)}`,
        responseSchema: activeCallVideoUpgradeSchema,
        signal,
      });
      requestState.set(session.id, next);
      return next;
    },
    async verifyRemoteVideoConnected({
      connectedAtIso,
      session,
      signal,
      videoUpgrade,
    }) {
      const response = await httpClient.request({
        body: {
          callId: session.callId,
          connectedAtIso,
          videoRequestId: videoUpgrade?.id ?? null,
        },
        method: 'POST',
        path: `/v1/calls/sessions/${encodeURIComponent(session.id)}/video/connected`,
        responseSchema: activeCallRemoteVideoVerificationSchema,
        signal,
      });

      return asSessionPatch(response);
    },
  };
};
