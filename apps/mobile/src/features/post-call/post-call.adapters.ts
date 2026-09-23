import { z } from 'zod';

import { fixtureCustomer, fixtureHosts } from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';

import { seededPostCallState } from './post-call.fixtures';
import {
  clearStoredPostCallState,
  loadStoredPostCallState,
  persistStoredPostCallState,
} from './post-call.storage';
import {
  createInrMoney,
  createPostCallChargeBreakdown,
  derivePostCallMediaSummary,
  postCallPersistedStateSchema,
  postCallRecordSchema,
  postCallSupportTicketSchema,
  sortPostCallRecords,
  type PostCallEndReason,
  type PostCallEvidenceMetadata,
  type PostCallPersistedState,
  type PostCallRating,
  type PostCallRatingTag,
  type PostCallRecord,
  type PostCallSupportTicket,
  type PostCallIssueCategory,
} from './post-call.models';

const postCallRuntimeConfigSchema = z.object({
  finalizationDelayMs: z.coerce.number().int().positive().catch(6_000),
});
export type PostCallRuntimeConfig = z.infer<typeof postCallRuntimeConfigSchema>;

export const postCallRuntimeConfig = postCallRuntimeConfigSchema.parse({
  finalizationDelayMs: process.env.EXPO_PUBLIC_CONNECTO_POST_CALL_FINALIZE_MS,
});

type PostCallClock = {
  now: () => Date;
};

export const defaultPostCallClock: PostCallClock = {
  now: () => new Date(),
};

export type EnsurePostCallRecordInput = {
  callId: string;
  connectedDurationMs: number;
  endedAtIso?: string | undefined;
  hostId: string;
  hostName: string;
  mediaMode: 'video' | 'voice';
  reason?: string | undefined;
  remainingBalancePaise: number;
  sessionId?: string | undefined;
  videoDurationMs?: number | undefined;
};

export type SubmitPostCallRatingInput = {
  callId: string;
  comment: string;
  stars: number;
  tags: PostCallRatingTag[];
};

export type SubmitPostCallSupportTicketInput = {
  category: PostCallIssueCategory;
  comments: string;
  evidence: PostCallEvidenceMetadata | null;
  linkedCallId: string | null;
  requesterId: string;
  subject: string;
};

export interface PostCallAdapter {
  clear(): Promise<void>;
  createEvidenceMetadata(input: {
    callId?: string | undefined;
  }): Promise<PostCallEvidenceMetadata>;
  ensureCallRecord(input: EnsurePostCallRecordInput): Promise<PostCallRecord>;
  getCallRecord(callId: string): Promise<PostCallRecord | null>;
  getSupportTicket(ticketId: string): Promise<PostCallSupportTicket | null>;
  listCallRecords(customerId: string): Promise<PostCallRecord[]>;
  listSupportTickets(customerId: string): Promise<PostCallSupportTicket[]>;
  refreshCallRecord(callId: string): Promise<PostCallRecord | null>;
  submitRating(input: SubmitPostCallRatingInput): Promise<PostCallRecord>;
  submitSupportTicket(
    input: SubmitPostCallSupportTicketInput,
  ): Promise<PostCallSupportTicket>;
}

const unavailable = (
  providerMode: Exclude<typeof mobileRuntimeConfig.providerMode, 'mock'>,
) =>
  new Error(
    `${providerMode} post-call adapters are not connected. Use mock mode until backend contracts are available.`,
  );

const mergeById = <Item extends { id: string }>(
  seeded: readonly Item[],
  stored: readonly Item[],
) => {
  const map = new Map<string, Item>();

  for (const item of seeded) {
    map.set(item.id, item);
  }

  for (const item of stored) {
    map.set(item.id, item);
  }

  return [...map.values()];
};

const normalizeEndReason = (reason: string | undefined): PostCallEndReason =>
  reason === 'balance-zero'
    ? 'balance-zero'
    : reason === 'reconnect-timeout'
      ? 'reconnect-timeout'
      : reason === 'report-submit-end'
        ? 'report-submit-end'
        : reason === 'busy'
          ? 'busy'
          : reason === 'host-ended'
            ? 'host-ended'
            : reason === 'insufficient-balance'
              ? 'insufficient-balance'
              : reason === 'network-failed'
                ? 'network-failed'
                : reason === 'no-answer'
                  ? 'no-answer'
                  : reason === 'rejected'
                    ? 'rejected'
                    : reason === 'system-ended'
                      ? 'system-ended'
                      : reason === 'customer-ended'
                        ? 'customer-ended'
                        : 'manual';

