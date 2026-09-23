import { describe, expect, it } from 'vitest';

import { appRoutes } from '@/navigation/routes';

import { resolveReferralLinkDestination } from './referral.navigation';

describe('referral link routing', () => {
  it('routes signed-out users into auth referral entry with the code attached', () => {
    expect(
      resolveReferralLinkDestination('connecto100', {
        accountStatus: null,
        role: null,
        sessionId: null,
      }),
    ).toEqual({
      params: { code: 'CONNECTO100' },
      pathname: appRoutes.authReferralCode.path,
    });
  });

  it('routes signed-in customers into the referral overview with the locked banner code', () => {
    expect(
      resolveReferralLinkDestination('waitlist', {
        accountStatus: 'active',
        role: 'customer',
        sessionId: 'session_customer',
      }),
    ).toEqual({
      params: { incomingCode: 'WAITLIST' },
      pathname: appRoutes.customerReferrals.path,
    });
  });

  it('keeps active hosts away from customer referral entry points', () => {
    expect(
      resolveReferralLinkDestination('hostonly', {
        accountStatus: 'active',
        role: 'host',
        sessionId: 'session_host',
      }),
    ).toBe(appRoutes.hostDashboard.path);
  });

  it('sends blank or malformed codes to invalid-link handling', () => {
    expect(
      resolveReferralLinkDestination('   ', {
        accountStatus: null,
        role: null,
        sessionId: null,
      }),
    ).toBe(appRoutes.invalidLink.path);
  });
});
