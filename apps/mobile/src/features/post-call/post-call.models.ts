import { z } from 'zod';

import { hostRankSchema, moneySchema, type Money } from '@connecto/domain';

export const postCallHistoryFilterSchema = z.enum([
  'all',
  'voice-video',
  'voice',
  'failed',
]);
export type PostCallHistoryFilter = z.infer<typeof postCallHistoryFilterSchema>;

export const postCallEndReasonSchema = z.enum([
  'balance-zero',
  'busy',
  'customer-ended',
  'host-ended',
  'insufficient-balance',
  'manual',
  'network-failed',
  'no-answer',
  'reconnect-timeout',
  'rejected',
  'report-submit-end',
  'system-ended',
]);
export type PostCallEndReason = z.infer<typeof postCallEndReasonSchema>;

export const postCallMediaSummarySchema = z.enum([
  'failed',
  'voice',
  'voice-video',
]);
export type PostCallMediaSummary = z.infer<typeof postCallMediaSummarySchema>;

export const postCallVerificationStateSchema = z.enum(['pending', 'verified']);
export type PostCallVerificationState = z.infer<
  typeof postCallVerificationStateSchema
>;

export const postCallFinalizationStatusSchema = z.enum([
  'processing',
  'finalized',
]);
export type PostCallFinalizationStatus = z.infer<
  typeof postCallFinalizationStatusSchema
>;

export const postCallRatingTagSchema = z.enum([
  'billing-confusing',
  'call-dropped',
  'clear-audio',
  'engaging',
  'helpful',
  'host-rude',
  'respectful',
  'technical-issue',
]);
export type PostCallRatingTag = z.infer<typeof postCallRatingTagSchema>;

export const postCallIssueCategorySchema = z.enum([
  'audio-quality',
  'billing',
  'host-behaviour',
  'safety',
  'technical',
  'video-quality',
]);
export type PostCallIssueCategory = z.infer<typeof postCallIssueCategorySchema>;

export const postCallEvidenceMetadataSchema = z.object({
  attachmentId: z.string().min(1),
  capturedAtIso: z.iso.datetime(),
  fileName: z.string().min(1),
  height: z.number().int().positive(),
  uri: z.string().min(1),
  width: z.number().int().positive(),
});
export type PostCallEvidenceMetadata = z.infer<
  typeof postCallEvidenceMetadataSchema
>;

export const postCallRatingSchema = z.object({
  comment: z.string(),
  submittedAtIso: z.iso.datetime(),
  tags: postCallRatingTagSchema.array(),
  stars: z.number().int().min(1).max(5),
});
export type PostCallRating = z.infer<typeof postCallRatingSchema>;

export const postCallPriceSnapshotSchema = z.object({
  capturedAtIso: z.iso.datetime(),
  minimumCharge: moneySchema,
  videoRate: moneySchema,
  voiceRate: moneySchema,
});
export type PostCallPriceSnapshot = z.infer<typeof postCallPriceSnapshotSchema>;

export const postCallChargeBreakdownSchema = z.object({
  estimatedTotal: moneySchema,
  estimatedVideo: moneySchema,
  estimatedVoice: moneySchema,
  finalizedTotal: moneySchema.nullable(),
  finalizedVideo: moneySchema.nullable(),
  finalizedVoice: moneySchema.nullable(),
});
export type PostCallChargeBreakdown = z.infer<
  typeof postCallChargeBreakdownSchema
>;

