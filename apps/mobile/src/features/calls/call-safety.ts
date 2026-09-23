import { z } from 'zod';

import {
  reportKindSchema,
  type Report,
  type ReportKind,
} from '@connecto/domain';

import {
  loadDiscoveryPreferences,
  persistDiscoveryPreferences,
} from '@/features/discovery/discovery.storage';
import { secureStorage } from '@/platform/secure-storage';
import { frontendServices } from '@/services/adapters';

const readParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const optionalNonEmptyRouteParam = z
  .string()
  .min(1)
  .optional()
  .catch(undefined);
const optionalIsoRouteParam = z.iso.datetime().optional().catch(undefined);

export const callSafetyRuntimeConfigSchema = z.object({
  addMoneyGraceMs: z.coerce.number().int().positive().catch(90_000),
  lowBalanceModalThresholdMs: z.coerce.number().int().positive().catch(60_000),
  lowBalanceWarningThresholdMs: z.coerce
    .number()
    .int()
    .positive()
    .catch(120_000),
  reconnectWindowMs: z.coerce.number().int().positive().catch(30_000),
});
export type CallSafetyRuntimeConfig = z.infer<
  typeof callSafetyRuntimeConfigSchema
>;

export const parseCallSafetyRuntimeConfig = (
  input: Record<string, string | undefined>,
): CallSafetyRuntimeConfig =>
  callSafetyRuntimeConfigSchema.parse({
    addMoneyGraceMs: input.EXPO_PUBLIC_CONNECTO_CALL_ADD_MONEY_GRACE_MS,
    lowBalanceModalThresholdMs:
      input.EXPO_PUBLIC_CONNECTO_CALL_LOW_BALANCE_MODAL_MS,
    lowBalanceWarningThresholdMs:
      input.EXPO_PUBLIC_CONNECTO_CALL_LOW_BALANCE_WARNING_MS,
    reconnectWindowMs: input.EXPO_PUBLIC_CONNECTO_CALL_RECONNECT_WINDOW_MS,
  });

export const callSafetyRuntimeConfig = parseCallSafetyRuntimeConfig(
  process.env,
);

export type CallSummaryEndReason =
  'balance-zero' | 'manual' | 'reconnect-timeout' | 'report-submit-end';

export const callSummaryEndReasonSchema = z.enum([
  'balance-zero',
  'manual',
  'reconnect-timeout',
  'report-submit-end',
]);

const normalizeCallSummaryEndReason = (
  reason: string | undefined,
): CallSummaryEndReason =>
  reason === 'balance-zero' ||
  reason === 'reconnect-timeout' ||
  reason === 'report-submit-end'
    ? reason
    : 'manual';

export const callSummaryRouteParamsSchema = z.object({
  callId: z.string().min(1).optional(),
  connectedDurationMs: z.coerce.number().int().nonnegative().catch(0),
  endedAtIso: z.iso.datetime().optional(),
  hostId: z.string().min(1).optional(),
  hostName: z.string().min(1).optional(),
  mediaMode: z.enum(['video', 'voice']).catch('voice'),
  remainingBalancePaise: z.coerce.number().int().nonnegative().catch(0),
  reason: callSummaryEndReasonSchema.optional(),
  sessionId: z.string().min(1).optional(),
  videoDurationMs: z.coerce.number().int().nonnegative().catch(0),
});
export type CallSummaryRouteParams = z.infer<
  typeof callSummaryRouteParamsSchema
>;

const lenientCallSummaryRouteParamsSchema = callSummaryRouteParamsSchema.extend(
  {
    callId: optionalNonEmptyRouteParam,
    endedAtIso: optionalIsoRouteParam,
    hostId: optionalNonEmptyRouteParam,
    hostName: optionalNonEmptyRouteParam,
    reason: callSummaryEndReasonSchema.optional().catch(undefined),
    sessionId: optionalNonEmptyRouteParam,
  },
);

