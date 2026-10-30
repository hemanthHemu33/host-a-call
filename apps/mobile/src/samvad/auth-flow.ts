import type { SamvadSession } from './api';

export const normalizeIndianPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return digits.length === 10 ? `+91${digits}` : null;
};

export const routeForSamvadSession = (session: SamvadSession) => {
  if (!session.user.isProfileComplete) {
    return '/onboarding' as const;
  }

  return session.user.role === 'HOST'
    ? ('/kyc' as const)
    : ('/account' as const);
};
