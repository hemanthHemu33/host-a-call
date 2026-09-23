import {
  createApiError,
  createFetchHttpClient,
  FrontendApiError,
  type HttpClient,
  moneySchema,
} from '@connecto/domain';
import { z } from 'zod';

import { mobileRuntimeConfig } from '@/config/runtime';

const referralContractHistoryStatusSchema = z.enum([
  'pending',
  'qualified',
  'rewarded',
  'rejected',
  'expired',
]);
export type ReferralContractHistoryStatus = z.infer<
  typeof referralContractHistoryStatusSchema
>;

const referralContractPerspectiveSchema = z.enum(['new-customer', 'referrer']);
export type ReferralContractPerspective = z.infer<
  typeof referralContractPerspectiveSchema
>;

const referralContractTimelineStepKeySchema = z.enum([
  'joined',
  'minimum-add-money-met',
  'first-paid-call-completed',
  'verification',
  'reward-released',
]);
const referralContractTimelineStepStateSchema = z.enum([
  'complete',
  'current',
  'pending',
  'locked',
  'rejected',
  'expired',
]);

export const referralContractTimelineStepSchema = z.object({
  completedAtIso: z.iso.datetime().nullable().default(null),
  helperText: z.string().min(1),
  key: referralContractTimelineStepKeySchema,
  label: z.string().min(1),
  state: referralContractTimelineStepStateSchema,
});
export type ReferralContractTimelineStep = z.infer<
  typeof referralContractTimelineStepSchema
>;

const referralContractReviewStatusSchema = z.enum([
  'none',
  'pending',
  'approved',
  'rejected',
  'fraud-review',
]);

export const referralContractReviewSchema = z.object({
  message: z.string().min(1).nullable().default(null),
  status: referralContractReviewStatusSchema,
});
export type ReferralContractReview = z.infer<
  typeof referralContractReviewSchema
>;

const referralContractLedgerReleaseStateSchema = z.enum([
  'not-linked',
  'pending-verification',
  'verified',
]);

export const referralContractLedgerLinkSchema = z.object({
  releaseState: referralContractLedgerReleaseStateSchema,
  rewardTransactionId: z.string().min(1).nullable().default(null),
  rewardTransactionReferenceId: z.string().min(1).nullable().default(null),
});
export type ReferralContractLedgerLink = z.infer<
  typeof referralContractLedgerLinkSchema
>;

export const referralContractHistoryRecordSchema = z.object({
  code: z.string().min(1),
  createdAtIso: z.iso.datetime(),
  headline: z.string().min(1),
  id: z.string().min(1),
  ledgerLink: referralContractLedgerLinkSchema,
  perspective: referralContractPerspectiveSchema,
  review: referralContractReviewSchema,
  rewardAmount: moneySchema,
  rewardReleasedAtIso: z.iso.datetime().nullable().default(null),
  status: referralContractHistoryStatusSchema,
  statusMessage: z.string().min(1),
  subjectLabel: z.string().min(1),
  timeline: referralContractTimelineStepSchema.array().length(5),
  updatedAtIso: z.iso.datetime(),
});
export type ReferralContractHistoryRecord = z.infer<
  typeof referralContractHistoryRecordSchema
>;

export const referralContractRuleSchema = z.object({
  body: z.string().min(1),
  id: z.string().min(1),
  title: z.string().min(1),
});
export type ReferralContractRule = z.infer<typeof referralContractRuleSchema>;

export const referralContractOverviewSchema = z.object({
  appliedReferralCode: z.string().min(1).nullable().default(null),
  history: referralContractHistoryRecordSchema.array(),
  ownReferralCode: z.string().min(1),
  rewardAmounts: z.object({
    newCustomer: moneySchema,
    referrer: moneySchema,
  }),
  rules: referralContractRuleSchema.array().min(1),
  shareLink: z.string().min(1),
  shareMessage: z.string().min(1),
});
export type ReferralContractOverview = z.infer<
  typeof referralContractOverviewSchema
>;

const referralInviteAttributionStatusSchema = z.enum([
  'resolved',
  'invalid',
  'expired',
]);

export const referralInviteAttributionSchema = z.object({
  attributionStatus: referralInviteAttributionStatusSchema,
  campaignLabel: z.string().min(1).nullable().default(null),
  code: z.string().min(1),
  inviterDisplayName: z.string().min(1).nullable().default(null),
  landingMessage: z.string().min(1).nullable().default(null),
  shareLink: z.string().min(1).nullable().default(null),
});
export type ReferralInviteAttribution = z.infer<
  typeof referralInviteAttributionSchema
