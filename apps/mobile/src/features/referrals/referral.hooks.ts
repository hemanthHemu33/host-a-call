import { useMutation, useQuery } from '@tanstack/react-query';

import {
  referralFeatureAdapter,
  type ReferralShareInput,
  type ReferralShareResult,
} from './referral.adapters';

const referralFeatureQueryKeys = {
  detail: (customerId: string, referralId: string) =>
    ['referrals', 'detail', customerId, referralId] as const,
  overview: (customerId: string, ownReferralCode: string) =>
    ['referrals', 'overview', customerId, ownReferralCode] as const,
  uiState: ['referrals', 'ui-state'] as const,
};

export const useReferralOverviewQuery = (
  customerId: string,
  ownReferralCode: string,
) =>
  useQuery({
    enabled: customerId.trim().length > 0 && ownReferralCode.trim().length > 0,
    queryFn: () =>
      referralFeatureAdapter.getReferralOverview({
        customerId,
        ownReferralCode,
      }),
    queryKey: referralFeatureQueryKeys.overview(customerId, ownReferralCode),
  });

export const useReferralDetailQuery = (
  customerId: string,
  ownReferralCode: string,
  referralId: string | null,
) =>
  useQuery({
    enabled:
      referralId !== null &&
      customerId.trim().length > 0 &&
      ownReferralCode.trim().length > 0,
    queryFn: () =>
      referralFeatureAdapter.getReferralDetail({
        customerId,
        ownReferralCode,
        referralId: referralId ?? '',
      }),
    queryKey:
      referralId === null
        ? referralFeatureQueryKeys.detail(customerId, 'missing')
        : referralFeatureQueryKeys.detail(customerId, referralId),
  });

export const useReferralUiStateQuery = () =>
  useQuery({
    queryFn: () => referralFeatureAdapter.getUiState(),
    queryKey: referralFeatureQueryKeys.uiState,
  });

export const useShareReferralMutation = () =>
  useMutation<ReferralShareResult, Error, ReferralShareInput>({
    mutationFn: (input: ReferralShareInput) =>
      referralFeatureAdapter.shareReferralInvitation(input),
  });

export const useCopyReferralLinkMutation = () =>
  useMutation<ReferralShareResult, Error, ReferralShareInput>({
    mutationFn: (input: ReferralShareInput) =>
      referralFeatureAdapter.copyReferralLink(input),
  });
