import { describe, expect, it } from 'vitest';

import {
  buildDeleteAccountState,
  buildNotificationDeepLink,
  resolveNotificationLinkTarget,
} from './customer-account.models';

describe('customer account models', () => {
  it('blocks deletion when wallet balance remains', () => {
    expect(
      buildDeleteAccountState({
        request: null,
        walletBalanceAmountPaise: 5_000,
      }),
    ).toEqual({
      reasons: ['wallet-balance'],
      status: 'blocked',
    });
  });

  it('returns a pending deletion state when a request already exists', () => {
    expect(
      buildDeleteAccountState({
        request: {
          id: 'delete_request_001',
          requestedAtIso: '2026-07-17T09:30:00.000Z',
          status: 'pending',
        },
        walletBalanceAmountPaise: 0,
      }),
    ).toEqual({
      request: {
        id: 'delete_request_001',
        requestedAtIso: '2026-07-17T09:30:00.000Z',
        status: 'pending',
      },
      status: 'pending',
    });
  });

  it('builds notification deep links and resolves support-ticket routing', () => {
    const deepLink = buildNotificationDeepLink({
      destination: 'support-ticket',
      id: 'local_notification_support_2',
      targetParams: {
        ticketId: 'ticket_account_004',
      },
    });

    expect(deepLink).toBe(
      '/link/notification/support-ticket?notificationId=local_notification_support_2&ticketId=ticket_account_004',
    );
    expect(
      resolveNotificationLinkTarget({
        destination: 'support-ticket',
        params: {
          notificationId: 'local_notification_support_2',
          ticketId: 'ticket_account_004',
        },
      }),
    ).toEqual({
      params: { ticketId: 'ticket_account_004' },
      pathname: '/(customer)/support-ticket/[ticketId]',
    });
  });
});