>;

const referralCodeValidationOutcomeSchema = z.enum([
  'already-used',
  'invalid',
  'pending-qualification',
  'valid',
]);

export const referralCodeValidationContractSchema = z.object({
  campaignLabel: z.string().min(1).nullable().default(null),
  code: z.string().min(1),
  inviterDisplayName: z.string().min(1).nullable().default(null),
  message: z.string().min(1),
  outcome: referralCodeValidationOutcomeSchema,
});
export type ReferralCodeValidationContract = z.infer<
  typeof referralCodeValidationContractSchema
>;

export interface ReferralContractClient {
  getDetail(input: {
    customerId: string;
    ownReferralCode: string;
    referralId: string;
  }): Promise<ReferralContractHistoryRecord>;
  getOverview(input: {
    customerId: string;
    ownReferralCode: string;
  }): Promise<ReferralContractOverview>;
  resolveInviteAttribution(input: {
    code: string;
  }): Promise<ReferralInviteAttribution>;
  validateCode(input: {
    code: string;
    phoneNumber: string;
  }): Promise<ReferralCodeValidationContract>;
}

const rewardAmounts = {
  newCustomer: {
    amountPaise: 10_000,
    currency: 'INR',
  } as const,
  referrer: {
    amountPaise: 10_000,
    currency: 'INR',
  } as const,
};

const buildMockReferralDeepLink = (code: string) =>
  `connecto://referral/${code.trim().toUpperCase()}`;

const buildMockShareMessage = (code: string) =>
  `Join me on Connecto with my referral code ${code}. Rewards unlock only after your first qualified add-money, paid call, and verification.`;

const mockReferralRules = referralContractRuleSchema.array().parse([
  {
    body: 'A valid signup must happen through a referral code or shared deep link before the first verified login.',
    id: 'signup-rule',
    title: 'Code entry is signup-only',
  },
  {
    body: 'Rewards move only after the invited customer reaches the minimum add-money amount and completes the first paid call.',
    id: 'qualification-rule',
    title: 'Qualification takes activity',
  },
  {
    body: 'Verification always runs before release. The app never promises instant referral rewards.',
    id: 'verification-rule',
    title: 'Verification gates every reward',
  },
]);

