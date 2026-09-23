import {
  createApiError,
  FrontendApiError,
  type FrontendProviderMode,
  type HostSummary,
  type Notification,
  type Report,
} from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import {
  loadDiscoveryPreferences,
  persistDiscoveryPreferences,
} from '@/features/discovery/discovery.storage';
import { postCallAdapter } from '@/features/post-call/post-call.adapters';
import { type PostCallSupportTicket } from '@/features/post-call/post-call.models';
import { frontendServices } from '@/services/adapters';

import { customerNotificationNativeBridge } from './customer-account.native';
import {
  buildDeleteAccountState,
  buildNotificationDeepLink,
  customerAccountPersistedStateSchema,
  customerNotificationFeedItemSchema,
  customerSupportAttachmentSchema,
  customerSupportDraftSchema,
  customerSupportTicketSchema,
  defaultCustomerSupportDraft,
  initialCustomerAccountState,
  resolveSupportCategoryLabel,
  seededCustomerLocalNotifications,
  type BlockedHostSummary,
  type CustomerAccountPersistedState,
  type CustomerNotificationCategory,
  type CustomerNotificationFeedItem,
  type CustomerSupportAttachment,
  type CustomerSupportDraft,
  type CustomerSupportTicket,
  type DeleteAccountState,
  type NotificationPreferences,
} from './customer-account.models';
import {
  clearCustomerAccountState,
  loadCustomerAccountState,
  persistCustomerAccountState,
} from './customer-account.storage';

type CustomerNotificationNativeBridge = typeof customerNotificationNativeBridge;

type CustomerAccountClock = {
  now: () => Date;
};

type SupportSubmissionMode = 'success' | 'temporary-failure-once';

const defaultClock: CustomerAccountClock = {
  now: () => new Date(),
};

const unavailable = (providerMode: Exclude<FrontendProviderMode, 'mock'>) =>
  new Error(
    `${providerMode} customer account adapters are not connected. Use mock mode until backend contracts are available.`,
  );

