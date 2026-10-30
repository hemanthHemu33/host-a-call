import {
  clearAuthSession,
  completeCustomerOnboardingState,
  completeHostApplicationState,
  initialAuthStore,
  resetAuthStore,
  setAuthAccountStatus,
  setAuthAgeGateStatus,
  setAuthSession,
  type AuthSessionInput,
  type AuthStoreSnapshot,
  type CustomerRouteTarget,
} from '@/store/auth.store';
import { initialAppStore, type AppStoreSnapshot } from '@/store/app.store';
import { resolveCustomerOnboardingStep } from '@/features/customer-onboarding/customer-onboarding.models';
import { mobileRuntimeConfig } from '@/config/runtime';

import {
  appRoutes,
  getRouteDefinition,
  isRouteAvailableInEnvironment,
  type AppRoutePath,
  type MobileRole,
  type RouteDefinition,
} from './routes';

export type NavigationDecision =
  | { kind: 'allow'; route: RouteDefinition }
  | { kind: 'redirect'; reason: string; redirectTo: AppRoutePath };

export type NavigationSnapshot = {
  app: AppStoreSnapshot;
  auth: AuthStoreSnapshot;
  lastSafeRoute: AppRoutePath;
  pendingDestination: AppRoutePath | null;
};

type NavigationRuntime = {
  environment: Parameters<typeof isRouteAvailableInEnvironment>[1];
};

const defaultNavigationRuntime = {
  environment: mobileRuntimeConfig.environment,
} satisfies NavigationRuntime;

const roleHome = {
  customer: appRoutes.customerHome.path,
  host: appRoutes.hostDashboard.path,
} as const satisfies Record<MobileRole, AppRoutePath>;

const publicAuthRouteIds = [
  'authAgeConfirmation',
  'authBlockedAccount',
  'authLogin',
  'authOtp',
  'authReferralCode',
  'authSuspendedAccount',
  'authUnderageBlock',
] as const;

const customerOnboardingRouteIds = [
  'customerOnboardingHostAgreement',
  'customerOnboardingHostApproval',
  'customerOnboardingLanguage',
  'customerOnboardingMatchTags',
  'customerOnboardingPermissions',
  'customerOnboardingProfile',
  'customerOnboardingVoiceVerification',
] as const;

const isAllowedRole = (
  allowedRoles: readonly MobileRole[],
  role: MobileRole | null,
) => role !== null && allowedRoles.includes(role);

const isActiveSession = (auth: AuthStoreSnapshot) =>
  auth.sessionId !== null && auth.accountStatus === 'active';

const accountStatusRoute = (
  status: AuthStoreSnapshot['accountStatus'],
): AppRoutePath | null => {
  if (status === 'blocked') {
    return appRoutes.authBlockedAccount.path;
  }

  if (status === 'suspended') {
    return appRoutes.authSuspendedAccount.path;
  }

  return null;
};

const customerTargetRoute = (
  customerRouteTarget: CustomerRouteTarget | null,
  auth: AuthStoreSnapshot,
): AppRoutePath => {
  if (customerRouteTarget !== 'onboarding') {
    return appRoutes.customerHome.path;
  }

  const step = resolveCustomerOnboardingStep(auth.customerOnboarding);
  const routeByStep = {
    hostAgreement: appRoutes.customerOnboardingHostAgreement.path,
    hostApproval: appRoutes.customerOnboardingHostApproval.path,
    language: appRoutes.customerOnboardingLanguage.path,
    matchTags: appRoutes.customerOnboardingMatchTags.path,
    permissions: appRoutes.customerOnboardingPermissions.path,
    profile: appRoutes.customerOnboardingProfile.path,
    voiceVerification: appRoutes.customerOnboardingVoiceVerification.path,
  } as const;

  return routeByStep[step];
};

const defaultRouteForAuth = (auth: AuthStoreSnapshot): AppRoutePath => {
  const persistedAccountStatusRoute = accountStatusRoute(auth.accountStatus);

  if (persistedAccountStatusRoute !== null) {
    return persistedAccountStatusRoute;
  }

  if (auth.ageGateStatus === 'underage-blocked') {
    return appRoutes.authUnderageBlock.path;
  }

  if (!isActiveSession(auth) || auth.role === null) {
    return appRoutes.authLogin.path;
  }

  if (auth.role === 'customer') {
    return customerTargetRoute(auth.customerRouteTarget, auth);
  }

  if (auth.hostKycStatus !== 'verified') {
    return appRoutes.hostOnboardingKyc.path;
  }

  return roleHome[auth.role];
};

