import { z } from 'zod';

import {
  customerGenderSchema,
  languageSchema,
  type Money,
  type Report,
} from '@connecto/domain';

import { appRoutes } from '@/navigation/routes';

export const customerNotificationCategorySchema = z.enum([
  'payment',
  'call',
  'safety',
  'referral',
  'support',
]);
export type CustomerNotificationCategory = z.infer<
  typeof customerNotificationCategorySchema
>;

export const customerNotificationDestinationSchema = z.enum([
  'wallet',
  'calls',
  'profile',
  'referrals',
  'support',
  'support-ticket',
  'privacy-safety',
  'report-history',
]);
export type CustomerNotificationDestination = z.infer<
  typeof customerNotificationDestinationSchema
>;

export const customerNotificationTargetRouteIdSchema = z.enum([
  'customerAddMoney',
  'customerCalls',
  'customerProfile',
  'customerReferrals',
  'customerSupport',
  'customerSupportTicket',
  'customerPrivacySafety',
  'customerReportHistory',
]);
export type CustomerNotificationTargetRouteId = z.infer<
  typeof customerNotificationTargetRouteIdSchema
>;

export const customerNotificationFeedItemSchema = z.object({
  body: z.string().min(1),
  category: customerNotificationCategorySchema,
  createdAtIso: z.iso.datetime(),
  customerId: z.string().min(1),
  destination: customerNotificationDestinationSchema,
  id: z.string().min(1),
  readAtIso: z.iso.datetime().nullable(),
  source: z.enum(['domain', 'local']),
  targetParams: z.record(z.string(), z.string()).default({}),
  targetRouteId: customerNotificationTargetRouteIdSchema,
  title: z.string().min(1),
});
export type CustomerNotificationFeedItem = z.infer<
  typeof customerNotificationFeedItemSchema
>;

export const notificationPreferencesSchema = z.object({
  call: z.boolean(),
  payment: z.boolean(),
  referral: z.boolean(),
  safety: z.boolean(),
  support: z.boolean(),
});
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

export const defaultNotificationPreferences: NotificationPreferences = {
  call: true,
  payment: true,
  referral: true,
  safety: true,
  support: true,
};

export const customerSupportCategorySchema = z.enum([
  'account',
  'notifications',
  'payments',
  'safety',
  'technical',
]);
export type CustomerSupportCategory = z.infer<
  typeof customerSupportCategorySchema
>;

export const customerSupportTicketStatusSchema = z.enum([
  'closed',
  'open',
  'waiting-on-support',
  'waiting-on-user',
]);
export type CustomerSupportTicketStatus = z.infer<
  typeof customerSupportTicketStatusSchema
>;

export const customerSupportAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
  capturedAtIso: z.iso.datetime(),
  fileName: z.string().min(1),
  height: z.number().int().positive(),
  sizeLabel: z.string().min(1),
  uri: z.string().min(1),
  width: z.number().int().positive(),
});
export type CustomerSupportAttachment = z.infer<
  typeof customerSupportAttachmentSchema
>;

export const customerSupportDraftSchema = z.object({
  attachments: customerSupportAttachmentSchema.array(),
  body: z.string(),
  category: customerSupportCategorySchema,
  linkedCallId: z.string().min(1).nullable(),
  subject: z.string(),
});
export type CustomerSupportDraft = z.infer<typeof customerSupportDraftSchema>;

export const defaultCustomerSupportDraft: CustomerSupportDraft = {
  attachments: [],
  body: '',
  category: 'technical',
  linkedCallId: null,
  subject: '',
};

export const customerSupportTicketSchema = z.object({
  attachments: customerSupportAttachmentSchema.array(),
  body: z.string().min(1),
  category: customerSupportCategorySchema,
  createdAtIso: z.iso.datetime(),
  id: z.string().min(1),
  linkedCallId: z.string().min(1).nullable(),
  requesterId: z.string().min(1),
  source: z.enum(['account', 'post-call']),
  status: customerSupportTicketStatusSchema,
  subject: z.string().min(1),
  ticketReference: z.string().min(1),
  updatedAtIso: z.iso.datetime(),
});
export type CustomerSupportTicket = z.infer<typeof customerSupportTicketSchema>;