const asValidationError = (message: string) =>
  new FrontendApiError(
    createApiError({
      code: 'validation',
      message,
      retryable: false,
    }),
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

const sortNotifications = (items: readonly CustomerNotificationFeedItem[]) =>
  [...items].sort((left, right) =>
    right.createdAtIso.localeCompare(left.createdAtIso),
  );

const sortSupportTickets = (items: readonly CustomerSupportTicket[]) =>
  [...items].sort((left, right) =>
    right.updatedAtIso.localeCompare(left.updatedAtIso),
  );

const mapDomainNotification = (
  customerId: string,
  notification: Notification,
): CustomerNotificationFeedItem => {
  const category =
    notification.type === 'wallet'
      ? 'payment'
      : notification.type === 'referral'
        ? 'referral'
        : notification.type === 'support'
          ? 'support'
          : notification.type === 'system'
            ? 'safety'
            : 'call';

  const destination =
    category === 'payment'
      ? 'wallet'
      : category === 'referral'
        ? 'referrals'
        : category === 'support'
          ? 'support'
          : category === 'safety'
            ? 'privacy-safety'
            : 'calls';

  const targetRouteId =
    category === 'payment'
      ? 'customerAddMoney'
      : category === 'referral'
        ? 'customerReferrals'
        : category === 'support'
          ? 'customerSupport'
          : category === 'safety'
            ? 'customerPrivacySafety'
            : 'customerCalls';

  return customerNotificationFeedItemSchema.parse({
    body: notification.body,
    category,
    createdAtIso: notification.createdAtIso,
    customerId,
    destination,
    id: notification.id,
    readAtIso: notification.readAtIso ?? null,
    source: 'domain',
    targetParams: {},
    targetRouteId,
    title: notification.title,
  });
};

const mapPostCallTicket = (
  ticket: PostCallSupportTicket,
): CustomerSupportTicket => {
  const category =
    ticket.category === 'billing'
      ? 'payments'
      : ticket.category === 'safety' || ticket.category === 'host-behaviour'
        ? 'safety'
        : 'technical';

  return customerSupportTicketSchema.parse({
    attachments:
      ticket.evidence === null
        ? []
        : [
            customerSupportAttachmentSchema.parse({
              attachmentId: ticket.evidence.attachmentId,
              capturedAtIso: ticket.evidence.capturedAtIso,
              fileName: ticket.evidence.fileName,
              height: ticket.evidence.height,
              sizeLabel: `${String(ticket.evidence.width)} x ${String(ticket.evidence.height)}`,
              uri: ticket.evidence.uri,
              width: ticket.evidence.width,
            }),
          ],
    body: ticket.comments,
    category,
    createdAtIso: ticket.createdAtIso,
    id: ticket.id,
    linkedCallId: ticket.linkedCallId,
    requesterId: ticket.requesterId,
    source: 'post-call',
    status: ticket.status,
    subject: ticket.issueSummary,
    ticketReference: ticket.ticketReference,
    updatedAtIso: ticket.updatedAtIso,
  });
};

const createPreviewNotification = ({
  category,
  clock,
  customerId,
  index,
}: {
  category: CustomerNotificationCategory;
  clock: CustomerAccountClock;
  customerId: string;
  index: number;
}) => {
  const createdAtIso = clock.now().toISOString();
  const template =
    category === 'payment'
      ? {
          body: 'A mock payment update is ready. Open Add Money to review the latest verification state.',
          destination: 'wallet',
          targetRouteId: 'customerAddMoney',
          title: 'Payment update',
        }
      : category === 'call'
        ? {
            body: 'A mock call reminder was generated from local notifications.',
            destination: 'calls',
            targetRouteId: 'customerCalls',
            title: 'Call update',
          }
        : category === 'referral'
          ? {
              body: 'A mock referral progress update is ready. Rewards still wait for verification.',
              destination: 'referrals',
              targetRouteId: 'customerReferrals',
              title: 'Referral update',
            }
          : category === 'support'
            ? {
                body: 'A mock support follow-up is ready. Open Support to continue.',
                destination: 'support',
                targetRouteId: 'customerSupport',
                title: 'Support update',
              }
            : {
                body: 'A mock safety update is ready. Open Privacy & Safety to review current actions.',
                destination: 'privacy-safety',
                targetRouteId: 'customerPrivacySafety',
                title: 'Safety update',
              };

  return customerNotificationFeedItemSchema.parse({
    body: template.body,
    category,
    createdAtIso,
    customerId,
    destination: template.destination,
    id: `local_notification_preview_${String(index).padStart(3, '0')}`,
    readAtIso: null,
    source: 'local',
    targetParams: {},
    targetRouteId: template.targetRouteId,
    title: template.title,
  });
};

const createHydratedState = (
  stored: CustomerAccountPersistedState,
): CustomerAccountPersistedState =>
  customerAccountPersistedStateSchema.parse({
    ...initialCustomerAccountState,
    ...stored,
    localNotifications: mergeById(
      seededCustomerLocalNotifications,
      stored.localNotifications,
    ),
    notificationPreferences: stored.notificationPreferences,
    supportTickets: [...stored.supportTickets],
  });

export interface CustomerAccountAdapter {
  clear(): Promise<void>;
  createSupportAttachment(input: {
    customerId: string;
    linkedCallId?: string | null;
  }): Promise<CustomerSupportAttachment>;
  getDeleteAccountState(customerId: string): Promise<DeleteAccountState>;
  getNotificationPreferences(
    customerId: string,
  ): Promise<NotificationPreferences>;
  getSupportDraft(customerId: string): Promise<CustomerSupportDraft>;
  getSupportTicket(ticketId: string): Promise<CustomerSupportTicket | null>;
  listBlockedHosts(customerId: string): Promise<BlockedHostSummary[]>;
  listNotifications(
    customerId: string,
  ): Promise<CustomerNotificationFeedItem[]>;
  listReports(customerId: string): Promise<Report[]>;
  listSupportTickets(customerId: string): Promise<CustomerSupportTicket[]>;
  markAllNotificationsRead(
    customerId: string,
  ): Promise<CustomerNotificationFeedItem[]>;
  markNotificationRead(
    customerId: string,
    notificationId: string,
  ): Promise<CustomerNotificationFeedItem | null>;
  requestDeleteAccount(customerId: string): Promise<DeleteAccountState>;
  saveSupportDraft(
    customerId: string,
    draft: CustomerSupportDraft,
  ): Promise<CustomerSupportDraft>;
  submitSupportTicket(
    customerId: string,
    draft: CustomerSupportDraft,
  ): Promise<CustomerSupportTicket>;
  triggerLocalNotificationPreview(input: {
    category: CustomerNotificationCategory;
    customerId: string;
  }): Promise<CustomerNotificationFeedItem>;
  unblockHost(input: {
    customerId: string;
    hostId: string;
  }): Promise<BlockedHostSummary[]>;
  updateNotificationPreferences(input: {
    customerId: string;
    preferences: NotificationPreferences;
  }): Promise<NotificationPreferences>;
}

export const createMockCustomerAccountAdapter = ({
  clock = defaultClock,
  nativeBridge = customerNotificationNativeBridge,
  supportSubmissionMode = 'success',
}: {
  clock?: CustomerAccountClock;
  nativeBridge?: CustomerNotificationNativeBridge;
  supportSubmissionMode?: SupportSubmissionMode;
} = {}): CustomerAccountAdapter => {
  let supportSubmissionFailedOnce = false;

  const readState = async () => {
    const stored = await loadCustomerAccountState();
    const hydrated = createHydratedState(stored);
    await persistCustomerAccountState(hydrated);

    return hydrated;
  };

  const writeState = async (state: CustomerAccountPersistedState) => {
    const parsed = customerAccountPersistedStateSchema.parse(state);
    return persistCustomerAccountState(parsed);
  };

  const listNotifications = async (customerId: string) => {
    const state = await readState();
    const domainNotifications =
      await frontendServices.notification.listNotifications(customerId);

    return sortNotifications([
      ...domainNotifications.map((notification) =>
        mapDomainNotification(customerId, notification),
      ),
      ...state.localNotifications.filter(
        (notification) => notification.customerId === customerId,
      ),
    ]);
  };

  const getDeleteAccountState = async (customerId: string) => {
    const state = await readState();
    const wallet = await frontendServices.wallet.getWallet(customerId);

    return buildDeleteAccountState({
      request: state.deleteAccountRequest,
      walletBalanceAmountPaise: wallet.balance.amountPaise,
    });
  };

  return {
    async clear() {
      await clearCustomerAccountState();
    },
    createSupportAttachment({ customerId, linkedCallId = null }) {
      const nowIso = clock.now().toISOString();
      const suffix = linkedCallId ?? customerId;

      return Promise.resolve(
        customerSupportAttachmentSchema.parse({
          attachmentId: `support_attachment_${suffix}_${nowIso}`,
          capturedAtIso: nowIso,
          fileName: `${suffix}-evidence-${nowIso.slice(11, 19).replace(/:/g, '')}.png`,
          height: 1280,
          sizeLabel: '720 x 1280',
          uri: `mock://connecto/support/${suffix}-${nowIso}.png`,
          width: 720,
        }),
      );
    },
    getDeleteAccountState,
    async getNotificationPreferences() {
      const state = await readState();
      return state.notificationPreferences;
    },
    async getSupportDraft() {
      const state = await readState();
      return state.supportDraft ?? defaultCustomerSupportDraft;
    },
    async getSupportTicket(ticketId) {
      const state = await readState();
      const accountTicket = state.supportTickets.find(
        (ticket) => ticket.id === ticketId,
      );

      if (accountTicket !== undefined) {
        return accountTicket;
      }

      const postCallTicket = await postCallAdapter.getSupportTicket(ticketId);

      return postCallTicket === null ? null : mapPostCallTicket(postCallTicket);
    },
    async listBlockedHosts() {
      const preferences = await loadDiscoveryPreferences();
      const hosts = await frontendServices.customer.listHosts();

      return preferences.blockedHostIds
        .map((hostId) => hosts.find((host) => host.id === hostId))
        .filter((host): host is HostSummary => host !== undefined)
        .map((host) => ({
          availability: host.availability,
          displayName: host.displayName,
          hostId: host.id,
          language: host.language,
          rank: host.rank,
        }));
    },
    listNotifications,
    async listReports(customerId) {
      const reports = await frontendServices.report.listReports();

      return [...reports]
        .filter((report) => report.reporterId === customerId)
        .sort((left, right) =>
          right.createdAtIso.localeCompare(left.createdAtIso),
        );
    },
    async listSupportTickets(customerId) {
      const state = await readState();
      const postCallTickets =
        await postCallAdapter.listSupportTickets(customerId);

      return sortSupportTickets([
        ...state.supportTickets.filter(
          (ticket) => ticket.requesterId === customerId,
        ),
        ...postCallTickets.map((ticket) => mapPostCallTicket(ticket)),
      ]);
    },
    async markAllNotificationsRead(customerId) {
      const state = await readState();
      const unreadLocalNotifications = state.localNotifications.filter(
        (notification) =>
          notification.customerId === customerId &&
          notification.readAtIso === null,
      );
      const unreadDomainNotifications = (
        await frontendServices.notification.listNotifications(customerId)
      ).filter((notification) => notification.readAtIso === undefined);
      const readAtIso = clock.now().toISOString();

      if (unreadLocalNotifications.length > 0) {
        const nextState = customerAccountPersistedStateSchema.parse({
          ...state,
          localNotifications: state.localNotifications.map((notification) =>
            notification.customerId === customerId &&
            notification.readAtIso === null
              ? customerNotificationFeedItemSchema.parse({
                  ...notification,
                  readAtIso,
                })
              : notification,
          ),
        });
        await writeState(nextState);
      }

      await Promise.all(
        unreadDomainNotifications.map((notification) =>
          frontendServices.notification.markRead(notification.id),
        ),
      );

      return listNotifications(customerId);
    },
    async markNotificationRead(customerId, notificationId) {
      const state = await readState();
      const localNotification = state.localNotifications.find(
        (notification) => notification.id === notificationId,
      );

      if (localNotification !== undefined) {
        if (localNotification.readAtIso !== null) {
          return localNotification;
        }

        const updated = customerNotificationFeedItemSchema.parse({
          ...localNotification,
          readAtIso: clock.now().toISOString(),
        });
        const nextState = customerAccountPersistedStateSchema.parse({
          ...state,
          localNotifications: state.localNotifications.map((notification) =>
            notification.id === notificationId ? updated : notification,
          ),
        });
        await writeState(nextState);

        return updated;
      }

      const notifications =
        await frontendServices.notification.listNotifications(customerId);
      const match = notifications.find(
        (notification) => notification.id === notificationId,
      );

      if (match === undefined) {
        return null;
      }

      if (match.readAtIso !== undefined) {
        return mapDomainNotification(customerId, match);
      }

      return mapDomainNotification(
        customerId,
        await frontendServices.notification.markRead(notificationId),
      );
    },
    async requestDeleteAccount(customerId) {
      const current = await getDeleteAccountState(customerId);

      if (current.status !== 'eligible') {
        if (current.status === 'pending') {
          return current;
        }

        throw asValidationError(
          'Resolve wallet balance before requesting account deletion.',
        );
      }

      const state = await readState();
      const request = {
        id: `delete_request_${clock.now().toISOString()}`,
        requestedAtIso: clock.now().toISOString(),
        status: 'pending',
      } as const;
      const nextState = customerAccountPersistedStateSchema.parse({
        ...state,
        deleteAccountRequest: request,
      });
      await writeState(nextState);

      return {
        request,
        status: 'pending',
      } satisfies DeleteAccountState;
    },
    async saveSupportDraft(_customerId, draft) {
      const state = await readState();
      const parsed = customerSupportDraftSchema.parse(draft);
      const nextState = customerAccountPersistedStateSchema.parse({
        ...state,
        supportDraft: parsed,
      });
      await writeState(nextState);

      return parsed;
    },
    async submitSupportTicket(customerId, draft) {
      const parsed = customerSupportDraftSchema.parse(draft);

      if (parsed.subject.trim().length < 3) {
        throw asValidationError(
          'Add a clear subject so support can triage this issue.',
        );
      }

      if (parsed.body.trim().length < 8) {
        throw asValidationError(
          'Add at least a short description so support has context.',
        );
      }

      if (
        supportSubmissionMode === 'temporary-failure-once' &&
        !supportSubmissionFailedOnce
      ) {
        supportSubmissionFailedOnce = true;
        throw new FrontendApiError(
          createApiError({
            code: 'server',
            message:
              'Temporary support outage. Your draft is still saved on this device.',
            retryable: true,
          }),
        );
      }

      const state = await readState();
      const createdAtIso = clock.now().toISOString();
      const ticket = customerSupportTicketSchema.parse({
        attachments: parsed.attachments,
        body: parsed.body.trim(),
        category: parsed.category,
        createdAtIso,
        id: `ticket_account_${String(state.supportTickets.length + 1).padStart(3, '0')}`,
        linkedCallId: parsed.linkedCallId,
        requesterId: customerId,
        source: 'account',
        status: 'open',
        subject:
          parsed.subject.trim().length > 0
            ? parsed.subject.trim()
            : resolveSupportCategoryLabel(parsed.category),
        ticketReference: `SUP-${String(5200 + state.supportTickets.length)}`,
        updatedAtIso: createdAtIso,
      });
      const nextState = customerAccountPersistedStateSchema.parse({
        ...state,
        supportDraft: null,
        supportTickets: [ticket, ...state.supportTickets],
      });
      await writeState(nextState);

      return ticket;
    },
    async triggerLocalNotificationPreview({ category, customerId }) {
      const state = await readState();
      const created = createPreviewNotification({
        category,
        clock,
        customerId,
        index: state.localNotifications.length + 1,
      });
      const nextState = customerAccountPersistedStateSchema.parse({
        ...state,
        localNotifications: [created, ...state.localNotifications],
      });
      await writeState(nextState);

      await nativeBridge
        .scheduleLocalNotification({
          body: created.body,
          deepLink: buildNotificationDeepLink(created),
          title: created.title,
        })
        .catch(() => false);

      return created;
    },
    async unblockHost({ hostId }) {
      const preferences = await loadDiscoveryPreferences();
      const persisted = await persistDiscoveryPreferences({
        ...preferences,
        blockedHostIds: preferences.blockedHostIds.filter(
          (id) => id !== hostId,
        ),
      });
      const hosts = await frontendServices.customer.listHosts();

      return persisted.blockedHostIds
        .map((id) => hosts.find((host) => host.id === id))
        .filter((host): host is HostSummary => host !== undefined)
        .map((host) => ({
          availability: host.availability,
          displayName: host.displayName,
          hostId: host.id,
          language: host.language,
          rank: host.rank,
        }));
    },
    async updateNotificationPreferences({ preferences }) {
      const state = await readState();
      const nextState = customerAccountPersistedStateSchema.parse({
        ...state,
        notificationPreferences: preferences,
      });
      await writeState(nextState);

      return nextState.notificationPreferences;
    },
  };
};

export const createUnavailableCustomerAccountAdapter = (
  providerMode: Exclude<FrontendProviderMode, 'mock'>,
): CustomerAccountAdapter => ({
  clear: () => Promise.reject(unavailable(providerMode)),
  createSupportAttachment: () => Promise.reject(unavailable(providerMode)),
  getDeleteAccountState: () => Promise.reject(unavailable(providerMode)),
  getNotificationPreferences: () => Promise.reject(unavailable(providerMode)),
  getSupportDraft: () => Promise.reject(unavailable(providerMode)),
  getSupportTicket: () => Promise.reject(unavailable(providerMode)),
  listBlockedHosts: () => Promise.reject(unavailable(providerMode)),
  listNotifications: () => Promise.reject(unavailable(providerMode)),
  listReports: () => Promise.reject(unavailable(providerMode)),
  listSupportTickets: () => Promise.reject(unavailable(providerMode)),
  markAllNotificationsRead: () => Promise.reject(unavailable(providerMode)),
  markNotificationRead: () => Promise.reject(unavailable(providerMode)),
  requestDeleteAccount: () => Promise.reject(unavailable(providerMode)),
  saveSupportDraft: () => Promise.reject(unavailable(providerMode)),
  submitSupportTicket: () => Promise.reject(unavailable(providerMode)),
  triggerLocalNotificationPreview: () =>
    Promise.reject(unavailable(providerMode)),
  unblockHost: () => Promise.reject(unavailable(providerMode)),
  updateNotificationPreferences: () =>
    Promise.reject(unavailable(providerMode)),
});

export const customerAccountAdapter =
  mobileRuntimeConfig.providerMode === 'mock'
    ? createMockCustomerAccountAdapter()
    : createUnavailableCustomerAccountAdapter(mobileRuntimeConfig.providerMode);