const mockReferralHistoryBase = referralContractHistoryRecordSchema
  .array()
  .parse([
    {
      code: 'CONNECTO100',
      createdAtIso: '2026-07-16T00:00:00.000Z',
      headline: 'Joining reward released',
      id: 'referral_self_reward_1',
      ledgerLink: {
        releaseState: 'verified',
        rewardTransactionId: 'transaction_4',
        rewardTransactionReferenceId: 'referral_self_reward_1',
      },
      perspective: 'new-customer',
      review: {
        message: null,
        status: 'approved',
      },
      rewardAmount: rewardAmounts.newCustomer,
      rewardReleasedAtIso: '2026-07-16T05:45:00.000Z',
      status: 'rewarded',
      statusMessage:
        'Your joining reward posted only after payment and call verification finished.',
      subjectLabel: 'You joined using CONNECTO100',
      timeline: [
        {
          completedAtIso: '2026-07-16T00:00:00.000Z',
          helperText: 'Your account was created with a valid referral code.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-16T00:06:00.000Z',
          helperText: 'Minimum add-money threshold reached.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-16T00:10:00.000Z',
          helperText: 'First paid call completed successfully.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-16T05:30:00.000Z',
          helperText: 'Verification finished before any reward was promised.',
          key: 'verification',
          label: 'Verification',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-16T05:45:00.000Z',
          helperText: 'Reward released to the wallet ledger.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'complete',
        },
      ],
      updatedAtIso: '2026-07-16T05:45:00.000Z',
    },
    {
      code: 'CUSTONE100',
      createdAtIso: '2026-07-17T06:00:00.000Z',
      headline: 'Referrer reward released',
      id: 'referral_invite_reward_1',
      ledgerLink: {
        releaseState: 'verified',
        rewardTransactionId: null,
        rewardTransactionReferenceId: 'referral_invite_reward_1',
      },
      perspective: 'referrer',
      review: {
        message: null,
        status: 'approved',
      },
      rewardAmount: rewardAmounts.referrer,
      rewardReleasedAtIso: '2026-07-17T08:10:00.000Z',
      status: 'rewarded',
      statusMessage:
        'Your invited customer cleared verification, so the reward was released to your wallet.',
      subjectLabel: 'Aarohi completed every referral milestone',
      timeline: [
        {
          completedAtIso: '2026-07-17T06:00:00.000Z',
          helperText: 'Aarohi signed up using your code.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T06:20:00.000Z',
          helperText: 'The minimum add-money threshold was met.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T06:50:00.000Z',
          helperText: 'The first paid call counted toward referral release.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T07:55:00.000Z',
          helperText: 'Verification finished before the reward moved.',
          key: 'verification',
          label: 'Verification',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T08:10:00.000Z',
          helperText: 'Reward released to your wallet ledger.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'complete',
        },
      ],
      updatedAtIso: '2026-07-17T08:10:00.000Z',
    },
    {
      code: 'CUSTONE100',
      createdAtIso: '2026-07-17T09:00:00.000Z',
      headline: 'Qualification still pending',
      id: 'referral_invite_pending_1',
      ledgerLink: {
        releaseState: 'pending-verification',
        rewardTransactionId: null,
        rewardTransactionReferenceId: null,
      },
      perspective: 'referrer',
      review: {
        message: null,
        status: 'none',
      },
      rewardAmount: rewardAmounts.referrer,
      rewardReleasedAtIso: null,
      status: 'pending',
      statusMessage:
        'Meghana has joined, but the qualified add-money and first paid call milestones are still incomplete.',
      subjectLabel: 'Meghana joined with your code',
      timeline: [
        {
          completedAtIso: '2026-07-17T09:00:00.000Z',
          helperText: 'The referral link created a new account.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: null,
          helperText:
            'Reward rules require a minimum add-money amount before the first call counts.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'current',
        },
        {
          completedAtIso: null,
          helperText: 'The first paid call must complete after the top-up.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'pending',
        },
        {
          completedAtIso: null,
          helperText: 'Verification starts only after the paid-call milestone.',
          key: 'verification',
          label: 'Verification',
          state: 'locked',
        },
        {
          completedAtIso: null,
          helperText: 'Rewards never move instantly on signup alone.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'locked',
        },
      ],
      updatedAtIso: '2026-07-17T09:10:00.000Z',
    },
    {
      code: 'CUSTONE100',
      createdAtIso: '2026-07-17T07:05:00.000Z',
      headline: 'Waiting on verification',
      id: 'referral_invite_qualified_1',
      ledgerLink: {
        releaseState: 'pending-verification',
        rewardTransactionId: null,
        rewardTransactionReferenceId: null,
      },
      perspective: 'referrer',
      review: {
        message:
          'Qualification completed successfully. Reward release still waits for backend verification before any wallet credit is posted.',
        status: 'pending',
      },
      rewardAmount: rewardAmounts.referrer,
      rewardReleasedAtIso: null,
      status: 'qualified',
      statusMessage:
        'Kavya completed the money and call milestones. Reward release still waits for verification.',
      subjectLabel: 'Kavya finished the qualifying activity',
      timeline: [
        {
          completedAtIso: '2026-07-17T07:05:00.000Z',
          helperText: 'The referral signup was created successfully.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T07:30:00.000Z',
          helperText: 'Qualified top-up completed.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T08:00:00.000Z',
          helperText: 'First paid call finished.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'complete',
        },
        {
          completedAtIso: null,
          helperText:
            'Verification remains pending. The reward stays unreleased until this step completes.',
          key: 'verification',
          label: 'Verification',
          state: 'current',
        },
        {
          completedAtIso: null,
          helperText: 'Release follows only after verification approval.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'locked',
        },
      ],
      updatedAtIso: '2026-07-17T08:05:00.000Z',
    },
    {
      code: 'CUSTONE100',
      createdAtIso: '2026-07-15T13:20:00.000Z',
      headline: 'Verification review did not release reward',
      id: 'referral_invite_rejected_1',
      ledgerLink: {
        releaseState: 'not-linked',
        rewardTransactionId: null,
        rewardTransactionReferenceId: null,
      },
      perspective: 'referrer',
      review: {
        message:
          'This referral was held after policy review. Reused devices, recycled numbers, or unusual payment patterns can keep rewards from releasing, and support can only explain the outcome after review is complete.',
        status: 'fraud-review',
      },
      rewardAmount: rewardAmounts.referrer,
      rewardReleasedAtIso: null,
      status: 'rejected',
      statusMessage:
        'The referral did not pass verification review, so no reward was released.',
      subjectLabel: 'Rhea entered policy review',
      timeline: [
        {
          completedAtIso: '2026-07-15T13:20:00.000Z',
          helperText: 'The invited account was created.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-15T13:45:00.000Z',
          helperText: 'Qualified top-up completed.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-15T14:30:00.000Z',
          helperText: 'First paid call completed.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-15T18:00:00.000Z',
          helperText: 'Verification closed without approving reward release.',
          key: 'verification',
          label: 'Verification',
          state: 'rejected',
        },
        {
          completedAtIso: null,
          helperText: 'No reward was issued from this review outcome.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'locked',
        },
      ],
      updatedAtIso: '2026-07-15T18:00:00.000Z',
    },
    {
      code: 'CUSTONE100',
      createdAtIso: '2026-07-10T09:15:00.000Z',
      headline: 'Referral expired',
      id: 'referral_invite_expired_1',
      ledgerLink: {
        releaseState: 'not-linked',
        rewardTransactionId: null,
        rewardTransactionReferenceId: null,
      },
      perspective: 'referrer',
      review: {
        message: null,
        status: 'none',
      },
      rewardAmount: rewardAmounts.referrer,
      rewardReleasedAtIso: null,
      status: 'expired',
      statusMessage:
        'The qualification window ended before the required add-money and paid-call milestones were completed.',
      subjectLabel: 'Nisha did not complete the referral window',
      timeline: [
        {
          completedAtIso: '2026-07-10T09:15:00.000Z',
          helperText: 'The invited account was created.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: null,
          helperText: 'The required top-up was not completed in time.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'expired',
        },
        {
          completedAtIso: null,
          helperText: 'The first paid call never qualified inside the window.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'expired',
        },
        {
          completedAtIso: null,
          helperText: 'Verification never started.',
          key: 'verification',
          label: 'Verification',
          state: 'expired',
        },
        {
          completedAtIso: null,
          helperText: 'Expired referrals do not release wallet rewards.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'expired',
        },
      ],
      updatedAtIso: '2026-07-12T09:15:00.000Z',
    },
  ]);