export const blockedHostSummarySchema = z.object({
  availability: z.string().min(1),
  displayName: z.string().min(1),
  hostId: z.string().min(1),
  language: languageSchema,
  rank: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
});
export type BlockedHostSummary = z.infer<typeof blockedHostSummarySchema>;

export const deleteAccountBlockReasonSchema = z.enum(['wallet-balance']);
export type DeleteAccountBlockReason = z.infer<
  typeof deleteAccountBlockReasonSchema
>;

export const deleteAccountRequestSchema = z.object({
  id: z.string().min(1),
  requestedAtIso: z.iso.datetime(),
  status: z.literal('pending'),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

export const deleteAccountStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('eligible'),
  }),
  z.object({
    reasons: deleteAccountBlockReasonSchema.array().min(1),
    status: z.literal('blocked'),
  }),
  z.object({
    request: deleteAccountRequestSchema,
    status: z.literal('pending'),
  }),
]);
export type DeleteAccountState = z.infer<typeof deleteAccountStateSchema>;

export const customerAccountPersistedStateSchema = z.object({
  deleteAccountRequest: deleteAccountRequestSchema.nullable(),
  localNotifications: customerNotificationFeedItemSchema
    .array()
    .refine(
      (items) => items.every((item) => item.source === 'local'),
      'Only local notifications can be persisted in account state.',
    ),
  notificationPreferences: notificationPreferencesSchema,
  supportDraft: customerSupportDraftSchema.nullable(),
  supportTickets: customerSupportTicketSchema
    .array()
    .refine(
      (items) => items.every((item) => item.source === 'account'),
      'Only account tickets can be persisted in account state.',
    ),
  version: z.literal(1),
});
export type CustomerAccountPersistedState = z.infer<
  typeof customerAccountPersistedStateSchema
>;

export const initialCustomerAccountState: CustomerAccountPersistedState = {
  deleteAccountRequest: null,
  localNotifications: [],
  notificationPreferences: defaultNotificationPreferences,
  supportDraft: null,
  supportTickets: [],
  version: 1,
};

export const customerProfileFormSchema = z.object({
  dateOfBirthInput: z.string(),
  displayName: z.string(),
  gender: customerGenderSchema.nullable(),
  profileImageUri: z.string().min(1).nullable(),
});
export type CustomerProfileForm = z.infer<typeof customerProfileFormSchema>;

export const customerLanguageSelectionSchema = z.object({
  primaryLanguage: languageSchema,
  secondaryLanguage: languageSchema.nullable(),
});
export type CustomerLanguageSelection = z.infer<
  typeof customerLanguageSelectionSchema
>;

export const legalDocumentKeySchema = z.enum([
  'terms',
  'privacy',
  'community-guidelines',
]);
export type LegalDocumentKey = z.infer<typeof legalDocumentKeySchema>;

export type LegalDocument = {
  effectiveDateLabel: string;
  sections: readonly {
    body: readonly string[];
    title: string;
  }[];
  title: string;
  version: string;
};