const resolveHostFixture = (hostId: string) =>
  fixtureHosts.find((host) => host.id === hostId) ?? fixtureHosts[0];

const createPendingRecord = (
  input: EnsurePostCallRecordInput,
  clock: PostCallClock,
  runtimeConfig: PostCallRuntimeConfig,
) => {
  const hostFixture = resolveHostFixture(input.hostId);
  const endedAt =
    input.endedAtIso === undefined ? clock.now() : new Date(input.endedAtIso);
  const connectedDurationSeconds = Math.max(
    0,
    Math.round(input.connectedDurationMs / 1_000),
  );
  const videoDurationSeconds =
    input.mediaMode === 'video'
      ? Math.min(
          connectedDurationSeconds,
          Math.max(0, Math.round((input.videoDurationMs ?? 0) / 1_000)),
        )
      : 0;
  const voiceDurationSeconds = Math.max(
    0,
    connectedDurationSeconds - videoDurationSeconds,
  );
  const startedAt = new Date(
    endedAt.getTime() - connectedDurationSeconds * 1_000,
  );
  const estimatedBreakdown = createPostCallChargeBreakdown({
    minimumChargePaise: 500,
    videoDurationSeconds,
    videoRatePaise: hostFixture?.videoRate.amountPaise ?? 1_600,
    voiceDurationSeconds,
    voiceRatePaise: hostFixture?.voiceRate.amountPaise ?? 1_000,
  });

  return postCallRecordSchema.parse({
    callId: input.callId,
    chargeBreakdown: {
      ...estimatedBreakdown,
      finalizedTotal: null,
      finalizedVideo: null,
      finalizedVoice: null,
    },
    connectedDurationSeconds,
    customerId: fixtureCustomer.id,
    endReason: normalizeEndReason(input.reason),
    endedAtIso: endedAt.toISOString(),
    finalizationReadyAtIso: new Date(
      endedAt.getTime() + runtimeConfig.finalizationDelayMs,
    ).toISOString(),
    finalizationStatus: 'processing',
    hostAge: hostFixture?.age ?? 24,
    hostAvatarUri: `mock://connecto/hosts/${hostFixture?.id ?? input.hostId}/avatar`,
    hostId: input.hostId,
    hostName: input.hostName,
    hostPrimaryLanguage: hostFixture?.language ?? 'English',
    hostRank: hostFixture?.rank ?? 'silver',
    id: input.callId,
    linkedSupportTicketId: null,
    mediaSummary: derivePostCallMediaSummary({
      connectedDurationSeconds,
      videoDurationSeconds,
    }),
    priceSnapshot: {
      capturedAtIso: startedAt.toISOString(),
      minimumCharge: createInrMoney(500),
      videoRate: hostFixture?.videoRate ?? createInrMoney(1_600),
      voiceRate: hostFixture?.voiceRate ?? createInrMoney(1_000),
    },
    rating: null,
    sessionId: input.sessionId ?? null,
    startedAtIso: startedAt.toISOString(),
    verificationState: 'pending',
    videoDurationSeconds,
    voiceDurationSeconds,
    walletBalanceAfter: createInrMoney(input.remainingBalancePaise),
  });
};

const finalizeRecord = (record: PostCallRecord) => {
  if (record.finalizationStatus !== 'processing') {
    return record;
  }

  const breakdown = createPostCallChargeBreakdown({
    minimumChargePaise: record.priceSnapshot.minimumCharge.amountPaise,
    videoDurationSeconds: record.videoDurationSeconds,
    videoRatePaise: record.priceSnapshot.videoRate.amountPaise,
    voiceDurationSeconds: record.voiceDurationSeconds,
    voiceRatePaise: record.priceSnapshot.voiceRate.amountPaise,
  });
  const finalizedRecord = postCallRecordSchema.parse({
    ...record,
    chargeBreakdown: breakdown,
    finalizationReadyAtIso: null,
    finalizationStatus: 'finalized',
    verificationState: 'verified',
  });

  return finalizedRecord;
};