const mockCodeValidationFixtures: Record<
  string,
  ReferralCodeValidationContract
> = {
  CONNECTO100: {
    campaignLabel: 'Founding referral',
    code: 'CONNECTO100',
    inviterDisplayName: 'Anjali',
    message: 'Referral applied. Rewards unlock after the first qualified call.',
    outcome: 'valid',
  },
  USEDONCE: {
    campaignLabel: null,
    code: 'USEDONCE',
    inviterDisplayName: 'Anjali',
    message: 'This referral code has already been used on another account.',
    outcome: 'already-used',
  },
  WAITLIST: {
    campaignLabel: 'Priority waitlist invite',
    code: 'WAITLIST',
    inviterDisplayName: 'Meghana',
    message: 'Referral saved. Qualification is still pending for this code.',
    outcome: 'pending-qualification',
  },
};

const mockInviteAttributionFixtures: Record<string, ReferralInviteAttribution> =
  {
    CONNECTO100: {
      attributionStatus: 'resolved',
      campaignLabel: 'Founding referral',
      code: 'CONNECTO100',
      inviterDisplayName: 'Anjali',
      landingMessage:
        'Invite ownership resolved from the referral service. Continue signup to lock this code before your first verified login.',
      shareLink: buildMockReferralDeepLink('CONNECTO100'),
    },
    USEDONCE: {
      attributionStatus: 'resolved',
      campaignLabel: null,
      code: 'USEDONCE',
      inviterDisplayName: 'Anjali',
      landingMessage:
        'Invite ownership resolved from the referral service. This code may still be rejected later if it was already used.',
      shareLink: buildMockReferralDeepLink('USEDONCE'),
    },
    WAITLIST: {
      attributionStatus: 'resolved',
      campaignLabel: 'Priority waitlist invite',
      code: 'WAITLIST',
      inviterDisplayName: 'Meghana',
      landingMessage:
        'Invite ownership resolved from the referral service. Qualification is still pending for this code.',
      shareLink: buildMockReferralDeepLink('WAITLIST'),
    },
  };

const normalizeCode = (value: string) => value.trim().toUpperCase();

