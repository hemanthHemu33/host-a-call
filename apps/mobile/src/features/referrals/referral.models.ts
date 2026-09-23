import { moneySchema, type Money } from '@connecto/domain';
import { z } from 'zod';

export const referralHistoryStatusSchema = z.enum([
  'pending',
  'qualified',
  'rewarded',
  'rejected',
  'expired',
]);
export type ReferralHistoryStatus = z.infer<typeof referralHistoryStatusSchema>;

export const referralPerspectiveSchema = z.enum(['new-customer', 'referrer']);
export type ReferralPerspective = z.infer<typeof referralPerspectiveSchema>;

export const referralTimelineStepKeySchema = z.enum([
  'joined',
  'minimum-add-money-met',
  'first-paid-call-completed',
  'verification',
  'reward-released',
]);
export type ReferralTimelineStepKey = z.infer<
  typeof referralTimelineStepKeySchema
>;

export const referralTimelineStepStateSchema = z.enum([
  'complete',
  'current',
  'pending',
  'locked',
  'rejected',
  'expired',
]);
export type ReferralTimelineStepState = z.infer<
  typeof referralTimelineStepStateSchema
>;

export const referralTimelineStepSchema = z.object({
  completedAtIso: z.iso.datetime().nullable().default(null),
  helperText: z.string().min(1),
  key: referralTimelineStepKeySchema,
  label: z.string().min(1),
  state: referralTimelineStepStateSchema,
});
export type ReferralTimelineStep = z.infer<typeof referralTimelineStepSchema>;

export const referralHistoryRecordSchema = z.object({
  antiAbuseMessage: z.string().min(1).nullable().default(null),
  code: z.string().min(1),
  createdAtIso: z.iso.datetime(),
  headline: z.string().min(1),
  id: z.string().min(1),
  rewardAmount: moneySchema,
  rewardReleasedAtIso: z.iso.datetime().nullable().default(null),
  rewardTransactionId: z.string().min(1).nullable().default(null),
  status: referralHistoryStatusSchema,
  statusMessage: z.string().min(1),
  subjectLabel: z.string().min(1),
  timeline: referralTimelineStepSchema.array().length(5),
  updatedAtIso: z.iso.datetime(),
  perspective: referralPerspectiveSchema,
});
export type ReferralHistoryRecord = z.infer<typeof referralHistoryRecordSchema>;

export const referralRuleSchema = z.object({
  body: z.string().min(1),
  id: z.string().min(1),
  title: z.string().min(1),
});
export type ReferralRule = z.infer<typeof referralRuleSchema>;

export const referralOverviewSchema = z.object({
  appliedReferralCode: z.string().min(1).nullable().default(null),
  history: referralHistoryRecordSchema.array(),
  ownReferralCode: z.string().min(1),
  shareLink: z.string().min(1),
  shareMessage: z.string().min(1),
  rules: referralRuleSchema.array().min(1),
  rewardAmounts: z.object({
    newCustomer: moneySchema,
    referrer: moneySchema,
  }),
});
export type ReferralOverview = z.infer<typeof referralOverviewSchema>;

export const referralUiStateSchema = z.object({
  celebratedRewardIds: z.string().min(1).array(),
});
export type ReferralUiState = z.infer<typeof referralUiStateSchema>;

export const defaultReferralUiState: ReferralUiState = {
  celebratedRewardIds: [],
};

export const normalizeReferralCode = (value: string | null | undefined) =>
  value?.trim().toUpperCase() ?? '';

export const buildReferralDeepLink = (code: string) =>
  `connecto://referral/${normalizeReferralCode(code)}`;

export const buildOwnReferralCode = (
  displayName: string,
  customerId: string,
) => {
  const normalizedName = displayName
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 6);
  const numericId = customerId.replace(/\D/g, '');
  const suffix = numericId.slice(-4).padStart(4, '0');

  return `${normalizedName || 'CONNECT'}${suffix}`;
};

export const buildReferralInviteMessage = (code: string) =>
  `Join me on Connecto with my referral code ${code}. Rewards unlock only after your first qualified add-money, paid call, and verification.`;

export const formatReferralCurrency = (money: Money) =>
  new Intl.NumberFormat('en-IN', {
    currency: money.currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(money.amountPaise / 100);

export const formatReferralDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

export const resolveReferralStatusLabel = (status: ReferralHistoryStatus) => {
  switch (status) {
    case 'pending':
      return 'Pending qualification';
    case 'qualified':
      return 'Verification pending';
    case 'rewarded':
      return 'Reward released';
    case 'rejected':
      return 'Review closed';
    case 'expired':
      return 'Expired';
  }
};

export const resolveReferralStatusTone = (status: ReferralHistoryStatus) => {
  switch (status) {
    case 'pending':
      return 'warning' as const;
    case 'qualified':
      return 'info' as const;
    case 'rewarded':
      return 'success' as const;
    case 'rejected':
      return 'error' as const;
    case 'expired':
      return 'warning' as const;
  }
};

export const resolveReferralPerspectiveLabel = (
  perspective: ReferralPerspective,
) =>
  perspective === 'new-customer' ? 'Your joining reward' : 'Friend you invited';

const progressWeight = (state: ReferralTimelineStepState) => {
  switch (state) {
    case 'complete':
      return 1;
    case 'current':
      return 0.7;
    case 'rejected':
      return 0.7;
    case 'expired':
      return 0.35;
    case 'locked':
    case 'pending':
      return 0;
  }
};

export const getReferralProgress = (record: ReferralHistoryRecord) =>
  record.timeline.reduce((sum, step) => sum + progressWeight(step.state), 0) /
  record.timeline.length;

export const getReferralCelebrationEligible = (
  record: ReferralHistoryRecord,
  celebratedRewardIds: readonly string[],
) => record.status === 'rewarded' && !celebratedRewardIds.includes(record.id);

export const resolveRetroactiveReferralMessage = (code: string) =>
  `You are already signed in, so ${normalizeReferralCode(code)} cannot be applied retroactively. Referral codes only lock in before the first verified login.`;
