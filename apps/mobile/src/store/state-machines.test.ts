import { describe, expect, it } from 'vitest';

import { initialAppStore, transitionAppStore } from './app.store';
import {
  initialCallStore,
  startActiveCallStore,
  transitionActiveCallStore,
  transitionOutgoingCallStore,
} from './call.store';
import {
  initialWalletStore,
  transitionWalletPayment,
  transitionWalletReferral,
  transitionWalletWithdrawal,
} from './wallet.store';

describe('mobile store state machine wiring', () => {
  it('routes app bootstrap through the canonical state machine', () => {
    expect(
      transitionAppStore(initialAppStore, 'bootstrap-complete').bootstrapState,
    ).toBe('signed-out');
  });

  it('routes outgoing and active calls through canonical state machines', () => {
    const permissionCheck = transitionOutgoingCallStore(
      initialCallStore,
      'start',
    );

    expect(permissionCheck.outgoingState).toBe('permission-check');
    expect(() =>
      transitionOutgoingCallStore(permissionCheck, 'host-accepted'),
    ).toThrow(/outgoing call/);

    const activeCall = startActiveCallStore(permissionCheck, 'call_1');
    expect(
      transitionActiveCallStore(activeCall, 'unlock-video').activeState,
    ).toBe('voice-eligible');
  });

  it('routes wallet, withdrawal, and referral flows through canonical machines', () => {
    expect(
      transitionWalletPayment(initialWalletStore, 'request-order').paymentState,
    ).toBe('order-requested');

    expect(
      transitionWalletWithdrawal(initialWalletStore, 'request').withdrawalState,
    ).toBe('requested');

    expect(
      transitionWalletReferral(initialWalletStore, 'enter-code')
        .referralQualificationState,
    ).toBe('code-entered');
  });
});
