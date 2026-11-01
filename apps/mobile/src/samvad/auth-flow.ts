import type { SamvadSession } from './api';

export const normalizeIndianPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
};

export const routeForSamvadSession = (session: SamvadSession) => {
  if (
    session.user.accountState !== undefined &&
    session.user.accountState.status !== 'ACTIVE'
  ) {
    return '/account-status' as const;
  }

  if (!session.user.isProfileComplete) {
    return '/age-confirmation' as const;
  }

  return session.user.role === 'HOST'
    ? ('/kyc' as const)
    : ('/account' as const);
};

export const ageForDateOfBirth = (value: string, now = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dateOfBirth = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > now) return null;
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDifference = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
};