export const parseCallSummaryRouteParams = (
  params: Record<string, string | string[] | undefined>,
): CallSummaryRouteParams =>
  lenientCallSummaryRouteParamsSchema.parse({
    callId: readParam(params.callId),
    connectedDurationMs: readParam(params.connectedDurationMs),
    endedAtIso: readParam(params.endedAtIso),
    hostId: readParam(params.hostId),
    hostName: readParam(params.hostName),
    mediaMode: readParam(params.mediaMode),
    remainingBalancePaise: readParam(params.remainingBalancePaise),
    reason: readParam(params.reason),
    sessionId: readParam(params.sessionId),
    videoDurationMs: readParam(params.videoDurationMs),
  });

export const createCallSummaryRouteParams = (input: {
  callId?: string;
  connectedDurationMs?: number;
  endedAtIso?: string;
  hostId?: string;
  hostName?: string;
  mediaMode?: 'video' | 'voice';
  remainingBalancePaise?: number;
  reason: string;
  sessionId?: string;
  videoDurationMs?: number;
}) =>
  callSummaryRouteParamsSchema.parse({
    ...(input.callId === undefined ? {} : { callId: input.callId }),
    ...(input.connectedDurationMs === undefined
      ? {}
      : { connectedDurationMs: input.connectedDurationMs }),
    ...(input.endedAtIso === undefined ? {} : { endedAtIso: input.endedAtIso }),
    ...(input.hostId === undefined ? {} : { hostId: input.hostId }),
    ...(input.hostName === undefined ? {} : { hostName: input.hostName }),
    ...(input.mediaMode === undefined ? {} : { mediaMode: input.mediaMode }),
    ...(input.remainingBalancePaise === undefined
      ? {}
      : { remainingBalancePaise: input.remainingBalancePaise }),
    reason: normalizeCallSummaryEndReason(input.reason),
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    ...(input.videoDurationMs === undefined
      ? {}
      : { videoDurationMs: input.videoDurationMs }),
  });

export const callReportRouteParamsSchema = z.object({
  callId: z.string().min(1).optional(),
  connectedDurationMs: z.coerce.number().int().nonnegative().catch(0),
  hostId: z.string().min(1).optional(),
  hostName: z.string().min(1).optional(),
  mediaMode: z.enum(['video', 'voice']).catch('voice'),
  remainingBalancePaise: z.coerce.number().int().nonnegative().catch(0),
  sessionId: z.string().min(1).optional(),
});
export type CallReportRouteParams = z.infer<typeof callReportRouteParamsSchema>;

const lenientCallReportRouteParamsSchema = callReportRouteParamsSchema.extend({
  callId: optionalNonEmptyRouteParam,
  hostId: optionalNonEmptyRouteParam,
  hostName: optionalNonEmptyRouteParam,
  sessionId: optionalNonEmptyRouteParam,
});

export const parseCallReportRouteParams = (
  params: Record<string, string | string[] | undefined>,
): CallReportRouteParams =>
  lenientCallReportRouteParamsSchema.parse({
    callId: readParam(params.callId),
    connectedDurationMs: readParam(params.connectedDurationMs),
    hostId: readParam(params.hostId),
    hostName: readParam(params.hostName),
    mediaMode: readParam(params.mediaMode),
    remainingBalancePaise: readParam(params.remainingBalancePaise),
    sessionId: readParam(params.sessionId),
  });

export const createCallReportRouteParams = (input: {
  callId: string;
  connectedDurationMs: number;
  hostId: string;
  hostName: string;
  mediaMode: 'video' | 'voice';
  remainingBalancePaise: number;
  sessionId: string;
}) =>
  callReportRouteParamsSchema.parse({
    callId: input.callId,
    connectedDurationMs: input.connectedDurationMs,
    hostId: input.hostId,
    hostName: input.hostName,
    mediaMode: input.mediaMode,
    remainingBalancePaise: input.remainingBalancePaise,
    sessionId: input.sessionId,
  });

export const callReportCategorySchema = z.enum([
  'abusive-behaviour',
  'explicit-content',
  'fraud-or-scam',
  'quality-or-technical',
  'safety-concern',
]);
export type CallReportCategory = z.infer<typeof callReportCategorySchema>;