const referralContractPaths = {
  detail: (customerId: string, referralId: string) =>
    `/v1/customers/${encodeURIComponent(customerId)}/referrals/${encodeURIComponent(referralId)}`,
  overview: (customerId: string, ownReferralCode: string) =>
    `/v1/customers/${encodeURIComponent(customerId)}/referrals/overview?ownReferralCode=${encodeURIComponent(ownReferralCode)}`,
  resolveInvite: (code: string) =>
    `/v1/referrals/invitations/resolve?code=${encodeURIComponent(code)}`,
  validate: '/v1/referrals/validate',
};

const createMockOverviewContract = (
  ownReferralCode: string,
): ReferralContractOverview => {
  const normalizedCode = normalizeCode(ownReferralCode);

  return referralContractOverviewSchema.parse({
    appliedReferralCode: 'CONNECTO100',
    history: mockReferralHistoryBase.map((record) => ({
      ...record,
      code: record.perspective === 'referrer' ? normalizedCode : record.code,
    })),
    ownReferralCode: normalizedCode,
    rewardAmounts,
    rules: mockReferralRules,
    shareLink: buildMockReferralDeepLink(normalizedCode),
    shareMessage: buildMockShareMessage(normalizedCode),
  });
};

const referralNotFoundError = () =>
  new FrontendApiError(
    createApiError({
      code: 'not-found',
      message: 'The selected referral was not found.',
      retryable: false,
    }),
  );

const resolveMockCodeValidation = (code: string) => {
  const normalizedCode = normalizeCode(code);
  const fixture = mockCodeValidationFixtures[normalizedCode];

  if (fixture !== undefined) {
    return referralCodeValidationContractSchema.parse(fixture);
  }

  return referralCodeValidationContractSchema.parse({
    campaignLabel: null,
    code: normalizedCode,
    inviterDisplayName: null,
    message: 'Enter a valid referral code or continue without one.',
    outcome: 'invalid',
  });
};

const resolveMockInviteAttribution = (code: string) => {
  const normalizedCode = normalizeCode(code);
  const fixture = mockInviteAttributionFixtures[normalizedCode];

  if (fixture !== undefined) {
    return referralInviteAttributionSchema.parse(fixture);
  }

  return referralInviteAttributionSchema.parse({
    attributionStatus: 'invalid',
    campaignLabel: null,
    code: normalizedCode,
    inviterDisplayName: null,
    landingMessage: 'The referral link could not be resolved.',
    shareLink: null,
  });
};

export const createMockReferralContractClient = (): ReferralContractClient => ({
  getDetail: ({ ownReferralCode, referralId }) => {
    const detail = createMockOverviewContract(ownReferralCode).history.find(
      (record) => record.id === referralId,
    );

    if (detail === undefined) {
      return Promise.reject(referralNotFoundError());
    }

    return Promise.resolve(detail);
  },
  getOverview: ({ ownReferralCode }) =>
    Promise.resolve(createMockOverviewContract(ownReferralCode)),
  resolveInviteAttribution: ({ code }) =>
    Promise.resolve(resolveMockInviteAttribution(code)),
  validateCode: ({ code }) => Promise.resolve(resolveMockCodeValidation(code)),
});

export const createHttpReferralContractClient = (
  httpClient: HttpClient = createFetchHttpClient({
    baseUrl: mobileRuntimeConfig.apiBaseUrl,
  }),
): ReferralContractClient => ({
  getDetail: ({ customerId, referralId }) =>
    httpClient.request({
      method: 'GET',
      path: referralContractPaths.detail(customerId, referralId),
      responseSchema: referralContractHistoryRecordSchema,
    }),
  getOverview: ({ customerId, ownReferralCode }) =>
    httpClient.request({
      method: 'GET',
      path: referralContractPaths.overview(customerId, ownReferralCode),
      responseSchema: referralContractOverviewSchema,
    }),
  resolveInviteAttribution: ({ code }) =>
    httpClient.request({
      method: 'GET',
      path: referralContractPaths.resolveInvite(code),
      responseSchema: referralInviteAttributionSchema,
    }),
  validateCode: (body) =>
    httpClient.request({
      body,
      method: 'POST',
      path: referralContractPaths.validate,
      responseSchema: referralCodeValidationContractSchema,
    }),
});

export const referralContractClient =
  mobileRuntimeConfig.providerMode === 'mock'
    ? createMockReferralContractClient()
    : createHttpReferralContractClient();
