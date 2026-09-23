import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createMockPostCallAdapter,
  type EnsurePostCallRecordInput,
} from './post-call.adapters';
import { resetPostCallStateCache } from './post-call.storage';

const createClock = (iso: string) => {
  let current = new Date(iso).getTime();

  return {
    advanceByMs: (ms: number) => {
      current += ms;
    },
    clock: {
      now: () => new Date(current),
    },
  };
};

const summarySeed = (callId: string): EnsurePostCallRecordInput => ({
  callId,
  connectedDurationMs: 190_000,
  endedAtIso: '2026-07-17T10:00:00.000Z',
  hostId: 'host_anjali',
  hostName: 'Anjali',
  mediaMode: 'voice',
  reason: 'manual',
  remainingBalancePaise: 24_000,
  sessionId: `${callId}_session`,
  videoDurationMs: 0,
});

describe('post-call adapter', () => {
  beforeEach(() => {
    resetPostCallStateCache();
  });

  afterEach(() => {
    resetPostCallStateCache();
  });

  it('prevents a connected call from being rated twice', async () => {
    const { clock } = createClock('2026-07-17T10:00:00.000Z');
    const adapter = createMockPostCallAdapter({ clock });

    await adapter.clear();
    await adapter.ensureCallRecord(summarySeed('call_rating_once'));

    await expect(
      adapter.submitRating({
        callId: 'call_rating_once',
        comment: 'Helpful first call.',
        stars: 5,
        tags: ['clear-audio', 'helpful'],
      }),
    ).resolves.toMatchObject({
      callId: 'call_rating_once',
      rating: {
        stars: 5,
      },
    });

    await expect(
      adapter.submitRating({
        callId: 'call_rating_once',
        comment: 'Second attempt should fail.',
        stars: 3,
        tags: ['technical-issue'],
      }),
    ).rejects.toThrow('already been rated');
  });

  it('finalizes delayed billing after a simulated app restart', async () => {
    const time = createClock('2026-07-17T10:00:00.000Z');
    const adapter = createMockPostCallAdapter({ clock: time.clock });

    await adapter.clear();
    await adapter.ensureCallRecord(summarySeed('call_restart_resume'));

    await expect(
      adapter.getCallRecord('call_restart_resume'),
    ).resolves.toMatchObject({
      callId: 'call_restart_resume',
      finalizationStatus: 'processing',
      verificationState: 'pending',
    });

    resetPostCallStateCache();
    time.advanceByMs(7_000);

    const restartedAdapter = createMockPostCallAdapter({ clock: time.clock });
    await expect(
      restartedAdapter.refreshCallRecord('call_restart_resume'),
    ).resolves.toMatchObject({
      callId: 'call_restart_resume',
      finalizationStatus: 'finalized',
      verificationState: 'verified',
    });
  });
});
