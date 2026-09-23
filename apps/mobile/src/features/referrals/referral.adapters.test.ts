import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDevelopmentScenarioStore } from '@/store/development.store';
import type {
  ReferralContractClient,
  ReferralContractHistoryRecord,
  ReferralInviteAttribution,
} from '@/services/referrals/referral-contract';

import {
  createReferralFeatureAdapter,
  createMockReferralFeatureAdapter,
  referralFeatureAdapter,
} from './referral.adapters';
import { resetReferralUiStateCache } from './referral.storage';

describe('referral feature adapter', () => {
  const rewardMoney = {
    amountPaise: 10_000,
    currency: 'INR' as const,
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetReferralUiStateCache();
    useDevelopmentScenarioStore.getState().reset();
  });

  it('returns pending, qualified, rewarded, rejected, and expired history states', async () => {
    const overview = await referralFeatureAdapter.getReferralOverview({
      customerId: 'customer_1',
      ownReferralCode: 'CUSTOM0001',
    });

    expect(new Set(overview.history.map((record) => record.status))).toEqual(
      new Set(['pending', 'qualified', 'rewarded', 'rejected', 'expired']),
    );
  });

  it('falls back to clipboard copy when native share throws', async () => {
    const bridge = {
      copyText: vi.fn(() => Promise.resolve()),
      openShareSheet: vi.fn(() =>
        Promise.reject(new Error('share unavailable')),
      ),
    };
    const adapter = createMockReferralFeatureAdapter(bridge);

    await expect(
      adapter.shareReferralInvitation({
        code: 'CUSTOM0001',
        link: 'connecto://referral/CUSTOM0001',
        message: 'Invite message',
      }),
    ).resolves.toEqual({
      kind: 'copied',
      notice: 'Sharing was unavailable, so the link was copied instead.',
    });
    expect(bridge.copyText).toHaveBeenCalledWith(
      'connecto://referral/CUSTOM0001',
    );
  });

  it('persists reward celebration ids once viewed', async () => {
    const before = await referralFeatureAdapter.getUiState();
    expect(before.celebratedRewardIds).toEqual([]);

    await expect(
      referralFeatureAdapter.markRewardCelebrationSeen(
        'referral_self_reward_1',
      ),
    ).resolves.toMatchObject({
      celebratedRewardIds: ['referral_self_reward_1'],
    });

    await expect(referralFeatureAdapter.getUiState()).resolves.toMatchObject({
      celebratedRewardIds: ['referral_self_reward_1'],
    });
  });

  it('links referral rewards through wallet-ledger references when the backend contract omits a direct transaction id', async () => {
    const rewardedRecord: ReferralContractHistoryRecord = {
      code: 'CUSTOM0001',
      createdAtIso: '2026-07-17T06:00:00.000Z',
      headline: 'Reward released',
      id: 'referral_reward_backend_1',
      ledgerLink: {
        releaseState: 'verified',
        rewardTransactionId: null,
        rewardTransactionReferenceId: 'ledger-ref-1',
      },
      perspective: 'referrer',
      review: {
        message: null,
        status: 'approved',
      },
      rewardAmount: rewardMoney,
      rewardReleasedAtIso: '2026-07-17T08:10:00.000Z',
      status: 'rewarded',
      statusMessage: 'Released after verification.',
      subjectLabel: 'Aarohi completed every milestone',
      timeline: [
        {
          completedAtIso: '2026-07-17T06:00:00.000Z',
          helperText: 'Joined successfully.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T06:20:00.000Z',
          helperText: 'Minimum add money met.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T06:50:00.000Z',
          helperText: 'First paid call completed.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T07:55:00.000Z',
          helperText: 'Verification approved.',
          key: 'verification',
          label: 'Verification',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-17T08:10:00.000Z',
          helperText: 'Reward posted.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'complete',
        },
      ],
      updatedAtIso: '2026-07-17T08:10:00.000Z',
    };
    const contractClient: ReferralContractClient = {
      getDetail: vi.fn(() => Promise.resolve(rewardedRecord)),
      getOverview: vi.fn(() =>
        Promise.resolve({
          appliedReferralCode: null,
          history: [rewardedRecord],
          ownReferralCode: 'CUSTOM0001',
          rewardAmounts: {
            newCustomer: rewardMoney,
            referrer: rewardMoney,
          },
          rules: [
            {
              body: 'Rule body.',
              id: 'rule_1',
              title: 'Rule title',
            },
          ],
          shareLink: 'connecto://referral/CUSTOM0001',
          shareMessage: 'Share message',
        }),
      ),
      resolveInviteAttribution: vi.fn(() =>
        Promise.resolve({
          attributionStatus: 'resolved',
          campaignLabel: 'Founding referral',
          code: 'CUSTOM0001',
          inviterDisplayName: 'Anjali',
          landingMessage: 'Invite resolved.',
          shareLink: 'connecto://referral/CUSTOM0001',
        } satisfies ReferralInviteAttribution),
      ),
      validateCode: vi.fn(() =>
        Promise.resolve({
          campaignLabel: 'Founding referral',
          code: 'CUSTOM0001',
          inviterDisplayName: 'Anjali',
          message: 'Applied.',
          outcome: 'valid' as const,
        }),
      ),
    };
    const adapter = createReferralFeatureAdapter({
      contractClient,
      providerMode: 'staging',
      resolveRewardTransactionId: vi.fn(() => Promise.resolve('transaction_9')),
    });

    await expect(
      adapter.getReferralOverview({
        customerId: 'customer_1',
        ownReferralCode: 'CUSTOM0001',
      }),
    ).resolves.toMatchObject({
      history: [
        {
          rewardTransactionId: 'transaction_9',
        },
      ],
    });
  });

  it('surfaces backend review messaging from contract review outcomes', async () => {
    const reviewRecord: ReferralContractHistoryRecord = {
      code: 'CUSTOM0001',
      createdAtIso: '2026-07-15T13:20:00.000Z',
      headline: 'Verification review did not release reward',
      id: 'referral_review_backend_1',
      ledgerLink: {
        releaseState: 'not-linked',
        rewardTransactionId: null,
        rewardTransactionReferenceId: null,
      },
      perspective: 'referrer',
      review: {
        message: 'Held for backend fraud review.',
        status: 'fraud-review',
      },
      rewardAmount: rewardMoney,
      rewardReleasedAtIso: null,
      status: 'rejected',
      statusMessage: 'No reward was released.',
      subjectLabel: 'Rhea entered policy review',
      timeline: [
        {
          completedAtIso: '2026-07-15T13:20:00.000Z',
          helperText: 'Joined.',
          key: 'joined',
          label: 'Joined',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-15T13:45:00.000Z',
          helperText: 'Top-up complete.',
          key: 'minimum-add-money-met',
          label: 'Minimum add money met',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-15T14:30:00.000Z',
          helperText: 'Paid call complete.',
          key: 'first-paid-call-completed',
          label: 'First paid call completed',
          state: 'complete',
        },
        {
          completedAtIso: '2026-07-15T18:00:00.000Z',
          helperText: 'Verification rejected.',
          key: 'verification',
          label: 'Verification',
          state: 'rejected',
        },
        {
          completedAtIso: null,
          helperText: 'No reward issued.',
          key: 'reward-released',
          label: 'Reward released',
          state: 'locked',
        },
      ],
      updatedAtIso: '2026-07-15T18:00:00.000Z',
    };
    const adapter = createReferralFeatureAdapter({
      contractClient: {
        getDetail: vi.fn(() => Promise.resolve(reviewRecord)),
        getOverview: vi.fn(() =>
          Promise.resolve({
            appliedReferralCode: null,
            history: [reviewRecord],
            ownReferralCode: 'CUSTOM0001',
            rewardAmounts: {
              newCustomer: rewardMoney,
              referrer: rewardMoney,
            },
            rules: [
              {
                body: 'Rule body.',
                id: 'rule_1',
                title: 'Rule title',
              },
            ],
            shareLink: 'connecto://referral/CUSTOM0001',
            shareMessage: 'Share message',
          }),
        ),
        resolveInviteAttribution: vi.fn(() =>
          Promise.resolve({
            attributionStatus: 'resolved' as const,
            campaignLabel: 'Campaign',
            code: 'CUSTOM0001',
            inviterDisplayName: 'Anjali',
            landingMessage: 'Invite resolved.',
            shareLink: 'connecto://referral/CUSTOM0001',
          }),
        ),
        validateCode: vi.fn(() =>
          Promise.resolve({
            campaignLabel: 'Campaign',
            code: 'CUSTOM0001',
            inviterDisplayName: 'Anjali',
            message: 'Applied.',
            outcome: 'valid' as const,
          }),
        ),
      },
      providerMode: 'production',
      resolveRewardTransactionId: vi.fn(() => Promise.resolve(null)),
    });

    await expect(
      adapter.getReferralDetail({
        customerId: 'customer_1',
        ownReferralCode: 'CUSTOM0001',
        referralId: 'referral_review_backend_1',
      }),
    ).resolves.toMatchObject({
      antiAbuseMessage: 'Held for backend fraud review.',
    });
  });
});
