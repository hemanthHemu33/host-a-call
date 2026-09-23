import { describe, expect, it } from 'vitest';

import {
  canCancelVideoUpgrade,
  getVideoUpgradeCooldownRemainingMs,
  getVideoUpgradeCountdownSeconds,
  initialVideoUpgradePhase,
  transitionVideoUpgradePhase,
} from './video-upgrade';

describe('video upgrade state machine', () => {
  it('covers the accepted path through countdown and connection start', () => {
    let phase = transitionVideoUpgradePhase(initialVideoUpgradePhase, {
      atMs: 10,
      type: 'request-started',
    });

    expect(phase).toEqual({
      kind: 'awaiting-host',
      requestedAtMs: 10,
    });
    expect(canCancelVideoUpgrade(phase)).toBe(true);

    phase = transitionVideoUpgradePhase(phase, {
      atMs: 1_000,
      type: 'host-accepted',
    });
    expect(phase).toEqual({
      acceptedAtMs: 1_000,
      kind: 'camera-check',
    });

    phase = transitionVideoUpgradePhase(phase, {
      type: 'camera-request-started',
    });
    expect(phase).toEqual({
      acceptedAtMs: 1_000,
      kind: 'camera-requesting',
    });

    phase = transitionVideoUpgradePhase(phase, {
      countdownEndsAtMs: 4_000,
      type: 'camera-granted',
    });
    expect(phase).toEqual({
      countdownEndsAtMs: 4_000,
      kind: 'countdown',
    });
    expect(getVideoUpgradeCountdownSeconds(phase, 2_100)).toBe(2);

    phase = transitionVideoUpgradePhase(phase, {
      atMs: 4_000,
      type: 'connect-started',
    });
    expect(phase).toEqual({
      kind: 'connecting',
      startedAtMs: 4_000,
    });

    phase = transitionVideoUpgradePhase(phase, {
      type: 'resolved',
    });
    expect(phase).toEqual(initialVideoUpgradePhase);
  });

  it('covers rejection cooldown and retry eligibility restoration', () => {
    const waiting = transitionVideoUpgradePhase(initialVideoUpgradePhase, {
      atMs: 20,
      type: 'request-started',
    });
    const cooldown = transitionVideoUpgradePhase(waiting, {
      cooldownEndsAtMs: 30_020,
      message: 'Host rejected this request.',
      type: 'host-rejected',
    });

    expect(cooldown).toEqual({
      cooldownEndsAtMs: 30_020,
      kind: 'cooldown',
      message: 'Host rejected this request.',
    });
    expect(getVideoUpgradeCooldownRemainingMs(cooldown, 20)).toBe(30_000);

    expect(
      transitionVideoUpgradePhase(cooldown, {
        type: 'cooldown-finished',
      }),
    ).toEqual(initialVideoUpgradePhase);
  });

  it('covers cancellation before video connection begins', () => {
    const waiting = transitionVideoUpgradePhase(initialVideoUpgradePhase, {
      atMs: 0,
      type: 'request-started',
    });

    expect(
      transitionVideoUpgradePhase(waiting, {
        type: 'cancelled',
      }),
    ).toEqual(initialVideoUpgradePhase);

    const countdown = transitionVideoUpgradePhase(
      transitionVideoUpgradePhase(waiting, {
        atMs: 100,
        type: 'host-accepted',
      }),
      {
        countdownEndsAtMs: 3_100,
        type: 'camera-granted',
      },
    );

    expect(
      transitionVideoUpgradePhase(countdown, {
        type: 'cancelled',
      }),
    ).toEqual(initialVideoUpgradePhase);
  });

  it('covers permission denial and connection failure recovery', () => {
    const permissionDenied = transitionVideoUpgradePhase(
      transitionVideoUpgradePhase(initialVideoUpgradePhase, {
        atMs: 0,
        type: 'request-started',
      }),
      {
        atMs: 150,
        type: 'host-accepted',
      },
    );
    const denied = transitionVideoUpgradePhase(permissionDenied, {
      message: 'Camera permission was denied.',
      type: 'camera-denied',
    });

    expect(denied).toEqual({
      kind: 'camera-denied',
      message: 'Camera permission was denied.',
    });
    expect(
      transitionVideoUpgradePhase(denied, {
        type: 'resolved',
      }),
    ).toEqual(initialVideoUpgradePhase);

    const connecting = transitionVideoUpgradePhase(
      transitionVideoUpgradePhase(permissionDenied, {
        countdownEndsAtMs: 3_000,
        type: 'camera-granted',
      }),
      {
        atMs: 3_000,
        type: 'connect-started',
      },
    );
    const failure = transitionVideoUpgradePhase(connecting, {
      message: 'Remote video failed to connect.',
      step: 'connection',
      type: 'failed',
    });

    expect(failure).toEqual({
      kind: 'failure',
      message: 'Remote video failed to connect.',
      step: 'connection',
    });
    expect(
      transitionVideoUpgradePhase(failure, {
        type: 'resolved',
      }),
    ).toEqual(initialVideoUpgradePhase);
  });
});