export const postCallRecordSchema = z.object({
  callId: z.string().min(1),
  chargeBreakdown: postCallChargeBreakdownSchema,
  connectedDurationSeconds: z.number().int().nonnegative(),
  customerId: z.string().min(1),
  endReason: postCallEndReasonSchema,
  endedAtIso: z.iso.datetime(),
  finalizationReadyAtIso: z.iso.datetime().nullable(),
  finalizationStatus: postCallFinalizationStatusSchema,
  hostAge: z.number().int().min(18),
  hostAvatarUri: z.string().min(1).optional(),
  hostId: z.string().min(1),
  hostName: z.string().min(1),
  hostPrimaryLanguage: z.string().min(1),
  hostRank: hostRankSchema,
  id: z.string().min(1),
  linkedSupportTicketId: z.string().min(1).nullable(),
  mediaSummary: postCallMediaSummarySchema,
  priceSnapshot: postCallPriceSnapshotSchema,
  rating: postCallRatingSchema.nullable(),
  sessionId: z.string().min(1).nullable(),
  startedAtIso: z.iso.datetime(),
  verificationState: postCallVerificationStateSchema,
  videoDurationSeconds: z.number().int().nonnegative(),
  voiceDurationSeconds: z.number().int().nonnegative(),
  walletBalanceAfter: moneySchema,
});
export type PostCallRecord = z.infer<typeof postCallRecordSchema>;

export const postCallSupportTicketStatusSchema = z.enum([
  'closed',
  'open',
  'waiting-on-support',
  'waiting-on-user',
]);
export type PostCallSupportTicketStatus = z.infer<
  typeof postCallSupportTicketStatusSchema
>;

export const postCallSupportTicketSchema = z.object({
  category: postCallIssueCategorySchema,
  comments: z.string().min(1),
  createdAtIso: z.iso.datetime(),
  evidence: postCallEvidenceMetadataSchema.nullable(),
  id: z.string().min(1),
  issueSummary: z.string().min(1),
  linkedCallId: z.string().min(1).nullable(),
  requesterId: z.string().min(1),
  status: postCallSupportTicketStatusSchema,
  ticketReference: z.string().min(1),
  updatedAtIso: z.iso.datetime(),
});
export type PostCallSupportTicket = z.infer<typeof postCallSupportTicketSchema>;

export const postCallPersistedStateSchema = z.object({
  callRecords: postCallRecordSchema.array(),
  supportTickets: postCallSupportTicketSchema.array(),
  version: z.literal(1),
});
export type PostCallPersistedState = z.infer<
  typeof postCallPersistedStateSchema
>;

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  currency: 'INR',
  maximumFractionDigits: 0,
  style: 'currency',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const clampNonNegativeWhole = (value: number) => Math.max(0, Math.round(value));

export const createInrMoney = (amountPaise: number): Money =>
  moneySchema.parse({
    amountPaise: clampNonNegativeWhole(amountPaise),
    currency: 'INR',
  });

export const formatPostCallCurrency = (money: Money) =>
  currencyFormatter.format(money.amountPaise / 100);

export const formatPostCallDateTime = (iso: string) =>
  dateTimeFormatter.format(new Date(iso));

