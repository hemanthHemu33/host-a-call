import { describe, expect, it } from 'vitest';

import { seededPostCallRecords } from './post-call.fixtures';
import {
  applyPostCallHistoryFilter,
  createInrMoney,
  formatPostCallCurrency,
  formatPostCallDuration,
} from './post-call.models';

describe('post-call model helpers', () => {
  it('formats durations for short and minute-based call segments', () => {
    expect(formatPostCallDuration(45)).toBe('45s');
    expect(formatPostCallDuration(65)).toBe('1m 05s');
    expect(formatPostCallDuration(3_905)).toBe('1h 05m');
  });

  it('formats rupee amounts without fractional digits', () => {
    expect(formatPostCallCurrency(createInrMoney(12_300))).toBe('₹123');
    expect(formatPostCallCurrency(createInrMoney(50_000))).toBe('₹500');
  });

  it('filters call history into voice, voice-video, and failed groups', () => {
    const voiceVideo = applyPostCallHistoryFilter(
      seededPostCallRecords,
      'voice-video',
    );
    const voiceOnly = applyPostCallHistoryFilter(
      seededPostCallRecords,
      'voice',
    );
    const failed = applyPostCallHistoryFilter(seededPostCallRecords, 'failed');

    expect(voiceVideo.length).toBeGreaterThan(0);
    expect(voiceVideo.every((record) => record.videoDurationSeconds > 0)).toBe(
      true,
    );
    expect(
      voiceOnly.every(
        (record) =>
          record.connectedDurationSeconds > 0 &&
          record.videoDurationSeconds === 0,
      ),
    ).toBe(true);
    expect(
      failed.every((record) => record.connectedDurationSeconds === 0),
    ).toBe(true);
  });
});
