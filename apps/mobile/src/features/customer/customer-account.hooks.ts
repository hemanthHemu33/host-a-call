import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  mobileDataIds,
  useCustomerProfileQuery,
} from '@/features/data/mobileDataHooks';

import { customerAccountAdapter } from './customer-account.adapters';
import {
  defaultCustomerSupportDraft,
  type CustomerNotificationCategory,
  type CustomerSupportDraft,
  type NotificationPreferences,
} from './customer-account.models';

export const customerAccountQueryKeys = {
  blockedHosts: (customerId: string) =>
    ['customer-account', 'blocked-hosts', customerId] as const,
  deleteAccount: (customerId: string) =>
    ['customer-account', 'delete-account', customerId] as const,
  notifications: (customerId: string) =>
    ['customer-account', 'notifications', customerId] as const,
  notificationPreferences: (customerId: string) =>
    ['customer-account', 'notification-preferences', customerId] as const,
  reports: (customerId: string) =>
    ['customer-account', 'reports', customerId] as const,
  supportDraft: (customerId: string) =>
    ['customer-account', 'support-draft', customerId] as const,
  supportTicket: (ticketId: string) =>
    ['customer-account', 'support-ticket', ticketId] as const,
  supportTickets: (customerId: string) =>
    ['customer-account', 'support-tickets', customerId] as const,
} as const;

export const invalidateCustomerAccountQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
  customerId: string = mobileDataIds.customerId,
  ticketId?: string | null,
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...customerAccountQueryKeys.blockedHosts(customerId)],
    }),
    queryClient.invalidateQueries({
      queryKey: [...customerAccountQueryKeys.deleteAccount(customerId)],
    }),
    queryClient.invalidateQueries({
      queryKey: [...customerAccountQueryKeys.notifications(customerId)],
    }),
    queryClient.invalidateQueries({
      queryKey: [
        ...customerAccountQueryKeys.notificationPreferences(customerId),
      ],
    }),
    queryClient.invalidateQueries({
      queryKey: [...customerAccountQueryKeys.reports(customerId)],
    }),
    queryClient.invalidateQueries({
      queryKey: [...customerAccountQueryKeys.supportDraft(customerId)],
    }),
    queryClient.invalidateQueries({
      queryKey: [...customerAccountQueryKeys.supportTickets(customerId)],
    }),
    ...(ticketId === undefined || ticketId === null
      ? []
      : [
          queryClient.invalidateQueries({
            queryKey: [...customerAccountQueryKeys.supportTicket(ticketId)],
          }),
        ]),
  ]);
};

export const useCustomerNotificationFeedQuery = (
  customerId: string = mobileDataIds.customerId,
) =>
  useQuery({
    queryFn: () => customerAccountAdapter.listNotifications(customerId),
    queryKey: customerAccountQueryKeys.notifications(customerId),
  });

export const useCustomerNotificationPreferencesQuery = (
  customerId: string = mobileDataIds.customerId,
) =>
  useQuery({
    queryFn: () =>
      customerAccountAdapter.getNotificationPreferences(customerId),
    queryKey: customerAccountQueryKeys.notificationPreferences(customerId),
  });

export const useCustomerSupportTicketsQuery = (
  customerId: string = mobileDataIds.customerId,
) =>
  useQuery({
    queryFn: () => customerAccountAdapter.listSupportTickets(customerId),
    queryKey: customerAccountQueryKeys.supportTickets(customerId),
  });

export const useCustomerSupportTicketQuery = (ticketId: string | null) =>
  useQuery({
    enabled: ticketId !== null,
    queryFn: () =>
      ticketId === null
        ? Promise.resolve(null)
        : customerAccountAdapter.getSupportTicket(ticketId),
    queryKey:
      ticketId === null
        ? ['customer-account', 'support-ticket', 'missing']
        : customerAccountQueryKeys.supportTicket(ticketId),
  });

export const useCustomerSupportDraftQuery = (
  customerId: string = mobileDataIds.customerId,
) =>
  useQuery({
    queryFn: async () =>
      customerAccountAdapter.getSupportDraft(customerId).catch(() => {
        return defaultCustomerSupportDraft;
      }),
    queryKey: customerAccountQueryKeys.supportDraft(customerId),
  });

export const useBlockedHostsQuery = (
  customerId: string = mobileDataIds.customerId,
) =>
  useQuery({
    queryFn: () => customerAccountAdapter.listBlockedHosts(customerId),
    queryKey: customerAccountQueryKeys.blockedHosts(customerId),
  });

export const useCustomerReportHistoryQuery = (
  customerId: string = mobileDataIds.customerId,
) =>
  useQuery({
    queryFn: () => customerAccountAdapter.listReports(customerId),
    queryKey: customerAccountQueryKeys.reports(customerId),
  });

export const useDeleteAccountStateQuery = (
  customerId: string = mobileDataIds.customerId,
) =>
  useQuery({
    queryFn: () => customerAccountAdapter.getDeleteAccountState(customerId),
    queryKey: customerAccountQueryKeys.deleteAccount(customerId),
  });

export const useMarkNotificationReadMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      customerAccountAdapter.markNotificationRead(customerId, notificationId),
    onSuccess: async () => {
      await invalidateCustomerAccountQueries(queryClient, customerId);
    },
  });
};

export const useMarkAllNotificationsReadMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      customerAccountAdapter.markAllNotificationsRead(customerId),
    onSuccess: async () => {
      await invalidateCustomerAccountQueries(queryClient, customerId);
    },
  });
};

export const useUpdateNotificationPreferencesMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      customerAccountAdapter.updateNotificationPreferences({
        customerId,
        preferences,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          ...customerAccountQueryKeys.notificationPreferences(customerId),
        ],
      });
    },
  });
};

export const useTriggerLocalNotificationPreviewMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category: CustomerNotificationCategory) =>
      customerAccountAdapter.triggerLocalNotificationPreview({
        category,
        customerId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...customerAccountQueryKeys.notifications(customerId)],
      });
    },
  });
};

export const useSaveSupportDraftMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: CustomerSupportDraft) =>
      customerAccountAdapter.saveSupportDraft(customerId, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...customerAccountQueryKeys.supportDraft(customerId)],
      });
    },
  });
};

export const useSubmitSupportTicketMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: CustomerSupportDraft) =>
      customerAccountAdapter.submitSupportTicket(customerId, draft),
    onSuccess: async (ticket) => {
      await invalidateCustomerAccountQueries(
        queryClient,
        customerId,
        ticket.id,
      );
    },
  });
};

export const useCreateSupportAttachmentMutation = (
  customerId: string = mobileDataIds.customerId,
) =>
  useMutation({
    mutationFn: (input?: { linkedCallId?: string | null }) =>
      customerAccountAdapter.createSupportAttachment({
        customerId,
        ...(input?.linkedCallId === undefined
          ? {}
          : { linkedCallId: input.linkedCallId }),
      }),
  });

export const useUnblockHostMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (hostId: string) =>
      customerAccountAdapter.unblockHost({ customerId, hostId }),
    onSuccess: async () => {
      await invalidateCustomerAccountQueries(queryClient, customerId);
    },
  });
};

export const useRequestDeleteAccountMutation = (
  customerId: string = mobileDataIds.customerId,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => customerAccountAdapter.requestDeleteAccount(customerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...customerAccountQueryKeys.deleteAccount(customerId)],
      });
    },
  });
};

export const useCustomerProfileSettingsQuery = () => useCustomerProfileQuery();