const defaultSnapshot: NavigationSnapshot = {
  app: {
    ...initialAppStore,
    bootstrapState: 'signed-out',
  },
  auth: initialAuthStore,
  lastSafeRoute: appRoutes.index.path,
  pendingDestination: null,
};

let snapshot = defaultSnapshot;
let lockedTarget: AppRoutePath | null = null;

export const setNavigationSnapshot = (next: NavigationSnapshot) => {
  snapshot = next;
};

export const resetNavigationSnapshot = () => {
  resetAuthStore();
  snapshot = defaultSnapshot;
  lockedTarget = null;
};

export const resolveNavigationDecision = (
  pathname: string,
  current: NavigationSnapshot = snapshot,
  runtime: NavigationRuntime = defaultNavigationRuntime,
): NavigationDecision => {
  const route = getRouteDefinition(pathname);

  if (route === undefined) {
    return {
      kind: 'redirect',
      reason: 'unknown-route',
      redirectTo: appRoutes.invalidLink.path,
    };
  }

  if (!isRouteAvailableInEnvironment(route.id, runtime.environment)) {
    return {
      kind: 'redirect',
      reason: 'production-internal-route',
      redirectTo: appRoutes.invalidLink.path,
    };
  }

  const persistedAccountStatusRoute = accountStatusRoute(
    current.auth.accountStatus,
  );

  if (
    persistedAccountStatusRoute !== null &&
    route.path !== persistedAccountStatusRoute &&
    route.id !== 'legalPrivacy' &&
    route.id !== 'legalTerms'
  ) {
    return {
      kind: 'redirect',
      reason: 'account-status-block',
      redirectTo: persistedAccountStatusRoute,
    };
  }

  if (
    current.auth.ageGateStatus === 'underage-blocked' &&
    route.id !== 'authUnderageBlock' &&
    route.id !== 'legalPrivacy' &&
    route.id !== 'legalTerms'
  ) {
    return {
      kind: 'redirect',
      reason: 'age-gate-block',
      redirectTo: appRoutes.authUnderageBlock.path,
    };
  }

  if (
    current.app.bootstrapState === 'bootstrapping' &&
    route.id !== 'bootstrap'
  ) {
    return {
      kind: 'redirect',
      reason: 'bootstrap-required',
      redirectTo: appRoutes.bootstrap.path,
    };
  }

  if (route.access.kind === 'public') {
    if (
      publicAuthRouteIds.includes(
        route.id as (typeof publicAuthRouteIds)[number],
      ) &&
      isActiveSession(current.auth)
    ) {
      return {
        kind: 'redirect',
        reason: 'session-active',
        redirectTo: defaultRouteForAuth(current.auth),
      };
    }

    return { kind: 'allow', route };
  }

  if (!isActiveSession(current.auth)) {
    if (route.allowLoggedOutDeepLink) {
      snapshot = {
        ...current,
        pendingDestination: route.path,
      };
    }

    return {
      kind: 'redirect',
      reason: 'auth-required',
      redirectTo: appRoutes.authLogin.path,
    };
  }

  if (!isAllowedRole(route.access.roles, current.auth.role)) {
    const fallback =
      current.auth.role === null
        ? appRoutes.index.path
        : roleHome[current.auth.role];

    return {
      kind: 'redirect',
      reason: 'role-mismatch',
      redirectTo:
        current.lastSafeRoute === route.path ? fallback : current.lastSafeRoute,
    };
  }

  if (
    current.auth.role === 'customer' &&
    current.auth.customerRouteTarget === 'onboarding' &&
    !customerOnboardingRouteIds.includes(
      route.id as (typeof customerOnboardingRouteIds)[number],
    )
  ) {
    return {
      kind: 'redirect',
      reason: 'customer-onboarding-required',
      redirectTo: customerTargetRoute('onboarding', current.auth),
    };
  }

  if (
    current.auth.role === 'customer' &&
    current.auth.customerRouteTarget === 'home' &&
    customerOnboardingRouteIds.includes(
      route.id as (typeof customerOnboardingRouteIds)[number],
    )
  ) {
    return {
      kind: 'redirect',
      reason: 'customer-onboarding-complete',
      redirectTo: appRoutes.customerHome.path,
    };
  }

  return { kind: 'allow', route };
};

