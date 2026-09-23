import { describe, expect, it } from 'vitest';

import type { ActiveVoiceCallSession } from './call.store';
import {
  getActiveCallConnectedDurationMs,
  getActiveCallVideoDurationMs,
  initialCallStore,
  markVideoUnlockCelebratedStore,
  restoreActiveCallStore,
  setActiveCallSelfPreviewPositionStore,
  startActiveCallStore,
  syncActiveCallStore,
  transitionActiveCallStore,
} from './call.store';

const session: ActiveVoiceCallSession = {
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
};

describe('active call store runtime', () => {
  it('pauses connected time while reconnecting, resumes on restore, and clamps backward clock drift', () => {
    let snapshot = startActiveCallStore(
      initialCallStore,
      'call_1',
      session,
      1_000,
    );

    snapshot = syncActiveCallStore(snapshot, 91_000);
    expect(getActiveCallConnectedDurationMs(snapshot, 91_000)).toBe(90_000);

    snapshot = transitionActiveCallStore(snapshot, 'connection-lost', 91_000);
    expect(snapshot.activeState).toBe('reconnecting');
    expect(getActiveCallConnectedDurationMs(snapshot, 120_000)).toBe(90_000);

    snapshot = restoreActiveCallStore(snapshot, 130_000);
    expect(snapshot.activeState).toBe('voice-locked');
    expect(getActiveCallConnectedDurationMs(snapshot, 130_000)).toBe(90_000);

    snapshot = syncActiveCallStore(snapshot, 160_000);
    expect(getActiveCallConnectedDurationMs(snapshot, 160_000)).toBe(120_000);

    snapshot = syncActiveCallStore(snapshot, 150_000);
    expect(getActiveCallConnectedDurationMs(snapshot, 150_000)).toBe(120_000);
  });

  it('restores to the exact pre-reconnect call state', () => {
    let snapshot = startActiveCallStore(initialCallStore, 'call_1', session, 0);

    snapshot = syncActiveCallStore(snapshot, 180_000);
    expect(snapshot.activeState).toBe('voice-eligible');

    snapshot = transitionActiveCallStore(snapshot, 'request-video', 181_000);
    expect(snapshot.activeState).toBe('video-requested');

    snapshot = transitionActiveCallStore(snapshot, 'connection-lost', 182_000);
    expect(snapshot.activeState).toBe('reconnecting');

    snapshot = restoreActiveCallStore(snapshot, 190_000);
    expect(snapshot.activeState).toBe('video-requested');
  });

  it('unlocks video exactly once after 180 connected seconds', () => {
    let snapshot = startActiveCallStore(initialCallStore, 'call_1', session, 0);

    snapshot = syncActiveCallStore(snapshot, 179_999);
    expect(snapshot.activeState).toBe('voice-locked');
    expect(snapshot.activeRuntime?.videoUnlockEmittedAtMs).toBeNull();

    snapshot = syncActiveCallStore(snapshot, 180_000);
    expect(snapshot.activeState).toBe('voice-eligible');
    expect(snapshot.activeRuntime?.videoUnlockEmittedAtMs).toBe(180_000);

    snapshot = syncActiveCallStore(snapshot, 240_000);
    expect(snapshot.activeState).toBe('voice-eligible');
    expect(snapshot.activeRuntime?.videoUnlockEmittedAtMs).toBe(180_000);

    snapshot = markVideoUnlockCelebratedStore(snapshot, 240_000);
    expect(snapshot.activeRuntime?.videoUnlockCelebratedAtMs).toBe(240_000);
  });

  it('tracks connected video time separately and pauses it while reconnecting', () => {
    let snapshot = startActiveCallStore(initialCallStore, 'call_1', session, 0);

    snapshot = syncActiveCallStore(snapshot, 180_000);
    snapshot = transitionActiveCallStore(snapshot, 'request-video', 181_000);
    snapshot = transitionActiveCallStore(snapshot, 'accept-video', 182_000);
    expect(getActiveCallVideoDurationMs(snapshot, 210_000)).toBe(28_000);

    snapshot = transitionActiveCallStore(snapshot, 'connection-lost', 210_000);
    expect(snapshot.activeState).toBe('reconnecting');
    expect(getActiveCallVideoDurationMs(snapshot, 240_000)).toBe(28_000);

    snapshot = restoreActiveCallStore(snapshot, 250_000);
    expect(snapshot.activeState).toBe('video');
    expect(getActiveCallVideoDurationMs(snapshot, 280_000)).toBe(58_000);

    snapshot = transitionActiveCallStore(
      snapshot,
      'downgrade-to-voice',
      280_000,
    );
    expect(getActiveCallVideoDurationMs(snapshot, 300_000)).toBe(58_000);
  });

  it('persists normalized self-preview position inside the active runtime', () => {
    let snapshot = startActiveCallStore(initialCallStore, 'call_1', session, 0);

    snapshot = setActiveCallSelfPreviewPositionStore(snapshot, {
      x: 0.18,
      y: 0.84,
    });

    expect(snapshot.activeRuntime?.selfPreviewPosition).toEqual({
      x: 0.18,
      y: 0.84,
    });
  });
});
