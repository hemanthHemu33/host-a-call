import { appRoutes } from '@/navigation/routes';
import type { AuthAccountStatus, MobileAuthRole } from '@/store/auth.store';

import { normalizeReferralCode } from './referral.models';

export type ReferralLinkAuthSnapshot = {
  accountStatus: AuthAccountStatus | null;
  role: MobileAuthRole | null;
  sessionId: string | null;
};

export type ReferralLinkDestination =
  | typeof appRoutes.hostDashboard.path
  | typeof appRoutes.invalidLink.path
  | {
      params: { code: string };
      pathname: typeof appRoutes.authReferralCode.path;
    }
  | {
      params: { incomingCode: string };
      pathname: typeof appRoutes.customerReferrals.path;
    };

export const resolveReferralLinkDestination = (
  rawCode: string,
  auth: ReferralLinkAuthSnapshot,
): ReferralLinkDestination => {
  const code = normalizeReferralCode(rawCode);

  if (code.length === 0) {
    return appRoutes.invalidLink.path;
  }

  if (
    auth.sessionId !== null &&
    auth.accountStatus === 'active' &&
    auth.role === 'customer'
  ) {
    return {
      params: { incomingCode: code },
      pathname: appRoutes.customerReferrals.path,
    };
  }

  if (
    auth.sessionId !== null &&
    auth.accountStatus === 'active' &&
    auth.role === 'host'
  ) {
    return appRoutes.hostDashboard.path;
  }

  return {
    params: { code },
    pathname: appRoutes.authReferralCode.path,
  };
};
