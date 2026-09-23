import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  activeCallUnlockDurationMs,
  readMonotonicNowMs,
} from '@/store/call.store';
import type { ConversationOrbState } from '@/components/animations/registry';
import type { ActiveCallState, ConnectionQuality } from '@connecto/domain';

export type ActiveCallClock = {
  nowMs: () => number;
};

export type TrustRingStage = 'early' | 'ready' | 'steady';

export type NetworkQualityModel = {
  label: string;
  quality: ConnectionQuality;
  samples: readonly number[];
  score: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const defaultActiveCallClock: ActiveCallClock = {
  nowMs: readMonotonicNowMs,
};

export const formatActiveCallDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
};

export const formatRemainingUnlockLabel = (remainingMs: number) =>
  formatActiveCallDuration(remainingMs);

export const estimateActiveCallChargePaise = ({
  connectedDurationMs,
  videoDurationMs,
  videoRatePaise,
  voiceRatePaise,
}: {
  connectedDurationMs: number;
  videoDurationMs: number;
  videoRatePaise: number;
  voiceRatePaise: number;
}) => {
  const boundedVideoDurationMs = Math.max(
    0,
    Math.min(videoDurationMs, connectedDurationMs),
  );
  const voiceDurationMs = Math.max(
    0,
    connectedDurationMs - boundedVideoDurationMs,
  );

  return Math.max(
    0,
    Math.floor((voiceDurationMs / 60_000) * voiceRatePaise) +
      Math.floor((boundedVideoDurationMs / 60_000) * videoRatePaise),
  );
};

export const estimateRemainingBalancePaise = (input: {
  balancePaise: number;
  connectedDurationMs: number;
  videoDurationMs: number;
  videoRatePaise: number;
  voiceRatePaise: number;
}) =>
  Math.max(
    0,
    input.balancePaise -
      estimateActiveCallChargePaise({
        connectedDurationMs: input.connectedDurationMs,
        videoDurationMs: input.videoDurationMs,
        videoRatePaise: input.videoRatePaise,
        voiceRatePaise: input.voiceRatePaise,
      }),
  );

export const estimateRemainingTimeMs = (
  remainingBalancePaise: number,
  voiceRatePaise: number,
) =>
  voiceRatePaise <= 0
    ? 0
    : Math.max(
        0,
        Math.floor((remainingBalancePaise / voiceRatePaise) * 60_000),
      );

export const deriveTrustRingStage = (
  connectedDurationMs: number,
): TrustRingStage =>
  connectedDurationMs >= activeCallUnlockDurationMs
    ? 'ready'
    : connectedDurationMs >= 90_000
      ? 'steady'
      : 'early';

export const deriveConversationOrbState = ({
  activeState,
  celebrationVisible,
}: {
  activeState: ActiveCallState;
  celebrationVisible: boolean;
}): ConversationOrbState =>
  celebrationVisible
    ? 'videoUnlocked'
    : activeState === 'reconnecting'
      ? 'reconnecting'
      : activeState === 'video-requested'
        ? 'videoRequested'
        : activeState === 'video'
          ? 'video'
          : activeState === 'ended'
            ? 'ended'
            : 'voice';

export const deriveNetworkQualityModel = ({
  activeState,
  connectedDurationMs,
  nowMs,
  qualityOverride,
}: {
  activeState: ActiveCallState;
  connectedDurationMs: number;
  nowMs: number;
  qualityOverride?: ConnectionQuality | null | undefined;
}): NetworkQualityModel => {
  if (activeState === 'reconnecting') {
    return {
      label: 'Reconnecting',
      quality: 'reconnecting',
      samples: [1, 1, 0.8, 0.6, 0.4],
      score: 1,
    };
  }

  if (activeState === 'ended') {
    return {
      label: 'Offline',
      quality: 'offline',
      samples: [0, 0, 0, 0, 0],
      score: 0,
    };
  }

  if (qualityOverride !== undefined && qualityOverride !== null) {
    if (qualityOverride === 'excellent') {
      return {
        label: 'Excellent',
        quality: 'excellent',
        samples: [4, 5, 5, 5, 4],
        score: 5,
      };
    }

    if (qualityOverride === 'good') {
      return {
        label: 'Good',
        quality: 'good',
        samples: [3, 4, 4, 4, 3],
        score: 4,
      };
    }

    if (qualityOverride === 'poor') {
      return {
        label: 'Poor',
        quality: 'poor',
        samples: [1, 2, 2, 2, 1],
        score: 2,
      };
    }

    if (qualityOverride === 'offline') {
      return {
        label: 'Offline',
        quality: 'offline',
        samples: [0, 0, 0, 0, 0],
        score: 0,
      };
    }

    return {
      label: 'Reconnecting',
      quality: 'reconnecting',
      samples: [1, 1, 0.8, 0.6, 0.4],
      score: 1,
    };
  }

  const stability = clamp01(connectedDurationMs / activeCallUnlockDurationMs);
  const phase = (nowMs / 10_000) % 1;
  const score = phase > 0.82 ? 5 : phase > 0.34 || stability > 0.45 ? 4 : 3;

  return {
    label: score >= 5 ? 'Excellent' : 'Good',
    quality: score >= 5 ? 'excellent' : 'good',
    samples: [
      Math.max(1, score - 1),
      score,
      Math.min(5, score + 1),
      score,
      Math.max(1, score - 1),
    ],
    score,
  };
};

// Deterministic placeholder until the provider streams live audio levels.
export const createMockWaveformSamples = ({
  active,
  audioLevel,
  nowMs,
  reducedMotionEnabled,
}: {
  active: boolean;
  audioLevel?: number | null | undefined;
  nowMs: number;
  reducedMotionEnabled: boolean;
}) => {
  if (!active) {
    return reducedMotionEnabled
      ? [0.16, 0.12, 0.18, 0.14, 0.1]
      : Array.from({ length: 18 }, () => 0.14);
  }

  if (audioLevel !== undefined && audioLevel !== null) {
    const length = reducedMotionEnabled ? 8 : 18;
    const phase = nowMs / 320;
    const clampedLevel = clamp01(audioLevel);

    return Array.from({ length }, (_, index) =>
      clamp01(
        0.08 +
          clampedLevel * 0.82 +
          Math.abs(Math.sin(phase + index * 0.44)) * clampedLevel * 0.18,
      ),
    );
  }

  const length = reducedMotionEnabled ? 8 : 18;
  const phase = nowMs / 360;

  return Array.from({ length }, (_, index) =>
    clamp01(
      0.18 +
        Math.abs(Math.sin(phase + index * 0.42)) * 0.56 +
        Math.abs(Math.cos(phase / 2 + index * 0.21)) * 0.12,
    ),
  );
};

export const useActiveCallTicker = ({
  active = true,
  clock = defaultActiveCallClock,
  intervalMs = 1_000,
}: {
  active?: boolean;
  clock?: ActiveCallClock;
  intervalMs?: number;
}) => {
  const [nowMs, setNowMs] = useState(() => clock.nowMs());

  useEffect(() => {
    if (!active) {
      return;
    }

    const tick = () => {
      setNowMs(clock.nowMs());
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startInterval = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }

      intervalId = setInterval(tick, intervalMs);
    };

    tick();

    if (AppState.currentState === 'active') {
      startInterval();
    }

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        tick();
        startInterval();
        return;
      }

      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }

      subscription.remove();
    };
  }, [active, clock, intervalMs]);

  return nowMs;
};