export const rememberSafeRoute = (
  pathname: string,
  current: NavigationSnapshot = snapshot,
) => {
  const route = getRouteDefinition(pathname);

  if (route === undefined || route.backPolicy === 'dismiss-modal') {
    return current;
  }

  snapshot = {
    ...current,
    lastSafeRoute: route.path,
  };

  return snapshot;
};

export const consumePendingDestination = () => {
  const pendingDestination = snapshot.pendingDestination;
  snapshot = { ...snapshot, pendingDestination: null };

  return pendingDestination;
};

export const hydrateNavigationAuth = (auth: AuthStoreSnapshot) => {
  snapshot = {
    ...snapshot,
    auth,
    lastSafeRoute: defaultRouteForAuth(auth),
    pendingDestination: null,
  };

  return snapshot;
};

export const completeAuthSession = (input: AuthSessionInput): AppRoutePath => {
  const auth = setAuthSession(input);
  const pendingDestination = snapshot.pendingDestination;
  const authenticatedSnapshot: NavigationSnapshot = {
    ...snapshot,
    auth,
    pendingDestination: null,
  };

  if (
    input.role !== 'customer' ||
    (input.customerRouteTarget ?? 'home') === 'home'
  ) {
    if (pendingDestination !== null) {
      const decision = resolveNavigationDecision(
        pendingDestination,
        authenticatedSnapshot,
      );

      if (decision.kind === 'allow') {
        snapshot = {
          ...authenticatedSnapshot,
          lastSafeRoute: pendingDestination,
        };

        return pendingDestination;
      }
    }
  }

  const restoreTo =
    input.role === 'customer'
      ? customerTargetRoute(input.customerRouteTarget ?? 'home', auth)
      : roleHome[input.role];

  snapshot = {
    ...authenticatedSnapshot,
    lastSafeRoute: restoreTo,
  };

  return restoreTo;
};

export const completeAccountStatus = (input: {
  phoneNumber: string;
  status: 'blocked' | 'suspended';
}): AppRoutePath => {
  const auth = setAuthAccountStatus(input);
  const restoreTo = defaultRouteForAuth(auth);

  snapshot = {
    ...snapshot,
    auth,
    lastSafeRoute: restoreTo,
    pendingDestination: null,
  };

  return restoreTo;
};

export const setUnderageNavigationState = (): AppRoutePath => {
  const auth = setAuthAgeGateStatus('underage-blocked');
  const restoreTo = defaultRouteForAuth(auth);

  snapshot = {
    ...snapshot,
    auth,
    lastSafeRoute: restoreTo,
    pendingDestination: null,
  };

  return restoreTo;
};

export const setConfirmedAgeNavigationState = (): AppRoutePath => {
  const auth = setAuthAgeGateStatus('confirmed');
  const restoreTo = defaultRouteForAuth(auth);

  snapshot = {
    ...snapshot,
    auth,
    lastSafeRoute: restoreTo,
    pendingDestination: null,
  };

  return restoreTo;
};

export const resolveDefaultRoute = (
  auth: AuthStoreSnapshot = snapshot.auth,
): AppRoutePath => defaultRouteForAuth(auth);

export const clearNavigationSession = (): AppRoutePath => {
  const auth = clearAuthSession();
  const restoreTo = defaultRouteForAuth(auth);

  snapshot = {
    ...snapshot,
    auth,
    lastSafeRoute: restoreTo,
    pendingDestination: null,
  };

  return restoreTo;
};

export const completeCustomerOnboardingNavigation = (
  patch?: Parameters<typeof completeCustomerOnboardingState>[0],
): AppRoutePath => {
  const auth = completeCustomerOnboardingState(patch);
  const restoreTo = defaultRouteForAuth(auth);

  snapshot = {
    ...snapshot,
    auth,
    lastSafeRoute: restoreTo,
    pendingDestination: null,
  };

  return restoreTo;
};

export const completeHostApplicationNavigation = (
  patch?: Parameters<typeof completeHostApplicationState>[0],
): AppRoutePath => {
  const auth = completeHostApplicationState(patch);
  const restoreTo = defaultRouteForAuth(auth);

  snapshot = {
    ...snapshot,
    auth,
    lastSafeRoute: restoreTo,
    pendingDestination: null,
  };

  return restoreTo;
};

export const lockNavigationTarget = (target: AppRoutePath) => {
  if (lockedTarget === target) {
    return false;
  }

  lockedTarget = target;
  return true;
};

export const releaseNavigationTarget = (target: AppRoutePath) => {
  if (lockedTarget === target) {
    lockedTarget = null;
  }
};
