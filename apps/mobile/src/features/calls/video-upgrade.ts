export type VideoUpgradeFailureStep = 'connection' | 'request';

export type VideoUpgradePhase =
  | { kind: 'awaiting-host'; requestedAtMs: number }
  | { acceptedAtMs: number; kind: 'camera-check' }
  | { acceptedAtMs: number; kind: 'camera-requesting' }
  | { kind: 'camera-denied'; message: string }
  | { countdownEndsAtMs: number; kind: 'countdown' }
  | { cooldownEndsAtMs: number; kind: 'cooldown'; message: string }
  | { kind: 'connecting'; startedAtMs: number }
  | { kind: 'failure'; message: string; step: VideoUpgradeFailureStep }
  | { kind: 'idle' };

export type VideoUpgradeEvent =
  | { atMs: number; type: 'connect-started' }
  | { countdownEndsAtMs: number; type: 'camera-granted' }
  | { message: string; type: 'camera-denied' }
  | { type: 'camera-request-started' }
  | { type: 'cancelled' }
  | { type: 'cooldown-finished' }
  | { message: string; step: VideoUpgradeFailureStep; type: 'failed' }
  | { atMs: number; type: 'host-accepted' }
  | {
      cooldownEndsAtMs: number;
      message: string;
      type: 'host-rejected';
    }
  | { atMs: number; type: 'request-started' }
  | { type: 'resolved' };

export const initialVideoUpgradePhase: VideoUpgradePhase = {
  kind: 'idle',
};

const invalidTransition = (
  phase: VideoUpgradePhase['kind'],
  event: VideoUpgradeEvent['type'],
) => {
  throw new Error(`video upgrade cannot transition from ${phase} on ${event}`);
};

export const transitionVideoUpgradePhase = (
  phase: VideoUpgradePhase,
  event: VideoUpgradeEvent,
): VideoUpgradePhase => {
  switch (phase.kind) {
    case 'idle':
      if (event.type === 'request-started') {
        return {
          kind: 'awaiting-host',
          requestedAtMs: event.atMs,
        };
      }

      return invalidTransition(phase.kind, event.type);

    case 'awaiting-host':
      if (event.type === 'host-accepted') {
        return {
          acceptedAtMs: event.atMs,
          kind: 'camera-check',
        };
      }

      if (event.type === 'host-rejected') {
        return {
          cooldownEndsAtMs: event.cooldownEndsAtMs,
          kind: 'cooldown',
          message: event.message,
        };
      }

      if (event.type === 'cancelled') {
        return initialVideoUpgradePhase;
      }

      if (event.type === 'failed') {
        return {
          kind: 'failure',
          message: event.message,
          step: event.step,
        };
      }

      return invalidTransition(phase.kind, event.type);

    case 'camera-check':
      if (event.type === 'camera-request-started') {
        return {
          acceptedAtMs: phase.acceptedAtMs,
          kind: 'camera-requesting',
        };
      }

      if (event.type === 'camera-granted') {
        return {
          countdownEndsAtMs: event.countdownEndsAtMs,
          kind: 'countdown',
        };
      }

      if (event.type === 'camera-denied') {
        return {
          kind: 'camera-denied',
          message: event.message,
        };
      }

      if (event.type === 'cancelled') {
        return initialVideoUpgradePhase;
      }

      return invalidTransition(phase.kind, event.type);

    case 'camera-requesting':
      if (event.type === 'camera-granted') {
        return {
          countdownEndsAtMs: event.countdownEndsAtMs,
          kind: 'countdown',
        };
      }

      if (event.type === 'camera-denied') {
        return {
          kind: 'camera-denied',
          message: event.message,
        };
      }

      if (event.type === 'cancelled') {
        return initialVideoUpgradePhase;
      }

      return invalidTransition(phase.kind, event.type);

    case 'camera-denied':
      if (event.type === 'resolved') {
        return initialVideoUpgradePhase;
      }

      return invalidTransition(phase.kind, event.type);

    case 'countdown':
      if (event.type === 'connect-started') {
        return {
          kind: 'connecting',
          startedAtMs: event.atMs,
        };
      }

      if (event.type === 'cancelled') {
        return initialVideoUpgradePhase;
      }

      return invalidTransition(phase.kind, event.type);

    case 'connecting':
      if (event.type === 'resolved') {
        return initialVideoUpgradePhase;
      }

      if (event.type === 'failed') {
        return {
          kind: 'failure',
          message: event.message,
          step: event.step,
        };
      }

      return invalidTransition(phase.kind, event.type);

    case 'cooldown':
      if (event.type === 'cooldown-finished') {
        return initialVideoUpgradePhase;
      }

      return invalidTransition(phase.kind, event.type);

    case 'failure':
      if (event.type === 'resolved') {
        return initialVideoUpgradePhase;
      }

      return invalidTransition(phase.kind, event.type);
  }
};

export const canCancelVideoUpgrade = (phase: VideoUpgradePhase) =>
  phase.kind === 'awaiting-host' ||
  phase.kind === 'camera-check' ||
  phase.kind === 'camera-requesting' ||
  phase.kind === 'countdown';

export const getVideoUpgradeCooldownRemainingMs = (
  phase: VideoUpgradePhase,
  nowMs: number,
) =>
  phase.kind === 'cooldown' ? Math.max(0, phase.cooldownEndsAtMs - nowMs) : 0;

export const getVideoUpgradeCountdownSeconds = (
  phase: VideoUpgradePhase,
  nowMs: number,
) =>
  phase.kind === 'countdown'
    ? Math.max(0, Math.ceil((phase.countdownEndsAtMs - nowMs) / 1_000))
    : 0;

export const isVideoUpgradeVisualPhase = (phase: VideoUpgradePhase) =>
  phase.kind === 'camera-check' ||
  phase.kind === 'camera-requesting' ||
  phase.kind === 'countdown' ||
  phase.kind === 'connecting';

export const formatVideoUpgradeTimerLabel = (seconds: number) =>
  `00:${String(Math.max(0, seconds)).padStart(2, '0')}`;
