import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import {
  createApiError,
  FrontendApiError,
  normalizeApiError,
  type Transaction,
} from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import { frontendServices } from '@/services/adapters';
import {
  createHttpReferralContractClient,
  createMockReferralContractClient,
  referralContractClient,
  type ReferralCodeValidationContract,
  type ReferralContractClient,
  type ReferralContractHistoryRecord,
  type ReferralContractOverview,
  type ReferralInviteAttribution,
} from '@/services/referrals/referral-contract';
import { useDevelopmentScenarioStore } from '@/store/development.store';

import {
  referralHistoryRecordSchema,
  referralOverviewSchema,
  type ReferralHistoryRecord,
  type ReferralOverview,
  type ReferralUiState,
} from './referral.models';
import {
  loadReferralUiState,
  markReferralCelebrationSeen,
} from './referral.storage';

export type ReferralShareResult =
  | { kind: 'copied'; notice: string }
  | { kind: 'dismissed'; notice: string }
  | { kind: 'shared'; notice: string };

export type ReferralShareInput = {
  code: string;
  link: string;
  message: string;
};

type ReferralDataInput = {
  customerId: string;
  ownReferralCode: string;
};

type ReferralDetailInput = ReferralDataInput & {
  referralId: string;
};

type ReferralInviteResolutionInput = {
  code: string;
};

type ReferralRewardLedgerResolver = (input: {
  customerId: string;
  record: ReferralContractHistoryRecord;
}) => Promise<string | null>;

export interface ReferralShareBridge {
  copyText(value: string): Promise<void>;
  openShareSheet(input: {
    message: string;
    title: string;
    url: string;
  }): Promise<{ action: string }>;
}

export interface ReferralFeatureAdapter {
  copyReferralLink(input: ReferralShareInput): Promise<ReferralShareResult>;
  getReferralDetail(input: ReferralDetailInput): Promise<ReferralHistoryRecord>;
  getReferralOverview(input: ReferralDataInput): Promise<ReferralOverview>;
  getUiState(): Promise<ReferralUiState>;
  markRewardCelebrationSeen(referralId: string): Promise<ReferralUiState>;
  resolveInviteAttribution(
    input: ReferralInviteResolutionInput,
  ): Promise<ReferralInviteAttribution>;
  shareReferralInvitation(
    input: ReferralShareInput,
  ): Promise<ReferralShareResult>;
}

const wait = (latencyMs: number) =>
  latencyMs <= 0
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        setTimeout(resolve, latencyMs);
      });

const simulateReferralResult = async <T>(
  value: T,
  fallback?: { empty?: T; partial?: T },
) => {
  const controls = useDevelopmentScenarioStore.getState().simulation;
  await wait(controls.latencyMs);

  if (controls.mode === 'offline') {
    throw new FrontendApiError(
      createApiError({
        code: 'offline',
        message: 'The device is offline.',
      }),
    );
  }

  if (controls.mode === 'failure') {
    throw new FrontendApiError(
      createApiError({
        code: 'server',
        message: 'The referral mock is simulating a recoverable failure.',
      }),
    );
  }

  if (controls.mode === 'empty' && fallback?.empty !== undefined) {
    return fallback.empty;
  }

  if (controls.mode === 'partial-data' && fallback?.partial !== undefined) {
    return fallback.partial;
  }

  return value;
};

const shareBridge: ReferralShareBridge = {
  copyText: (value) => Clipboard.setStringAsync(value).then(() => undefined),
  openShareSheet: ({ message, title, url }) =>
    Share.share({
      message,
      title,
      url,
    }),
};

const buildWalletLedgerIndex = (transactions: readonly Transaction[]) =>
  transactions
    .filter((transaction) => transaction.type === 'referral-credit')
    .reduce((index, transaction) => {
      index.set(transaction.id, transaction.id);
      index.set(transaction.referenceId, transaction.id);
      return index;
    }, new Map<string, string>());

const defaultReferralRewardLedgerResolver: ReferralRewardLedgerResolver =
  async ({ customerId, record }) => {
    if (record.ledgerLink.rewardTransactionId !== null) {
      return record.ledgerLink.rewardTransactionId;
    }

    try {
      const profile = await frontendServices.customer.getProfile(customerId);
      const transactions = await frontendServices.wallet.listTransactions(
        profile.walletId,
      );
      const ledgerIndex = buildWalletLedgerIndex(transactions);

      return (
        (record.ledgerLink.rewardTransactionReferenceId === null
          ? undefined
          : ledgerIndex.get(record.ledgerLink.rewardTransactionReferenceId)) ??
        ledgerIndex.get(record.id) ??
        null
      );
    } catch {
      return null;
    }
  };

const resolveReviewMessage = (record: ReferralContractHistoryRecord) =>
  record.review.status === 'approved' || record.review.status === 'none'
    ? null
    : record.review.message;