type CallReportCategoryOption = {
  description: string;
  kind: ReportKind;
  label: string;
  value: CallReportCategory;
};

export const callReportCategories = [
  {
    description: 'Harassment, threats, or coercive behaviour from the host.',
    kind: reportKindSchema.enum.host,
    label: 'Abusive behaviour',
    value: 'abusive-behaviour',
  },
  {
    description:
      'Sexual, explicit, or otherwise unsafe content during the call.',
    kind: reportKindSchema.enum.content,
    label: 'Explicit content',
    value: 'explicit-content',
  },
  {
    description: 'Payment manipulation, scams, or identity misrepresentation.',
    kind: reportKindSchema.enum.payment,
    label: 'Fraud or scam',
    value: 'fraud-or-scam',
  },
  {
    description:
      'Severe call-quality, recording, or technical reliability issues.',
    kind: reportKindSchema.enum.call,
    label: 'Quality or technical',
    value: 'quality-or-technical',
  },
  {
    description:
      'Anything safety-related that does not fit the other categories.',
    kind: reportKindSchema.enum.call,
    label: 'Safety concern',
    value: 'safety-concern',
  },
] as const satisfies readonly CallReportCategoryOption[];

const callReportCategoryMap = new Map<
  CallReportCategory,
  CallReportCategoryOption
>(callReportCategories.map((option) => [option.value, option]));

export const resolveCallReportCategory = (value: CallReportCategory) => {
  const resolved = callReportCategoryMap.get(value);

  if (resolved === undefined) {
    throw new Error(`Unknown call report category: ${value}`);
  }

  return resolved;
};

export type CallReportContext = {
  callId: string;
  connectedDurationMs: number;
  customerId: string;
  hostId: string;
  hostName: string;
  mediaMode: 'video' | 'voice';
  remainingBalancePaise: number;
  sessionId: string;
};

export const callReportDraftEvidenceSchema = z.object({
  callId: z.string().min(1),
  capturedAtIso: z.iso.datetime(),
  connectedDurationMs: z.number().int().nonnegative(),
  hostId: z.string().min(1),
  hostName: z.string().min(1),
  mediaMode: z.enum(['video', 'voice']),
  remainingBalancePaise: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
});
export type CallReportDraftEvidence = z.infer<
  typeof callReportDraftEvidenceSchema
>;

export const callReportDraftSchema = z.object({
  category: callReportCategorySchema.nullable(),
  comments: z.string(),
  evidence: callReportDraftEvidenceSchema,
  idempotencyKey: z.string().min(1),
  lastUpdatedAtIso: z.iso.datetime(),
});
export type CallReportDraft = z.infer<typeof callReportDraftSchema>;

const callReportDraftStorageKey = 'connecto.call.report.draft';

const buildDraftIdempotencyKey = (context: CallReportContext) =>
  `call-report:${context.sessionId}:${context.callId}:${String(Date.now())}`;

export const createCallReportDraft = (
  context: CallReportContext,
): CallReportDraft => ({
  category: null,
  comments: '',
  evidence: {
    callId: context.callId,
    capturedAtIso: new Date().toISOString(),
    connectedDurationMs: Math.max(0, Math.trunc(context.connectedDurationMs)),
    hostId: context.hostId,
    hostName: context.hostName,
    mediaMode: context.mediaMode,
    remainingBalancePaise: Math.max(
      0,
      Math.trunc(context.remainingBalancePaise),
    ),
    sessionId: context.sessionId,
  },
  idempotencyKey: buildDraftIdempotencyKey(context),
  lastUpdatedAtIso: new Date().toISOString(),
});

export const isCallReportDraftForContext = (
  draft: CallReportDraft,
  context: Pick<CallReportContext, 'callId' | 'sessionId'>,
) =>
  draft.evidence.callId === context.callId &&
  draft.evidence.sessionId === context.sessionId;