export const formatPostCallDuration = (seconds: number) => {
  const normalized = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainder = normalized % 60;

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes).padStart(2, '0')}m`;
  }

  if (minutes > 0) {
    return `${String(minutes)}m ${String(remainder).padStart(2, '0')}s`;
  }

  return `${String(remainder)}s`;
};

export const resolvePostCallRatingTagLabel = (tag: PostCallRatingTag) =>
  ({
    'billing-confusing': 'Billing unclear',
    'call-dropped': 'Call dropped',
    'clear-audio': 'Clear audio',
    engaging: 'Engaging',
    helpful: 'Helpful',
    'host-rude': 'Host rude',
    respectful: 'Respectful',
    'technical-issue': 'Technical issue',
  })[tag];

export const resolvePostCallIssueCategoryLabel = (
  category: PostCallIssueCategory,
) =>
  ({
    'audio-quality': 'Audio quality',
    billing: 'Billing',
    'host-behaviour': 'Host behaviour',
    safety: 'Safety',
    technical: 'Technical',
    'video-quality': 'Video quality',
  })[category];

export const resolvePostCallEndReasonLabel = (reason: PostCallEndReason) =>
  ({
    'balance-zero': 'Balance exhausted',
    busy: 'Host busy',
    'customer-ended': 'Customer ended',
    'host-ended': 'Host ended',
    'insufficient-balance': 'Insufficient balance',
    manual: 'Ended manually',
    'network-failed': 'Connection failed',
    'no-answer': 'No answer',
    'reconnect-timeout': 'Reconnect timeout',
    rejected: 'Rejected',
    'report-submit-end': 'Reported and ended',
    'system-ended': 'System ended',
  })[reason];

export const isConnectedPostCall = (record: PostCallRecord) =>
  record.connectedDurationSeconds > 0;

export const applyPostCallHistoryFilter = (
  records: readonly PostCallRecord[],
  filter: PostCallHistoryFilter,
) =>
  records.filter((record) => {
    switch (filter) {
      case 'all':
        return true;
      case 'voice-video':
        return record.videoDurationSeconds > 0;
      case 'voice':
        return (
          record.connectedDurationSeconds > 0 &&
          record.videoDurationSeconds === 0
        );
      case 'failed':
        return record.connectedDurationSeconds === 0;
    }
  });

export const sortPostCallRecords = (
  records: readonly PostCallRecord[],
): PostCallRecord[] =>
  [...records].sort((left, right) =>
    right.endedAtIso.localeCompare(left.endedAtIso),
  );

const calculateRoundedChargePaise = ({
  intervalSeconds,
  minimumChargePaise,
  ratePerMinutePaise,
  seconds,
}: {
  intervalSeconds: number;
  minimumChargePaise: number;
  ratePerMinutePaise: number;
  seconds: number;
}) => {
  if (seconds <= 0 || ratePerMinutePaise <= 0) {
    return 0;
  }

  const billedUnits = Math.ceil(seconds / intervalSeconds) * intervalSeconds;
  const computed = (billedUnits / 60) * ratePerMinutePaise;

  return Math.max(minimumChargePaise, clampNonNegativeWhole(computed));
};

export const createPostCallChargeBreakdown = (input: {
  minimumChargePaise: number;
  videoDurationSeconds: number;
  videoRatePaise: number;
  voiceDurationSeconds: number;
  voiceRatePaise: number;
}): PostCallChargeBreakdown => {
  const estimatedVoicePaise = calculateRoundedChargePaise({
    intervalSeconds: 1,
    minimumChargePaise:
      input.voiceDurationSeconds > 0 ? input.minimumChargePaise : 0,
    ratePerMinutePaise: input.voiceRatePaise,
    seconds: input.voiceDurationSeconds,
  });
  const estimatedVideoPaise = calculateRoundedChargePaise({
    intervalSeconds: 1,
    minimumChargePaise: 0,
    ratePerMinutePaise: input.videoRatePaise,
    seconds: input.videoDurationSeconds,
  });
  const finalizedVoicePaise = calculateRoundedChargePaise({
    intervalSeconds: 30,
    minimumChargePaise:
      input.voiceDurationSeconds > 0 ? input.minimumChargePaise : 0,
    ratePerMinutePaise: input.voiceRatePaise,
    seconds: input.voiceDurationSeconds,
  });
  const finalizedVideoPaise = calculateRoundedChargePaise({
    intervalSeconds: 30,
    minimumChargePaise: 0,
    ratePerMinutePaise: input.videoRatePaise,
    seconds: input.videoDurationSeconds,
  });

  return postCallChargeBreakdownSchema.parse({
    estimatedTotal: createInrMoney(estimatedVoicePaise + estimatedVideoPaise),
    estimatedVideo: createInrMoney(estimatedVideoPaise),
    estimatedVoice: createInrMoney(estimatedVoicePaise),
    finalizedTotal: createInrMoney(finalizedVoicePaise + finalizedVideoPaise),
    finalizedVideo: createInrMoney(finalizedVideoPaise),
    finalizedVoice: createInrMoney(finalizedVoicePaise),
  });
};

export const derivePostCallMediaSummary = (input: {
  connectedDurationSeconds: number;
  videoDurationSeconds: number;
}): PostCallMediaSummary => {
  if (input.connectedDurationSeconds === 0) {
    return 'failed';
  }

  return input.videoDurationSeconds > 0 ? 'voice-video' : 'voice';
};