const reconcileState = (
  state: PostCallPersistedState,
  clock: PostCallClock,
): PostCallPersistedState => {
  const nowIso = clock.now().toISOString();
  const finalizedRecords = state.callRecords.map((record) => {
    if (
      record.finalizationStatus === 'processing' &&
      record.finalizationReadyAtIso !== null &&
      record.finalizationReadyAtIso <= nowIso
    ) {
      return finalizeRecord(record);
    }

    return record;
  });

  const reconciledRecords = finalizedRecords.map((record) => {
    const linkedTicket = state.supportTickets.find(
      (ticket) => ticket.linkedCallId === record.callId,
    );

    return postCallRecordSchema.parse({
      ...record,
      linkedSupportTicketId: linkedTicket?.id ?? record.linkedSupportTicketId,
    });
  });

  return postCallPersistedStateSchema.parse({
    ...state,
    callRecords: sortPostCallRecords(reconciledRecords),
  });
};

const createHydratedState = (stored: PostCallPersistedState | null) =>
  postCallPersistedStateSchema.parse({
    callRecords: mergeById(
      seededPostCallState.callRecords,
      stored?.callRecords ?? [],
    ),
    supportTickets: mergeById(
      seededPostCallState.supportTickets,
      stored?.supportTickets ?? [],
    ),
    version: 1,
  });

const issueCategoryToSubject = (category: PostCallIssueCategory) =>
  ({
    'audio-quality': 'Audio quality issue',
    billing: 'Billing issue',
    'host-behaviour': 'Host behaviour issue',
    safety: 'Safety issue',
    technical: 'Technical issue',
    'video-quality': 'Video quality issue',
  })[category];

const withStateHelpers = (
  clock: PostCallClock,
  runtimeConfig: PostCallRuntimeConfig,
) => {
  const readState = async () => {
    const stored = await loadStoredPostCallState();
    const hydrated = reconcileState(createHydratedState(stored), clock);
    await persistStoredPostCallState(hydrated);

    return hydrated;
  };

  const writeState = async (state: PostCallPersistedState) => {
    const reconciled = reconcileState(state, clock);
    await persistStoredPostCallState(reconciled);
    return reconciled;
  };

  const ensureCallRecord = async (input: EnsurePostCallRecordInput) => {
    const current = await readState();
    const existing = current.callRecords.find(
      (record) => record.callId === input.callId,
    );

    if (existing !== undefined) {
      return existing;
    }

    const next = postCallPersistedStateSchema.parse({
      ...current,
      callRecords: sortPostCallRecords([
        createPendingRecord(input, clock, runtimeConfig),
        ...current.callRecords,
      ]),
    });

    const persisted = await writeState(next);
    return (
      persisted.callRecords.find((record) => record.callId === input.callId) ??
      null
    );
  };

  return {
    ensureCallRecord,
    readState,
    writeState,
  };
};

