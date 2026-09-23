import { useQuery } from '@tanstack/react-query';

import { queryKeys, type Money } from '@connecto/domain';

import { frontendServices } from '@/services/adapters';

export const mobileDataIds = {
  customerId: 'customer_1',
  hostId: 'host_anjali',
  paymentId: 'payment_1',
  walletId: 'wallet_1',
} as const;

export const formatMoney = (money: Money) =>
  new Intl.NumberFormat('en-IN', {
    currency: money.currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(money.amountPaise / 100);

export const mobileDataLoaders = {
  customerCalls: () =>
    frontendServices.call.listCompletedCalls(mobileDataIds.customerId),
  customerProfile: () =>
    frontendServices.customer.getProfile(mobileDataIds.customerId),
  earnings: () => frontendServices.earnings.getEarnings(mobileDataIds.hostId),
  hostCalls: () =>
    frontendServices.call.listCompletedCalls(mobileDataIds.hostId),
  hostDashboard: () => frontendServices.host.getDashboard(mobileDataIds.hostId),
  hostProfile: () => frontendServices.host.getProfile(mobileDataIds.hostId),
  hosts: () => frontendServices.customer.listHosts(),
  notifications: () =>
    frontendServices.notification.listNotifications(mobileDataIds.customerId),
  referrals: () =>
    frontendServices.referral.listReferrals(mobileDataIds.customerId),
  reports: () => frontendServices.report.listReports(),
  supportTickets: () =>
    frontendServices.support.listTickets(mobileDataIds.customerId),
  transactions: () =>
    frontendServices.wallet.listTransactions(mobileDataIds.walletId),
  wallet: () => frontendServices.wallet.getWallet(mobileDataIds.customerId),
  withdrawals: () =>
    frontendServices.withdrawal.listWithdrawals(mobileDataIds.hostId),
};

export const useCustomerCallsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.customerCalls,
    queryKey: queryKeys.call.completed(mobileDataIds.customerId),
  });

export const useCustomerProfileQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.customerProfile,
    queryKey: queryKeys.customer.profile(mobileDataIds.customerId),
  });

export const useEarningsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.earnings,
    queryKey: queryKeys.earnings.detail(mobileDataIds.hostId),
  });

export const useHostCallsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.hostCalls,
    queryKey: queryKeys.call.completed(mobileDataIds.hostId),
  });

export const useHostDashboardQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.hostDashboard,
    queryKey: queryKeys.host.dashboard(mobileDataIds.hostId),
  });

export const useHostProfileQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.hostProfile,
    queryKey: queryKeys.host.profile(mobileDataIds.hostId),
  });

export const useHostsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.hosts,
    queryKey: queryKeys.customer.hosts,
  });

export const useNotificationsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.notifications,
    queryKey: queryKeys.notification.list(mobileDataIds.customerId),
  });

export const useReferralsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.referrals,
    queryKey: queryKeys.referral.list(mobileDataIds.customerId),
  });

export const useReportsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.reports,
    queryKey: queryKeys.report.list,
  });

export const useSupportTicketsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.supportTickets,
    queryKey: queryKeys.support.list(mobileDataIds.customerId),
  });

export const useTransactionsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.transactions,
    queryKey: queryKeys.wallet.transactions(mobileDataIds.walletId),
  });

export const useWalletQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.wallet,
    queryKey: queryKeys.wallet.detail(mobileDataIds.customerId),
  });

export const useWithdrawalsQuery = () =>
  useQuery({
    queryFn: mobileDataLoaders.withdrawals,
    queryKey: queryKeys.withdrawal.list(mobileDataIds.hostId),
  });
