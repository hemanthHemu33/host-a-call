import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { frontendServices } from '@/services/adapters';

import {
  callReportAdapter,
  clearCallReportDraft,
  createCallReportDraft,
  loadCallReportDraft,
  parseCallReportRouteParams,
  parseCallSummaryRouteParams,
  persistCallReportDraft,
  type CallReportDraft,
} from './call-safety';

const draft = (): CallReportDraft =>
  createCallReportDraft({
    callId: 'call_1',
    connectedDurationMs: 65_000,
    customerId: 'customer_1',
    hostId: 'host_anjali',
    hostName: 'Anjali',
    mediaMode: 'voice',
    remainingBalancePaise: 1_200,
    sessionId: 'session_1',
  });

describe('call safety adapters', () => {
  beforeEach(async () => {
    await clearCallReportDraft();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearCallReportDraft();
  });

  it('submits reports idempotently for the same draft key', async () => {
    const reportDraft = {
      ...draft(),
      category: 'safety-concern' as const,
      comments: 'Unsafe pressure during the call.',
      idempotencyKey: 'idempotent-key',
    };
    const createReport = vi
      .spyOn(frontendServices.report, 'createReport')
      .mockResolvedValue({
        createdAtIso: '2026-07-17T10:00:00.000Z',
        description: 'Report body',
        id: 'report_1',
        kind: 'call',
        reporterId: 'customer_1',
        status: 'open',
        targetId: 'host_anjali',
      });

    const [first, second] = await Promise.all([
      callReportAdapter.submitReport({
        draft: reportDraft,
        reporterId: 'customer_1',
      }),
      callReportAdapter.submitReport({
        draft: reportDraft,
        reporterId: 'customer_1',
      }),
    ]);

    expect(createReport).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('retains the persisted evidence draft when submission fails', async () => {
    const reportDraft = {
      ...draft(),
      category: 'quality-or-technical' as const,
      comments: 'Remote voice kept dropping in and out.',
      idempotencyKey: 'failing-key',
    };

    await persistCallReportDraft(reportDraft);
    vi.spyOn(frontendServices.report, 'createReport').mockRejectedValue(
      new Error('Offline'),
    );

    await expect(
      callReportAdapter.submitReport({
        draft: reportDraft,
        reporterId: 'customer_1',
      }),
    ).rejects.toThrow('Offline');

    await expect(loadCallReportDraft()).resolves.toEqual(reportDraft);
  });
});

describe('call route params', () => {
  it('falls back instead of throwing for malformed summary deep-link params', () => {
    expect(
      parseCallSummaryRouteParams({
        callId: '',
        connectedDurationMs: 'invalid',
        endedAtIso: 'not-a-date',
        hostId: '',
        hostName: '',
        mediaMode: 'unknown',
        reason: 'customer-ended',
        remainingBalancePaise: 'invalid',
        sessionId: '',
        videoDurationMs: 'invalid',
      }),
    ).toEqual({
      callId: undefined,
      connectedDurationMs: 0,
      endedAtIso: undefined,
      hostId: undefined,
      hostName: undefined,
      mediaMode: 'voice',
      reason: undefined,
      remainingBalancePaise: 0,
      sessionId: undefined,
      videoDurationMs: 0,
    });
  });

  it('falls back instead of throwing for malformed report deep-link params', () => {
    expect(
      parseCallReportRouteParams({
        callId: '',
        connectedDurationMs: 'invalid',
        hostId: '',
        hostName: '',
        mediaMode: 'unknown',
        remainingBalancePaise: 'invalid',
        sessionId: '',
      }),
    ).toEqual({
      callId: undefined,
      connectedDurationMs: 0,
      hostId: undefined,
      hostName: undefined,
      mediaMode: 'voice',
      remainingBalancePaise: 0,
      sessionId: undefined,
    });
  });
});
