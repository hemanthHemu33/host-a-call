import {
  fixtureCompletedCallRecord,
  fixtureCustomer,
  fixtureHosts,
  fixtureMoney,
  fixtureSupportTickets,
  fixtureWallet,
} from '@connecto/domain';

import {
  createInrMoney,
  createPostCallChargeBreakdown,
  derivePostCallMediaSummary,
  postCallPersistedStateSchema,
  postCallRecordSchema,
  postCallSupportTicketSchema,
  type PostCallPersistedState,
  type PostCallRecord,
  type PostCallSupportTicket,
} from './post-call.models';

const buildFinalizedRecord = (input: {
  callId: string;
  connectedDurationSeconds: number;
  endReason: PostCallRecord['endReason'];
  endedAtIso: string;
  hostAge: number;
  hostAvatarUri?: string;
  hostId: string;
  hostName: string;
  hostPrimaryLanguage: string;
  hostRank: PostCallRecord['hostRank'];
  linkedSupportTicketId?: string | null;
  rating?: PostCallRecord['rating'];
  remainingBalancePaise: number;
  sessionId?: string | null;
  startedAtIso: string;
  videoDurationSeconds: number;
  videoRatePaise: number;
  voiceDurationSeconds: number;
  voiceRatePaise: number;
}) => {
  const chargeBreakdown = createPostCallChargeBreakdown({
    minimumChargePaise: fixtureMoney(500).amountPaise,
    videoDurationSeconds: input.videoDurationSeconds,
    videoRatePaise: input.videoRatePaise,
    voiceDurationSeconds: input.voiceDurationSeconds,
    voiceRatePaise: input.voiceRatePaise,
  });

  return postCallRecordSchema.parse({
    callId: input.callId,
    chargeBreakdown,
    connectedDurationSeconds: input.connectedDurationSeconds,
    customerId: fixtureCustomer.id,
    endReason: input.endReason,
    endedAtIso: input.endedAtIso,
    finalizationReadyAtIso: null,
    finalizationStatus: 'finalized',
    hostAge: input.hostAge,
    ...(input.hostAvatarUri === undefined
      ? {}
      : { hostAvatarUri: input.hostAvatarUri }),
    hostId: input.hostId,
    hostName: input.hostName,
    hostPrimaryLanguage: input.hostPrimaryLanguage,
    hostRank: input.hostRank,
    id: input.callId,
    linkedSupportTicketId: input.linkedSupportTicketId ?? null,
    mediaSummary: derivePostCallMediaSummary({
      connectedDurationSeconds: input.connectedDurationSeconds,
      videoDurationSeconds: input.videoDurationSeconds,
    }),
    priceSnapshot: {
      capturedAtIso: input.startedAtIso,
      minimumCharge: fixtureMoney(500),
      videoRate: createInrMoney(input.videoRatePaise),
      voiceRate: createInrMoney(input.voiceRatePaise),
    },
    rating: input.rating ?? null,
    sessionId: input.sessionId ?? null,
    startedAtIso: input.startedAtIso,
    verificationState: 'verified',
    videoDurationSeconds: input.videoDurationSeconds,
    voiceDurationSeconds: input.voiceDurationSeconds,
    walletBalanceAfter: createInrMoney(input.remainingBalancePaise),
  });
};

const transformedCompletedFixture = buildFinalizedRecord({
  callId: fixtureCompletedCallRecord.id,
  connectedDurationSeconds:
    fixtureCompletedCallRecord.timerSnapshot.connectedSeconds,
  endReason: 'customer-ended',
  endedAtIso: fixtureCompletedCallRecord.endedAtIso,
  hostAge: 25,
  hostId: fixtureCompletedCallRecord.host.id,
  hostName: fixtureCompletedCallRecord.host.displayName,
  hostPrimaryLanguage: 'Telugu',
  hostRank: fixtureCompletedCallRecord.hostRankSnapshot,
  linkedSupportTicketId: 'ticket_billing_1',
  rating: {
    comment: 'Helpful and calm throughout the call.',
    stars: 5,
    submittedAtIso: fixtureCompletedCallRecord.endedAtIso,
    tags: ['clear-audio', 'helpful'],
  },
  remainingBalancePaise: 14_000,
  sessionId: 'session_seed_001',
  startedAtIso: fixtureCompletedCallRecord.timerSnapshot.startedAtIso,
  videoDurationSeconds: 0,
  videoRatePaise:
    fixtureCompletedCallRecord.pricingSnapshot.videoUpgradeRate.amountPaise,
  voiceDurationSeconds:
    fixtureCompletedCallRecord.timerSnapshot.billableSeconds,
  voiceRatePaise:
    fixtureCompletedCallRecord.pricingSnapshot.perMinuteRate.amountPaise,
});