export const createMockPostCallAdapter = ({
  clock = defaultPostCallClock,
  runtimeConfig = postCallRuntimeConfig,
}: {
  clock?: PostCallClock;
  runtimeConfig?: PostCallRuntimeConfig;
} = {}): PostCallAdapter => {
  const helpers = withStateHelpers(clock, runtimeConfig);

  return {
    async clear() {
      await clearStoredPostCallState();
    },
    createEvidenceMetadata({ callId }) {
      const nowIso = clock.now().toISOString();
      const suffix = callId ?? 'general';

      return Promise.resolve({
        attachmentId: `attachment_${suffix}_${nowIso}`,
        capturedAtIso: nowIso,
        fileName: `${suffix}-evidence.png`,
        height: 1280,
        uri: `mock://connecto/evidence/${suffix}-${nowIso}.png`,
        width: 720,
      });
    },
    async ensureCallRecord(input) {
      return (await helpers.ensureCallRecord(input)) as PostCallRecord;
    },
    async getCallRecord(callId) {
      const state = await helpers.readState();
      return (
        state.callRecords.find((record) => record.callId === callId) ?? null
      );
    },
    async getSupportTicket(ticketId) {
      const state = await helpers.readState();
      return (
        state.supportTickets.find((ticket) => ticket.id === ticketId) ?? null
      );
    },
    async listCallRecords(customerId) {
      const state = await helpers.readState();
      return state.callRecords.filter(
        (record) => record.customerId === customerId,
      );
    },
    async listSupportTickets(customerId) {
      const state = await helpers.readState();
      return [...state.supportTickets]
        .filter((ticket) => ticket.requesterId === customerId)
        .sort((left, right) =>
          right.updatedAtIso.localeCompare(left.updatedAtIso),
        );
    },
    async refreshCallRecord(callId) {
      const state = await helpers.readState();
      return (
        state.callRecords.find((record) => record.callId === callId) ?? null
      );
    },
    async submitRating(input) {
      const state = await helpers.readState();
      const record = state.callRecords.find(
        (item) => item.callId === input.callId,
      );

      if (record === undefined) {
        throw new Error('Call record was not found.');
      }

      if (record.connectedDurationSeconds === 0) {
        throw new Error('Only connected calls can be rated.');
      }

      if (record.rating !== null) {
        throw new Error('This call has already been rated.');
      }

      const rating = {
        comment: input.comment.trim(),
        stars: input.stars,
        submittedAtIso: clock.now().toISOString(),
        tags: [...input.tags],
      } satisfies PostCallRating;
      const next = postCallPersistedStateSchema.parse({
        ...state,
        callRecords: state.callRecords.map((item) =>
          item.callId === input.callId
            ? postCallRecordSchema.parse({
                ...item,
                rating,
              })
            : item,
        ),
      });
      const persisted = await helpers.writeState(next);
      const updated = persisted.callRecords.find(
        (item) => item.callId === input.callId,
      );

      if (updated === undefined) {
        throw new Error('Rated call could not be reloaded.');
      }

      return updated;
    },
    async submitSupportTicket(input) {
      const state = await helpers.readState();
      const createdAtIso = clock.now().toISOString();
      const ticket = postCallSupportTicketSchema.parse({
        category: input.category,
        comments: input.comments.trim(),
        createdAtIso,
        evidence: input.evidence,
        id: `ticket_postcall_${String(state.supportTickets.length + 1).padStart(3, '0')}`,
        issueSummary: input.subject || issueCategoryToSubject(input.category),
        linkedCallId: input.linkedCallId,
        requesterId: input.requesterId,
        status: 'open',
        ticketReference: `SUP-${String(4300 + state.supportTickets.length)}`,
        updatedAtIso: createdAtIso,
      });
      const next = postCallPersistedStateSchema.parse({
        ...state,
        callRecords:
          input.linkedCallId === null
            ? state.callRecords
            : state.callRecords.map((item) =>
                item.callId === input.linkedCallId
                  ? postCallRecordSchema.parse({
                      ...item,
                      linkedSupportTicketId: ticket.id,
                    })
                  : item,
              ),
        supportTickets: [ticket, ...state.supportTickets],
      });
      const persisted = await helpers.writeState(next);
      const created = persisted.supportTickets.find(
        (item) => item.id === ticket.id,
      );

      if (created === undefined) {
        throw new Error('Support ticket could not be reloaded.');
      }

      return created;
    },
  };
};

export const createUnavailablePostCallAdapter = (
  providerMode: Exclude<typeof mobileRuntimeConfig.providerMode, 'mock'>,
): PostCallAdapter => ({
  clear: () => Promise.reject(unavailable(providerMode)),
  createEvidenceMetadata: () => Promise.reject(unavailable(providerMode)),
  ensureCallRecord: () => Promise.reject(unavailable(providerMode)),
  getCallRecord: () => Promise.reject(unavailable(providerMode)),
  getSupportTicket: () => Promise.reject(unavailable(providerMode)),
  listCallRecords: () => Promise.reject(unavailable(providerMode)),
  listSupportTickets: () => Promise.reject(unavailable(providerMode)),
  refreshCallRecord: () => Promise.reject(unavailable(providerMode)),
  submitRating: () => Promise.reject(unavailable(providerMode)),
  submitSupportTicket: () => Promise.reject(unavailable(providerMode)),
});

export const postCallAdapter =
  mobileRuntimeConfig.providerMode === 'mock'
    ? createMockPostCallAdapter()
    : createUnavailablePostCallAdapter(mobileRuntimeConfig.providerMode);
