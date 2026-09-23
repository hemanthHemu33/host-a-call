import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { persistDiscoveryPreferences } from '@/features/discovery/discovery.storage';

import { createMockCustomerAccountAdapter } from './customer-account.adapters';

describe('customer account adapter', () => {
  const nativeBridge = {
    getInitialDeepLink: vi.fn(),
    scheduleLocalNotification: vi.fn(),
    subscribeToDeepLinks: vi.fn(() => () => undefined),
  };

  const createAdapter = (
    options?: Parameters<typeof createMockCustomerAccountAdapter>[0],
  ) =>
    createMockCustomerAccountAdapter({
      nativeBridge,
      ...options,
    });

  beforeEach(async () => {
    await AsyncStorage.clear();
    nativeBridge.getInitialDeepLink.mockReset();
    nativeBridge.scheduleLocalNotification.mockReset();
    nativeBridge.subscribeToDeepLinks.mockReset();
    nativeBridge.subscribeToDeepLinks.mockReturnValue(() => undefined);
    nativeBridge.scheduleLocalNotification.mockResolvedValue(false);
    await createAdapter().clear();
  });

  it('merges seeded notification categories and marks every unread item read', async () => {
    const adapter = createAdapter();

    const initial = await adapter.listNotifications('customer_1');

    expect(
      new Set(initial.map((notification) => notification.category)),
    ).toEqual(new Set(['call', 'payment', 'referral', 'safety', 'support']));

    const updated = await adapter.markAllNotificationsRead('customer_1');

    expect(
      updated.every((notification) => notification.readAtIso !== null),
    ).toBe(true);
  });

  it('persists support drafts, creates tickets, and clears the draft on success', async () => {
    const adapter = createAdapter();
    const attachment = await adapter.createSupportAttachment({
      customerId: 'customer_1',
      linkedCallId: 'call_1',
    });

    await adapter.saveSupportDraft('customer_1', {
      attachments: [attachment],
      body: 'Wallet balance does not match what I expected.',
      category: 'payments',
      linkedCallId: 'call_1',
      subject: 'Wallet review request',
    });

    await expect(adapter.getSupportDraft('customer_1')).resolves.toMatchObject({
      body: 'Wallet balance does not match what I expected.',
      category: 'payments',
      subject: 'Wallet review request',
    });

    const created = await adapter.submitSupportTicket(
      'customer_1',
      await adapter.getSupportDraft('customer_1'),
    );

    expect(created.source).toBe('account');
    expect(created.attachments).toHaveLength(1);
    await expect(adapter.getSupportDraft('customer_1')).resolves.toEqual({
      attachments: [],
      body: '',
      category: 'technical',
      linkedCallId: null,
      subject: '',
    });
    await expect(adapter.getSupportTicket(created.id)).resolves.toMatchObject({
      id: created.id,
      subject: 'Wallet review request',
    });
  });

  it('retains support drafts after a temporary submission failure and succeeds on retry', async () => {
    const adapter = createAdapter({
      supportSubmissionMode: 'temporary-failure-once',
    });
    const draft = {
      attachments: [],
      body: 'Wallet history does not match what I expected.',
      category: 'payments' as const,
      linkedCallId: null,
      subject: 'Wallet follow-up',
    };

    await adapter.saveSupportDraft('customer_1', draft);

    await expect(
      adapter.submitSupportTicket('customer_1', draft),
    ).rejects.toThrow(
      'Temporary support outage. Your draft is still saved on this device.',
    );
    await expect(adapter.getSupportDraft('customer_1')).resolves.toEqual(draft);

    await expect(
      adapter.submitSupportTicket(
        'customer_1',
        await adapter.getSupportDraft('customer_1'),
      ),
    ).resolves.toMatchObject({
      requesterId: 'customer_1',
      source: 'account',
      subject: 'Wallet follow-up',
    });
    await expect(adapter.getSupportDraft('customer_1')).resolves.toEqual({
      attachments: [],
      body: '',
      category: 'technical',
      linkedCallId: null,
      subject: '',
    });
  });

  it('maps blocked hosts from discovery preferences and unblocks them', async () => {
    const adapter = createAdapter();

    await persistDiscoveryPreferences({
      blockedHostIds: ['host_002', 'host_015'],
      filters: {
        language: 'all',
        newHostsOnly: false,
        onlineOnly: false,
        rank: 'all',
        topRated: false,
      },
    });

    await expect(adapter.listBlockedHosts('customer_1')).resolves.toMatchObject(
      [
        {
          hostId: 'host_002',
        },
        {
          hostId: 'host_015',
        },
      ],
    );

    await expect(
      adapter.unblockHost({ customerId: 'customer_1', hostId: 'host_002' }),
    ).resolves.toMatchObject([
      {
        hostId: 'host_015',
      },
    ]);
  });
});