export const customerLegalDocuments = {
  'community-guidelines': {
    effectiveDateLabel: 'Effective July 17, 2026',
    sections: [
      {
        body: [
          'Treat hosts, customers, and support staff respectfully. Harassment, hate speech, or coercive behaviour can lead to suspension or account review.',
          'Do not pressure anyone to move a conversation off-platform before both sides are comfortable and the service explicitly allows it.',
        ],
        title: 'Respectful conduct',
      },
      {
        body: [
          'Use the report flows whenever behaviour feels unsafe, deceptive, or abusive. Reports help our review teams preserve local evidence metadata and follow up without interrupting every call.',
          'Blocking a host hides them from discovery on this device, but it does not by itself close an open safety review.',
        ],
        title: 'Safety expectations',
      },
      {
        body: [
          'Reward and wallet messaging always stays subject to verification. Never promise cashbacks, credits, or referrals to another user unless the product surface says the reward was released.',
          'Attempts to manipulate wallet balances, invite rewards, or support outcomes may trigger manual review.',
        ],
        title: 'Payments and abuse prevention',
      },
    ],
    title: 'Community Guidelines',
    version: 'CG-2026.07',
  },
  privacy: {
    effectiveDateLabel: 'Effective July 17, 2026',
    sections: [
      {
        body: [
          'Profile details, preferences, support drafts, and call-history mocks are stored only to make the app usable across restarts in this frontend-only stage.',
          'Sensitive mock session state is stored through SecureStore-compatible persistence rather than plain text local storage.',
        ],
        title: 'What this app stores',
      },
      {
        body: [
          'Notification, image, microphone, and camera permissions are requested only when the surrounding product context explains why the permission matters.',
          'Camera and microphone remain just-in-time permissions for call use rather than mandatory onboarding gates.',
        ],
        title: 'Permissions and device access',
      },
      {
        body: [
          'Support attachments in this stage keep only metadata such as filename, size, and local mock URI. Media bytes are not uploaded to a backend service here.',
          'Delete-account requests stay pending when unresolved wallet state exists so customers do not lose track of value.',
        ],
        title: 'Retention and account requests',
      },
    ],
    title: 'Privacy Policy',
    version: 'PP-2026.07',
  },
  terms: {
    effectiveDateLabel: 'Effective July 17, 2026',
    sections: [
      {
        body: [
          'You must be at least 18 years old to use Connecto. Account access remains subject to ongoing compliance, safety, and payment review.',
          'Suspended or blocked accounts may continue to access legal and support surfaces where the routing policy allows it.',
        ],
        title: 'Eligibility and access',
      },
      {
        body: [
          'Wallet top-ups and referral rewards are not final until verification succeeds. Frontend callbacks alone do not create spendable value.',
          'Connected voice and video time, not decorative loading states, determine pricing and unlock rules in the customer experience.',
        ],
        title: 'Billing and verification',
      },
      {
        body: [
          'You are responsible for keeping profile information current and for using report and block tools honestly.',
          'We may limit, suspend, or review accounts when behaviour, payment state, or safety signals require intervention.',
        ],
        title: 'Customer responsibilities',
      },
    ],
    title: 'Terms of Service',
    version: 'TOS-2026.07',
  },
} as const satisfies Record<LegalDocumentKey, LegalDocument>;

export const seededCustomerLocalNotifications =
  customerNotificationFeedItemSchema.array().parse([
    {
      body: 'Your add-money verification is complete. Open Add Money to review the updated balance and transactions.',
      category: 'payment',
      createdAtIso: '2026-07-17T08:05:00.000Z',
      customerId: 'customer_1',
      destination: 'wallet',
      id: 'local_notification_payment_1',
      readAtIso: null,
      source: 'local',
      targetParams: {},
      targetRouteId: 'customerAddMoney',
      title: 'Wallet top-up verified',
    },
    {
      body: 'Invite qualification is progressing. The reward will release only after verification.',
      category: 'referral',
      createdAtIso: '2026-07-17T07:00:00.000Z',
      customerId: 'customer_1',
      destination: 'referrals',
      id: 'local_notification_referral_1',
      readAtIso: '2026-07-17T07:10:00.000Z',
      source: 'local',
      targetParams: {},
      targetRouteId: 'customerReferrals',
      title: 'Referral qualification update',
    },
    {
      body: 'Support asked for one more detail on your latest issue. Reply from the ticket if you want review to continue faster.',
      category: 'support',
      createdAtIso: '2026-07-17T06:30:00.000Z',
      customerId: 'customer_1',
      destination: 'support',
      id: 'local_notification_support_1',
      readAtIso: null,
      source: 'local',
      targetParams: {},
      targetRouteId: 'customerSupport',
      title: 'Support follow-up ready',
    },
    {
      body: 'A recent safety report is still being reviewed. You can see current status from Privacy & Safety.',
      category: 'safety',
      createdAtIso: '2026-07-17T05:55:00.000Z',
      customerId: 'customer_1',
      destination: 'privacy-safety',
      id: 'local_notification_safety_1',
      readAtIso: null,
      source: 'local',
      targetParams: {},
      targetRouteId: 'customerPrivacySafety',
      title: 'Safety review active',
    },
  ]);

const longDateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatCustomerDateTime = (iso: string) =>
  longDateFormatter.format(new Date(iso));

export const resolveNotificationCategoryLabel = (
  category: CustomerNotificationCategory,
) =>
  ({
    call: 'Call',
    payment: 'Payment',
    referral: 'Referral',
    safety: 'Safety',
    support: 'Support',
  })[category];

export const resolveSupportCategoryLabel = (
  category: CustomerSupportCategory,
) =>
  ({
    account: 'Account access',
    notifications: 'Notifications',
    payments: 'Payments',
    safety: 'Safety',
    technical: 'Technical',
  })[category];

export const resolveDeleteAccountReasonLabel = (balance?: Money) => {
  return balance === undefined
    ? 'Withdraw or spend your wallet balance before requesting deletion.'
    : 'Wallet balance must be cleared before deletion. Current balance remains in your wallet.';
};

export const resolveReportKindLabel = (kind: Report['kind']) =>
  ({
    call: 'Call report',
    content: 'Content report',
    host: 'Host report',
    payment: 'Payment report',
    user: 'User report',
  })[kind];

export const resolveReportStatusLabel = (status: Report['status']) =>
  ({
    dismissed: 'Dismissed',
    open: 'Open',
    resolved: 'Resolved',
    reviewing: 'Reviewing',
  })[status];

export const resolveNotificationTarget = (
  item: Pick<CustomerNotificationFeedItem, 'targetParams' | 'targetRouteId'>,
) => {
  if (item.targetRouteId === 'customerSupportTicket') {
    const ticketId = item.targetParams.ticketId;

    if (ticketId !== undefined) {
      return {
        params: { ticketId },
        pathname: appRoutes.customerSupportTicket.path,
      };
    }
  }

  return appRoutes[item.targetRouteId].path;
};

export const buildNotificationDeepLink = (
  item: Pick<
    CustomerNotificationFeedItem,
    'destination' | 'id' | 'targetParams'
  >,
) => {
  const query = new URLSearchParams({
    notificationId: item.id,
    ...item.targetParams,
  });

  return `/link/notification/${item.destination}?${query.toString()}`;
};

export const resolveNotificationLinkTarget = ({
  destination,
  params,
}: {
  destination: string;
  params: Record<string, string | undefined>;
}) => {
  switch (destination) {
    case 'wallet':
      return appRoutes.customerAddMoney.path;
    case 'calls':
      return appRoutes.customerCalls.path;
    case 'profile':
      return appRoutes.customerProfile.path;
    case 'referrals':
      return appRoutes.customerReferrals.path;
    case 'support': {
      const ticketId = params.ticketId;

      if (ticketId !== undefined) {
        return {
          params: { ticketId },
          pathname: appRoutes.customerSupportTicket.path,
        };
      }

      return appRoutes.customerSupport.path;
    }
    case 'support-ticket': {
      const ticketId = params.ticketId;

      return ticketId === undefined
        ? null
        : {
            params: { ticketId },
            pathname: appRoutes.customerSupportTicket.path,
          };
    }
    case 'privacy-safety':
      return appRoutes.customerPrivacySafety.path;
    case 'report-history':
      return appRoutes.customerReportHistory.path;
    default:
      return null;
  }
};

export const buildDeleteAccountState = (input: {
  request: DeleteAccountRequest | null;
  walletBalanceAmountPaise: number;
}): DeleteAccountState => {
  if (input.request !== null) {
    return {
      request: input.request,
      status: 'pending',
    };
  }

  const reasons: DeleteAccountBlockReason[] = [];

  if (input.walletBalanceAmountPaise > 0) {
    reasons.push('wallet-balance');
  }

  if (reasons.length > 0) {
    return {
      reasons,
      status: 'blocked',
    };
  }

  return {
    status: 'eligible',
  };
};