const generatedRecords = Array.from({ length: 13 }, (_, index) => {
  const host = fixtureHosts[index + 1] ?? fixtureHosts[0];
  const connectedDurationSeconds =
    index === 2 ? 0 : index === 10 ? 0 : 180 + index * 37;
  const videoDurationSeconds =
    connectedDurationSeconds === 0
      ? 0
      : index % 3 === 0
        ? 0
        : Math.min(connectedDurationSeconds - 45, 60 + index * 11);
  const voiceDurationSeconds = Math.max(
    0,
    connectedDurationSeconds - videoDurationSeconds,
  );
  const startedAt = new Date(
    `2026-07-${String(15 - Math.min(index, 9)).padStart(2, '0')}T${String(10 + (index % 8)).padStart(2, '0')}:00:00.000Z`,
  );
  const endedAt = new Date(
    startedAt.getTime() + connectedDurationSeconds * 1_000,
  );

  return buildFinalizedRecord({
    callId: `call_seed_${String(index + 2).padStart(3, '0')}`,
    connectedDurationSeconds,
    endReason:
      connectedDurationSeconds === 0
        ? index === 2
          ? 'no-answer'
          : 'rejected'
        : index === 5
          ? 'network-failed'
          : index === 8
            ? 'host-ended'
            : 'customer-ended',
    endedAtIso: endedAt.toISOString(),
    hostAge: host?.age ?? 24,
    hostAvatarUri: `mock://connecto/hosts/${host?.id ?? 'host'}/avatar`,
    hostId: host?.id ?? `host_seed_${String(index)}`,
    hostName: host?.displayName ?? `Host ${String(index + 1)}`,
    hostPrimaryLanguage: host?.language ?? 'English',
    hostRank: host?.rank ?? 'silver',
    linkedSupportTicketId: index === 5 ? 'ticket_seed_network' : null,
    rating:
      connectedDurationSeconds > 0 && index % 4 === 0
        ? {
            comment:
              index === 0
                ? 'Helpful and calm throughout the call.'
                : 'The host was clear and easy to follow.',
            stars: index === 8 ? 3 : 5,
            submittedAtIso: endedAt.toISOString(),
            tags:
              index === 8
                ? ['technical-issue', 'respectful']
                : ['clear-audio', 'helpful'],
          }
        : null,
    remainingBalancePaise: Math.max(
      0,
      fixtureWallet.balance.amountPaise -
        (18_000 + index * 950 + videoDurationSeconds * 7),
    ),
    sessionId: `session_seed_${String(index + 2).padStart(3, '0')}`,
    startedAtIso: startedAt.toISOString(),
    videoDurationSeconds,
    videoRatePaise: host?.videoRate.amountPaise ?? 1_600,
    voiceDurationSeconds,
    voiceRatePaise: host?.voiceRate.amountPaise ?? 1_000,
  });
});

const seededSupportTickets: PostCallSupportTicket[] = [
  postCallSupportTicketSchema.parse({
    category: 'billing',
    comments:
      'I need help understanding the final charge for this completed call.',
    createdAtIso: '2026-07-16T00:12:00.000Z',
    evidence: {
      attachmentId: 'attachment_billing_1',
      capturedAtIso: '2026-07-16T00:11:30.000Z',
      fileName: 'wallet-summary-1.png',
      height: 1280,
      uri: 'mock://connecto/evidence/wallet-summary-1.png',
      width: 720,
    },
    id: 'ticket_billing_1',
    issueSummary: 'Charge review for call_1',
    linkedCallId: transformedCompletedFixture.callId,
    requesterId: fixtureCustomer.id,
    status: 'waiting-on-support',
    ticketReference: 'SUP-4101',
    updatedAtIso: '2026-07-16T00:18:00.000Z',
  }),
  postCallSupportTicketSchema.parse({
    category: 'technical',
    comments: 'Need help understanding why an earlier ticket was closed.',
    createdAtIso:
      fixtureSupportTickets[0]?.createdAtIso ?? '2026-07-15T09:00:00.000Z',
    evidence: null,
    id: fixtureSupportTickets[0]?.id ?? 'ticket_1',
    issueSummary: fixtureSupportTickets[0]?.subject ?? 'Wallet balance issue',
    linkedCallId: null,
    requesterId: fixtureCustomer.id,
    status: fixtureSupportTickets[0]?.status ?? 'open',
    ticketReference: 'SUP-4001',
    updatedAtIso: '2026-07-16T08:30:00.000Z',
  }),
  postCallSupportTicketSchema.parse({
    category: 'technical',
    comments: 'The call disconnected during network recovery.',
    createdAtIso: '2026-07-12T11:40:00.000Z',
    evidence: null,
    id: 'ticket_seed_network',
    issueSummary: 'Network drop follow-up',
    linkedCallId: 'call_seed_007',
    requesterId: fixtureCustomer.id,
    status: 'open',
    ticketReference: 'SUP-4110',
    updatedAtIso: '2026-07-12T12:00:00.000Z',
  }),
];

export const seededPostCallRecords = [
  transformedCompletedFixture,
  ...generatedRecords.map((record) => {
    const linkedTicket = seededSupportTickets.find(
      (ticket) => ticket.linkedCallId === record.callId,
    );

    return postCallRecordSchema.parse({
      ...record,
      linkedSupportTicketId: linkedTicket?.id ?? record.linkedSupportTicketId,
    });
  }),
];

export const seededPostCallState: PostCallPersistedState =
  postCallPersistedStateSchema.parse({
    callRecords: seededPostCallRecords.map((record) => {
      const linkedTicket = seededSupportTickets.find(
        (ticket) => ticket.linkedCallId === record.callId,
      );

      return postCallRecordSchema.parse({
        ...record,
        linkedSupportTicketId: linkedTicket?.id ?? record.linkedSupportTicketId,
      });
    }),
    supportTickets: seededSupportTickets,
    version: 1,
  });