const mapContractRecordToUi = async ({
  customerId,
  resolveRewardTransactionId,
  record,
}: {
  customerId: string;
  record: ReferralContractHistoryRecord;
  resolveRewardTransactionId: ReferralRewardLedgerResolver;
}): Promise<ReferralHistoryRecord> =>
  referralHistoryRecordSchema.parse({
    antiAbuseMessage: resolveReviewMessage(record),
    code: record.code,
    createdAtIso: record.createdAtIso,
    headline: record.headline,
    id: record.id,
    perspective: record.perspective,
    rewardAmount: record.rewardAmount,
    rewardReleasedAtIso: record.rewardReleasedAtIso,
    rewardTransactionId: await resolveRewardTransactionId({
      customerId,
      record,
    }),
    status: record.status,
    statusMessage: record.statusMessage,
    subjectLabel: record.subjectLabel,
    timeline: record.timeline,
    updatedAtIso: record.updatedAtIso,
  });

const mapContractOverviewToUi = async ({
  customerId,
  overview,
  resolveRewardTransactionId,
}: {
  customerId: string;
  overview: ReferralContractOverview;
  resolveRewardTransactionId: ReferralRewardLedgerResolver;
}): Promise<ReferralOverview> =>
  referralOverviewSchema.parse({
    appliedReferralCode: overview.appliedReferralCode,
    history: await Promise.all(
      overview.history.map((record) =>
        mapContractRecordToUi({
          customerId,
          record,
          resolveRewardTransactionId,
        }),
      ),
    ),
    ownReferralCode: overview.ownReferralCode,
    rewardAmounts: overview.rewardAmounts,
    rules: overview.rules,
    shareLink: overview.shareLink,
    shareMessage: overview.shareMessage,
  });

export const mapReferralValidationContract = (
  validation: ReferralCodeValidationContract,
) => ({
  code: validation.code,
  message: validation.message,
  outcome: validation.outcome,
});

export const createReferralFeatureAdapter = ({
  bridge = shareBridge,
  contractClient = referralContractClient,
  providerMode = mobileRuntimeConfig.providerMode,
  resolveRewardTransactionId = defaultReferralRewardLedgerResolver,
}: {
  bridge?: ReferralShareBridge;
  contractClient?: ReferralContractClient;
  providerMode?: 'mock' | 'production' | 'staging';
  resolveRewardTransactionId?: ReferralRewardLedgerResolver;
} = {}): ReferralFeatureAdapter => ({
  async copyReferralLink(input) {
    await bridge.copyText(input.link);
    return {
      kind: 'copied',
      notice: 'Referral link copied.',
    };
  },
  async getReferralDetail({ customerId, ownReferralCode, referralId }) {
    const detail = await mapContractRecordToUi({
      customerId,
      record: await contractClient.getDetail({
        customerId,
        ownReferralCode,
        referralId,
      }),
      resolveRewardTransactionId,
    });

    return providerMode === 'mock' ? simulateReferralResult(detail) : detail;
  },
  async getReferralOverview({ customerId, ownReferralCode }) {
    const overview = await mapContractOverviewToUi({
      customerId,
      overview: await contractClient.getOverview({
        customerId,
        ownReferralCode,
      }),
      resolveRewardTransactionId,
    });

    return providerMode === 'mock'
      ? simulateReferralResult(overview, {
          empty: {
            ...overview,
            history: [],
          },
          partial: {
            ...overview,
            history: overview.history.slice(0, 2),
          },
        })
      : overview;
  },
  async getUiState() {
    const state = await loadReferralUiState();
    return state;
  },
  async markRewardCelebrationSeen(referralId) {
    return markReferralCelebrationSeen(referralId);
  },
  async resolveInviteAttribution(input) {
    const resolution = await contractClient.resolveInviteAttribution(input);
    return providerMode === 'mock'
      ? simulateReferralResult(resolution)
      : resolution;
  },
  async shareReferralInvitation(input) {
    try {
      const result = await bridge.openShareSheet({
        message: `${input.message}\n${input.link}`,
        title: `Invite with ${input.code}`,
        url: input.link,
      });

      if (result.action === Share.dismissedAction) {
        return {
          kind: 'dismissed',
          notice: 'Share sheet closed.',
        };
      }

      return {
        kind: 'shared',
        notice: 'Referral link ready to send.',
      };
    } catch {
      await bridge.copyText(input.link);
      return {
        kind: 'copied',
        notice: 'Sharing was unavailable, so the link was copied instead.',
      };
    }
  },
});

export const createMockReferralFeatureAdapter = (
  bridge: ReferralShareBridge = shareBridge,
): ReferralFeatureAdapter =>
  createReferralFeatureAdapter({
    bridge,
    contractClient: createMockReferralContractClient(),
    providerMode: 'mock',
  });

export const createConnectedReferralFeatureAdapter = (
  bridge: ReferralShareBridge = shareBridge,
): ReferralFeatureAdapter =>
  createReferralFeatureAdapter({
    bridge,
    contractClient: createHttpReferralContractClient(),
    providerMode: mobileRuntimeConfig.providerMode,
  });

export const referralFeatureAdapter =
  mobileRuntimeConfig.providerMode === 'mock'
    ? createMockReferralFeatureAdapter()
    : createConnectedReferralFeatureAdapter();

export const normalizeReferralFeatureError = normalizeApiError;
