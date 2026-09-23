import { describe, expect, it } from 'vitest';

import { useUiPreferencesStore } from './app.store';
import { initialCustomerOnboardingDraft, useAuthStore } from './auth.store';
import { useActiveCallStore } from './call.store';
import { useWalletDisplayCacheStore } from './wallet.store';

describe('mobile Zustand stores', () => {
  it('updates auth, call, wallet, and UI preference state', () => {
    useAuthStore.getState().setSession({
      customerRouteTarget: 'home',
      phoneNumber: '+919000000001',
      role: 'customer',
      sessionId: 'session_1',
    });
    expect(useAuthStore.getState().sessionId).toBe('session_1');
    expect(useAuthStore.getState().customerOnboarding).toEqual({
      ...initialCustomerOnboardingDraft,
    });
    useAuthStore.getState().setCustomerOnboardingDraft({
      currentStep: 'language',
      displayName: 'Customer One',
      primaryLanguage: 'Telugu',
    });
    expect(useAuthStore.getState().customerOnboarding.displayName).toBe(
      'Customer One',
    );
    expect(useAuthStore.getState().customerOnboarding.currentStep).toBe(
      'language',
    );
    useAuthStore.getState().clearSession();

    useActiveCallStore.getState().reset();
    useActiveCallStore.getState().transitionOutgoing('start');
    expect(useActiveCallStore.getState().outgoingState).toBe(
      'permission-check',
    );
    useActiveCallStore.getState().startActiveCall('call_1', {
      agoraAppId: 'mock-agora-app-id',
      callId: 'call_1',
      customerId: 'customer_1',
      hostAge: 25,
      hostId: 'host_anjali',
      hostLanguage: 'Telugu',
      hostName: 'Anjali',
      id: 'session_1',
      mediaResourceId: 'media_1',
      provider: 'mock',
      rtcChannelName: 'rtc_channel_1',
      rtcToken: 'mock-token',
      startedAtIso: '2026-07-16T10:00:00.000Z',
      tokenExpiresAtIso: '2026-07-16T10:10:00.000Z',
      videoAvailableAfterMinutes: 3,
      videoRate: { amountPaise: 1600, currency: 'INR' },
      voiceRate: { amountPaise: 1000, currency: 'INR' },
    });
    expect(useActiveCallStore.getState().activeSession).toMatchObject({
      callId: 'call_1',
      mediaResourceId: 'media_1',
      rtcChannelName: 'rtc_channel_1',
    });
    useActiveCallStore.getState().reset();
    expect(useActiveCallStore.getState().activeSession).toBeNull();

    useWalletDisplayCacheStore.getState().setBalance({
      amountPaise: 2500,
      currency: 'INR',
    });
    expect(useWalletDisplayCacheStore.getState().balance.amountPaise).toBe(
      2500,
    );

    useUiPreferencesStore.getState().setReducedMotionEnabled(true);
    useUiPreferencesStore.getState().setNonessentialHapticsEnabled(false);
    expect(useUiPreferencesStore.getState().reducedMotionEnabled).toBe(true);
    expect(useUiPreferencesStore.getState().nonessentialHapticsEnabled).toBe(
      false,
    );
  });
});
