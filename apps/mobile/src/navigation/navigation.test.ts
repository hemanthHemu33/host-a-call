import { describe, expect, it } from 'vitest';

import { initialAppStore } from '@/store/app.store';
import {
  getAuthSnapshot,
  initialCustomerOnboardingDraft,
} from '@/store/auth.store';

import { resolveDeepLink } from './deep-links';
import {
  clearNavigationSession,
  completeCustomerOnboardingNavigation,
  completeAuthSession,
  completeHostApplicationNavigation,
  consumePendingDestination,
  lockNavigationTarget,
  releaseNavigationTarget,
  resetNavigationSnapshot,
  resolveNavigationDecision,
  setNavigationSnapshot,
} from './navigation-store';
import { appRoutes } from './routes';

const bootedApp = { ...initialAppStore, bootstrapState: 'signed-out' as const };

describe('mobile navigation guards', () => {
  it('routes signed-out users directly to login without age confirmation', () => {
    resetNavigationSnapshot();

    expect(clearNavigationSession()).toBe(appRoutes.authLogin.path);
    expect(getAuthSnapshot().ageGateStatus).toBe('unknown');
  });

  it('prevents customers from opening host-only routes', () => {
    const decision = resolveNavigationDecision(appRoutes.hostDashboard.path, {
      app: bootedApp,
      auth: {
        accountStatus: 'active',
        ageGateStatus: 'confirmed',
        customerOnboarding: { ...initialCustomerOnboardingDraft },
        customerRouteTarget: 'home',
        phoneNumber: '+919000000001',
        role: 'customer',
        sessionId: 'session_customer',
      },
      lastSafeRoute: appRoutes.customerHome.path,
      pendingDestination: null,
    });

    expect(decision).toEqual({
      kind: 'redirect',
      reason: 'role-mismatch',
      redirectTo: appRoutes.customerHome.path,
    });
  });

  it('prevents hosts from opening customer-only routes', () => {
    const decision = resolveNavigationDecision(
      appRoutes.customerAddMoney.path,
      {
        app: bootedApp,
        auth: {
          accountStatus: 'active',
          ageGateStatus: 'confirmed',
          customerOnboarding: { ...initialCustomerOnboardingDraft },
          customerRouteTarget: null,
          phoneNumber: '+919000000009',
          role: 'host',
          sessionId: 'session_host',
        },
        lastSafeRoute: appRoutes.hostDashboard.path,
        pendingDestination: null,
      },
    );

    expect(decision).toEqual({
      kind: 'redirect',
      reason: 'role-mismatch',
      redirectTo: appRoutes.hostDashboard.path,
    });
  });

  it('blocks internal QA and gallery routes in production', () => {
    const decision = resolveNavigationDecision(
      appRoutes.developerScenarios.path,
      {
        app: bootedApp,
        auth: {
          accountStatus: null,
          ageGateStatus: 'unknown',
          customerOnboarding: { ...initialCustomerOnboardingDraft },
          customerRouteTarget: null,
          phoneNumber: null,
          role: null,
          sessionId: null,
        },
        lastSafeRoute: appRoutes.index.path,
        pendingDestination: null,
      },
      { environment: 'production' },
    );

    expect(decision).toEqual({
      kind: 'redirect',
      reason: 'production-internal-route',
      redirectTo: appRoutes.invalidLink.path,
    });
  });

  it('preserves safe logged-out deep links through authentication', () => {
    resetNavigationSnapshot();
    setNavigationSnapshot({
      app: bootedApp,
      auth: {
        accountStatus: null,
        ageGateStatus: 'unknown',
        customerOnboarding: { ...initialCustomerOnboardingDraft },
        customerRouteTarget: null,
        phoneNumber: null,
        role: null,
        sessionId: null,
      },
      lastSafeRoute: appRoutes.index.path,
      pendingDestination: null,
    });

    const decision = resolveNavigationDecision(appRoutes.customerSupport.path);

    expect(decision.kind).toBe('redirect');

    const restoreTo = completeAuthSession({
      customerRouteTarget: 'home',
      phoneNumber: '+919000000001',
      role: 'customer',
      sessionId: ' session_customer ',
    });

    expect(restoreTo).toBe(appRoutes.customerSupport.path);
    expect(consumePendingDestination()).toBeNull();
    expect(resolveNavigationDecision(restoreTo).kind).toBe('allow');
    expect(getAuthSnapshot()).toEqual({
      accountStatus: 'active',
      ageGateStatus: 'confirmed',
      customerOnboarding: { ...initialCustomerOnboardingDraft },
      customerRouteTarget: 'home',
      phoneNumber: '+919000000001',
      role: 'customer',
      sessionId: 'session_customer',
    });
  });

  it('does not restore a role-mismatched pending deep link after authentication', () => {
    resetNavigationSnapshot();
    setNavigationSnapshot({
      app: bootedApp,
      auth: {
        accountStatus: null,
        ageGateStatus: 'unknown',
        customerOnboarding: { ...initialCustomerOnboardingDraft },
        customerRouteTarget: null,
        phoneNumber: null,
        role: null,
        sessionId: null,
      },
      lastSafeRoute: appRoutes.index.path,
      pendingDestination: null,
    });

    resolveNavigationDecision(appRoutes.customerSupport.path);

    const restoreTo = completeAuthSession({
      phoneNumber: '+919000000009',
      role: 'host',
      sessionId: 'session_host',
    });

    expect(restoreTo).toBe(appRoutes.hostDashboard.path);
    expect(resolveNavigationDecision(appRoutes.customerSupport.path)).toEqual({
      kind: 'redirect',
      reason: 'role-mismatch',
      redirectTo: appRoutes.hostDashboard.path,
    });
  });

  it('clears authenticated navigation state on logout', () => {
    resetNavigationSnapshot();
    completeAuthSession({
      customerRouteTarget: 'home',
      phoneNumber: '+919000000001',
      role: 'customer',
      sessionId: 'session_customer',
    });

    expect(clearNavigationSession()).toBe(appRoutes.authLogin.path);
    expect(getAuthSnapshot()).toEqual({
      accountStatus: null,
      ageGateStatus: 'confirmed',
      customerOnboarding: { ...initialCustomerOnboardingDraft },
      customerRouteTarget: null,
      phoneNumber: null,
      role: null,
      sessionId: null,
    });
    expect(resolveNavigationDecision(appRoutes.customerHome.path)).toEqual({
      kind: 'redirect',
      reason: 'auth-required',
      redirectTo: appRoutes.authLogin.path,
    });
  });

  it('rejects empty session ids at the central auth mutation boundary', () => {
    expect(() =>
      completeAuthSession({
        customerRouteTarget: 'home',
        phoneNumber: '+919000000001',
        role: 'customer',
        sessionId: ' ',
      }),
    ).toThrow('Auth session id is required.');
  });

  it('routes new customers into onboarding after authentication', () => {
    resetNavigationSnapshot();

    expect(
      completeAuthSession({
        customerRouteTarget: 'onboarding',
        phoneNumber: '+919000000002',
        role: 'customer',
        sessionId: 'session_new_customer',
      }),
    ).toBe(appRoutes.customerOnboardingProfile.path);

    expect(resolveNavigationDecision(appRoutes.customerHome.path)).toEqual({
      kind: 'redirect',
      reason: 'customer-onboarding-required',
      redirectTo: appRoutes.customerOnboardingProfile.path,
    });
  });

  it('resumes interrupted onboarding at the last valid step', () => {
    expect(
      resolveNavigationDecision(appRoutes.customerHome.path, {
        app: bootedApp,
        auth: {
          accountStatus: 'active',
          ageGateStatus: 'confirmed',
          customerOnboarding: {
            ...initialCustomerOnboardingDraft,
            currentStep: 'language',
            dateOfBirthInput: '01/01/2000',
            displayName: 'Customer Two',
            gender: 'woman',
          },
          customerRouteTarget: 'onboarding',
          phoneNumber: '+919000000002',
          role: 'customer',
          sessionId: 'session_new_customer',
        },
        lastSafeRoute: appRoutes.customerOnboardingLanguage.path,
        pendingDestination: null,
      }),
    ).toEqual({
      kind: 'redirect',
      reason: 'customer-onboarding-required',
      redirectTo: appRoutes.customerOnboardingLanguage.path,
    });

    expect(
      resolveNavigationDecision(appRoutes.customerHome.path, {
        app: bootedApp,
        auth: {
          accountStatus: 'active',
          ageGateStatus: 'confirmed',
          customerOnboarding: {
            ...initialCustomerOnboardingDraft,
            currentStep: 'permissions',
            dateOfBirthInput: '01/01/2000',
            displayName: 'Customer Two',
            gender: 'woman',
            matchTags: ['friendship'],
            primaryLanguage: 'English',
          },
          customerRouteTarget: 'onboarding',
          phoneNumber: '+919000000002',
          role: 'customer',
          sessionId: 'session_new_customer',
        },
        lastSafeRoute: appRoutes.customerOnboardingPermissions.path,
        pendingDestination: null,
      }),
    ).toEqual({
      kind: 'redirect',
      reason: 'customer-onboarding-required',
      redirectTo: appRoutes.customerOnboardingPermissions.path,
    });

    expect(
      resolveNavigationDecision(appRoutes.customerHome.path, {
        app: bootedApp,
        auth: {
          accountStatus: 'active',
          ageGateStatus: 'confirmed',
          customerOnboarding: {
            ...initialCustomerOnboardingDraft,
            currentStep: 'voiceVerification',
            dateOfBirthInput: '01/01/2000',
            displayName: 'Customer Two',
            gender: 'woman',
            matchTags: ['friendship'],
            primaryLanguage: 'English',
          },
          customerRouteTarget: 'onboarding',
          phoneNumber: '+919000000002',
          role: 'customer',
          sessionId: 'session_new_customer',
        },
        lastSafeRoute: appRoutes.customerOnboardingVoiceVerification.path,
        pendingDestination: null,
      }),
    ).toEqual({
      kind: 'redirect',
      reason: 'customer-onboarding-required',
      redirectTo: appRoutes.customerOnboardingVoiceVerification.path,
    });
  });

  it('routes completed customer onboarding back to Home', () => {
    resetNavigationSnapshot();

    completeAuthSession({
      customerRouteTarget: 'onboarding',
      phoneNumber: '+919000000002',
      role: 'customer',
      sessionId: 'session_new_customer',
    });

    const restoreTo = completeCustomerOnboardingNavigation();

    expect(restoreTo).toBe(appRoutes.customerHome.path);
    expect(
      resolveNavigationDecision(appRoutes.customerOnboardingProfile.path),
    ).toEqual({
      kind: 'redirect',
      reason: 'customer-onboarding-complete',
      redirectTo: appRoutes.customerHome.path,
    });
    expect(getAuthSnapshot().customerRouteTarget).toBe('home');
    expect(getAuthSnapshot().customerOnboarding.completedAtIso).not.toBeNull();
    expect(getAuthSnapshot().customerOnboarding.displayName).toBe('');
    expect(getAuthSnapshot().customerOnboarding.primaryLanguage).toBeNull();
  });

  it('does not block onboarding completion when notifications are declined', () => {
    resetNavigationSnapshot();

    completeAuthSession({
      customerRouteTarget: 'onboarding',
      phoneNumber: '+919000000002',
      role: 'customer',
      sessionId: 'session_new_customer',
    });

    expect(
      completeCustomerOnboardingNavigation({
        notificationsPermission: 'not-now',
      }),
    ).toBe(appRoutes.customerHome.path);
    expect(getAuthSnapshot().customerOnboarding.notificationsPermission).toBe(
      'not-now',
    );
  });

  it('promotes an approved female applicant to host after agreement submission', () => {
    resetNavigationSnapshot();

    completeAuthSession({
      customerRouteTarget: 'onboarding',
      phoneNumber: '+919000000002',
      role: 'customer',
      sessionId: 'session_new_customer',
    });

    const restoreTo = completeHostApplicationNavigation({
      currentStep: 'hostAgreement',
      hostAgreementAcceptedAtIso: '2026-07-16T00:05:00.000Z',
      hostApplicationSubmittedAtIso: '2026-07-16T00:05:00.000Z',
      hostVoiceVerificationRecordingUri: 'file:///voice.m4a',
      hostVoiceVerificationStatus: 'verified',
      hostVoiceVerificationSubmittedAtIso: '2026-07-16T00:00:00.000Z',
    });

    expect(restoreTo).toBe(appRoutes.hostDashboard.path);
    expect(getAuthSnapshot().role).toBe('host');
    expect(getAuthSnapshot().customerRouteTarget).toBeNull();
    expect(resolveNavigationDecision(appRoutes.hostDashboard.path).kind).toBe(
      'allow',
    );
  });

  it('resolves supported deep links and rejects invalid ones', () => {
    expect(resolveDeepLink('connecto://referral/ABC')).toEqual({
      destination: appRoutes.linkReferral.path,
      kind: 'valid',
    });
    expect(resolveDeepLink('/payment-result')).toEqual({
      destination: appRoutes.customerPaymentStates.path,
      kind: 'valid',
    });
    expect(resolveDeepLink('/unsupported')).toEqual({
      kind: 'invalid',
      reason: 'unsupported-deep-link',
    });
  });

  it('locks rapid duplicate navigation targets', () => {
    resetNavigationSnapshot();
    expect(lockNavigationTarget(appRoutes.customerHome.path)).toBe(true);
    expect(lockNavigationTarget(appRoutes.customerHome.path)).toBe(false);
    releaseNavigationTarget(appRoutes.customerHome.path);
    expect(lockNavigationTarget(appRoutes.customerHome.path)).toBe(true);
  });
});