export const loadCallReportDraft =
  async (): Promise<CallReportDraft | null> => {
    const raw = await secureStorage.getItemAsync(callReportDraftStorageKey);

    if (raw === null) {
      return null;
    }

    try {
      return callReportDraftSchema.parse(JSON.parse(raw) as unknown);
    } catch {
      await secureStorage.deleteItemAsync(callReportDraftStorageKey);
      return null;
    }
  };

export const persistCallReportDraft = async (draft: CallReportDraft) => {
  const parsed = callReportDraftSchema.parse(draft);
  await secureStorage.setItemAsync(
    callReportDraftStorageKey,
    JSON.stringify(parsed),
  );

  return parsed;
};

export const clearCallReportDraft = async () => {
  await secureStorage.deleteItemAsync(callReportDraftStorageKey);
};

export const updateCallReportDraft = (
  draft: CallReportDraft,
  patch: Partial<Pick<CallReportDraft, 'category' | 'comments'>>,
): CallReportDraft =>
  callReportDraftSchema.parse({
    ...draft,
    ...patch,
    lastUpdatedAtIso: new Date().toISOString(),
  });

export const buildCallReportDescription = (draft: CallReportDraft) => {
  const category =
    draft.category === null ? null : resolveCallReportCategory(draft.category);

  return [
    category === null ? 'Category: Unspecified' : `Category: ${category.label}`,
    draft.comments.trim().length > 0
      ? `Comments: ${draft.comments.trim()}`
      : 'Comments: No additional comments provided.',
    `Evidence: ${draft.evidence.mediaMode} call ${draft.evidence.callId} with ${draft.evidence.hostName} (${draft.evidence.hostId}), captured at ${draft.evidence.capturedAtIso}, connected ${formatCallSafetyDuration(draft.evidence.connectedDurationMs)}, estimated balance remaining ${formatPaise(draft.evidence.remainingBalancePaise)}.`,
  ].join('\n');
};

const inFlightCallReports = new Map<string, Promise<Report>>();
const completedCallReports = new Map<string, Report>();

export interface CallReportAdapter {
  submitReport(input: {
    draft: CallReportDraft;
    reporterId: string;
  }): Promise<Report>;
}

export const callReportAdapter: CallReportAdapter = {
  submitReport: async ({ draft, reporterId }) => {
    const completed = completedCallReports.get(draft.idempotencyKey);

    if (completed !== undefined) {
      return completed;
    }

    const inFlight = inFlightCallReports.get(draft.idempotencyKey);

    if (inFlight !== undefined) {
      return inFlight;
    }

    const category =
      draft.category === null
        ? reportKindSchema.enum.call
        : resolveCallReportCategory(draft.category).kind;

    const request = frontendServices.report
      .createReport({
        description: buildCallReportDescription(draft),
        kind: category,
        reporterId,
        targetId: draft.evidence.hostId,
      })
      .then((report) => {
        completedCallReports.set(draft.idempotencyKey, report);
        return report;
      })
      .finally(() => {
        inFlightCallReports.delete(draft.idempotencyKey);
      });

    inFlightCallReports.set(draft.idempotencyKey, request);

    return request;
  },
};

export const blockHostAfterCall = async (hostId: string) => {
  const preferences = await loadDiscoveryPreferences();

  if (preferences.blockedHostIds.includes(hostId)) {
    return preferences;
  }

  return persistDiscoveryPreferences({
    ...preferences,
    blockedHostIds: [...preferences.blockedHostIds, hostId],
  });
};

export const formatCallSafetyDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
};

export const formatPaise = (amountPaise: number) =>
  new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(Math.max(0, amountPaise) / 100);

export const getReconnectRemainingMs = (
  reconnectStartedAtMs: number | null,
  nowMs: number,
) =>
  reconnectStartedAtMs === null
    ? callSafetyRuntimeConfig.reconnectWindowMs
    : Math.max(
        0,
        callSafetyRuntimeConfig.reconnectWindowMs -
          Math.max(0, nowMs - reconnectStartedAtMs),
      );
