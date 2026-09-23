import { appRoutes, type AppRoutePath } from './routes';

export type DeepLinkResolution =
  | { kind: 'valid'; destination: AppRoutePath }
  | { kind: 'invalid'; reason: string };

const normalizeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const path =
      parsed.protocol === 'connecto:'
        ? `/${parsed.hostname}${parsed.pathname}`
        : parsed.pathname;
    return path.startsWith('/') ? path : `/${path}`;
  } catch {
    return url.startsWith('/') ? url : `/${url}`;
  }
};

export const resolveDeepLink = (url: string): DeepLinkResolution => {
  const path = normalizeUrl(url);

  if (/^\/referral\/[^/]+$/.test(path)) {
    return { destination: appRoutes.linkReferral.path, kind: 'valid' };
  }

  if (/^\/support-ticket\/[^/]+$/.test(path)) {
    return { destination: appRoutes.customerSupportTicket.path, kind: 'valid' };
  }

  if (path === '/payment-result') {
    return { destination: appRoutes.customerPaymentStates.path, kind: 'valid' };
  }

  if (/^\/notification\/[^/]+$/.test(path)) {
    return { destination: appRoutes.linkNotification.path, kind: 'valid' };
  }

  if (/^\/call-invitation\/[^/]+$/.test(path)) {
    return { destination: appRoutes.linkCallInvitation.path, kind: 'valid' };
  }

  return { kind: 'invalid', reason: 'unsupported-deep-link' };
};
