import { createMockHttpClient } from '@connecto/domain';
import { describe, expect, it } from 'vitest';

import {
  createHttpReferralContractClient,
  createMockReferralContractClient,
} from './referral-contract';

describe('referral contract client', () => {
  it('parses backend overview and invite-resolution contracts through the typed HTTP client', async () => {
    const client = createHttpReferralContractClient(
      createMockHttpClient({
        'GET /v1/customers/customer_1/referrals/overview?ownReferralCode=CUSTOM0001':
          {
            appliedReferralCode: 'CONNECTO100',
            history: [],
            ownReferralCode: 'CUSTOM0001',
            rewardAmounts: {
              newCustomer: {
                amountPaise: 10_000,
                currency: 'INR',
              },
              referrer: {
                amountPaise: 10_000,
                currency: 'INR',
              },
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
          },
        'GET /v1/referrals/invitations/resolve?code=CONNECTO100': {
          attributionStatus: 'resolved',
          campaignLabel: 'Founding referral',
          code: 'CONNECTO100',
          inviterDisplayName: 'Anjali',
          landingMessage: 'Invite resolved.',
          shareLink: 'connecto://referral/CONNECTO100',
        },
        'POST /v1/referrals/validate': {
          campaignLabel: 'Founding referral',
          code: 'CONNECTO100',
          inviterDisplayName: 'Anjali',
          message: 'Referral applied.',
          outcome: 'valid',
        },
      }),
    );

    await expect(
      client.getOverview({
        customerId: 'customer_1',
        ownReferralCode: 'CUSTOM0001',
      }),
    ).resolves.toMatchObject({
      ownReferralCode: 'CUSTOM0001',
      shareLink: 'connecto://referral/CUSTOM0001',
    });

    await expect(
      client.resolveInviteAttribution({
        code: 'CONNECTO100',
      }),
    ).resolves.toMatchObject({
      attributionStatus: 'resolved',
      inviterDisplayName: 'Anjali',
    });

    await expect(
      client.validateCode({
        code: 'CONNECTO100',
        phoneNumber: '+919000000001',
      }),
    ).resolves.toMatchObject({
      code: 'CONNECTO100',
      outcome: 'valid',
    });
  });

  it('returns deterministic mock invite resolution for known and unknown referral links', async () => {
    const client = createMockReferralContractClient();

    await expect(
      client.resolveInviteAttribution({
        code: 'WAITLIST',
      }),
    ).resolves.toMatchObject({
      attributionStatus: 'resolved',
      code: 'WAITLIST',
    });

    await expect(
      client.resolveInviteAttribution({
        code: 'UNKNOWN',
      }),
    ).resolves.toMatchObject({
      attributionStatus: 'invalid',
      code: 'UNKNOWN',
    });
  });
});
