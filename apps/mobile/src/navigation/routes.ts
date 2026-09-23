import type { Role } from '@connecto/domain';

export type MobileRole = Exclude<Role, 'admin'>;

type BackPolicy =
  'exit-app' | 'previous' | 'root' | 'restore-last-safe' | 'dismiss-modal';

type RouteAccess =
  { kind: 'public' } | { kind: 'authenticated'; roles: readonly MobileRole[] };

export type AppRouteId =
  | 'index'
  | 'bootstrap'
  | 'mandatoryUpdate'
  | 'notFound'
  | 'invalidLink'
  | 'layoutQa'
  | 'motionLab'
  | 'animationLab'
  | 'componentGallery'
  | 'developerScenarios'
  | 'tokenGallery'
  | 'authAgeConfirmation'
  | 'authBlockedAccount'
  | 'authLogin'
  | 'authOtp'
  | 'authReferralCode'
  | 'authSuspendedAccount'
  | 'authUnderageBlock'
  | 'customerOnboardingProfile'
  | 'customerOnboardingLanguage'
  | 'customerOnboardingMatchTags'
  | 'customerOnboardingPermissions'
  | 'customerOnboardingVoiceVerification'
  | 'customerOnboardingHostApproval'
  | 'customerOnboardingHostAgreement'
  | 'customerHome'
  | 'customerCalls'
  | 'customerCallDetail'
  | 'customerProfile'
  | 'customerProfileEdit'
  | 'customerSettings'
  | 'customerLanguageSettings'
  | 'customerMotionSettings'
  | 'customerNotifications'
  | 'customerNotificationPreferences'
  | 'customerPrivacySafety'
  | 'customerBlockedUsers'
  | 'customerReportHistory'
  | 'customerDeleteAccount'
  | 'customerFilters'
  | 'customerAddMoney'
  | 'customerPaymentStates'
  | 'customerReferrals'
  | 'customerReferralDetail'
  | 'customerSupport'
  | 'customerSupportTicket'
  | 'customerTransactionDetail'
  | 'hostOnboardingProfile'
  | 'hostOnboardingPhoto'
  | 'hostOnboardingRules'
  | 'hostOnboardingVerification'
  | 'hostOnboardingPayout'
  | 'hostOnboardingAgreement'
  | 'hostOnboardingApplicationStates'
  | 'hostDashboard'
  | 'hostCalls'
  | 'hostRecent'
  | 'hostEarnings'
  | 'hostWithdrawal'
  | 'hostProfile'
  | 'hostProfileEdit'
  | 'hostBankAccountAdd'
  | 'hostReferrals'
  | 'hostSettings'
  | 'hostLeaderboard'
  | 'callIncoming'
  | 'callOutgoing'
  | 'callVoice'
  | 'callVideoRequest'
  | 'callVideo'
  | 'callReconnecting'
  | 'callReport'
  | 'callSummary'
  | 'legalTerms'
  | 'legalPrivacy'
  | 'legalCommunityGuidelines'
  | 'accountStatus'
  | 'linkReferral'
  | 'linkSupportTicket'
  | 'linkPaymentResult'
  | 'linkNotification'
  | 'linkCallInvitation';

export const internalOnlyRouteIds = [
  'animationLab',
  'componentGallery',
  'developerScenarios',
  'layoutQa',
  'motionLab',
  'tokenGallery',
] as const satisfies readonly AppRouteId[];

export const isInternalOnlyRoute = (routeId: AppRouteId) =>
  internalOnlyRouteIds.includes(
    routeId as (typeof internalOnlyRouteIds)[number],
  );

export const isRouteAvailableInEnvironment = (
  routeId: AppRouteId,
  environment: 'development' | 'preview' | 'production',
) => environment !== 'production' || !isInternalOnlyRoute(routeId);

type RouteDefinitionBase = {
  access: RouteAccess;
  allowLoggedOutDeepLink: boolean;
  backPolicy: BackPolicy;
  id: AppRouteId;
  path: string;
  title: string;
};

const publicAccess = { kind: 'public' } satisfies RouteAccess;
const customerAccess = {
  kind: 'authenticated',
  roles: ['customer'],
} satisfies RouteAccess;
const hostAccess = {
  kind: 'authenticated',
  roles: ['host'],
} satisfies RouteAccess;
const callAccess = {
  kind: 'authenticated',
  roles: ['customer', 'host'],
} satisfies RouteAccess;

export const appRoutes = {
  accountStatus: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'accountStatus',
    path: '/account-status',
    title: 'Account status',
  },
  authAgeConfirmation: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'authAgeConfirmation',
    path: '/(auth)/age-confirmation',
    title: 'Age confirmation',
  },
  authBlockedAccount: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'authBlockedAccount',
    path: '/(auth)/blocked-account',
    title: 'Blocked account',
  },
  animationLab: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'animationLab',
    path: '/animation-lab',
    title: 'Animation lab',
  },
  authLogin: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'authLogin',
    path: '/(auth)/login',
    title: 'Login',
  },
  authOtp: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'authOtp',
    path: '/(auth)/otp',
    title: 'OTP',
  },
  authReferralCode: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'authReferralCode',
    path: '/(auth)/referral-code',
    title: 'Referral code',
  },
  authSuspendedAccount: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'authSuspendedAccount',
    path: '/(auth)/suspended-account',
    title: 'Suspended account',
  },
  authUnderageBlock: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'authUnderageBlock',
    path: '/(auth)/underage-block',
    title: 'Underage access blocked',
  },
  bootstrap: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'bootstrap',
    path: '/bootstrap',
    title: 'Bootstrap',
  },
  callOutgoing: {
    access: callAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'restore-last-safe',
    id: 'callOutgoing',
    path: '/call/outgoing',
    title: 'Outgoing call',
  },
  callIncoming: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'restore-last-safe',
    id: 'callIncoming',
    path: '/call/incoming',
    title: 'Incoming call',
  },
  callReconnecting: {
    access: callAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'restore-last-safe',
    id: 'callReconnecting',
    path: '/call/reconnecting',
    title: 'Reconnecting',
  },
  callReport: {
    access: callAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'callReport',
    path: '/call/report',
    title: 'Report call',
  },
  callSummary: {
    access: callAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'restore-last-safe',
    id: 'callSummary',
    path: '/call/summary',
    title: 'Call summary',
  },
  callVideo: {
    access: callAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'restore-last-safe',
    id: 'callVideo',
    path: '/call/video',
    title: 'Video call',
  },
  callVideoRequest: {
    access: callAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'callVideoRequest',
    path: '/call/video-request',
    title: 'Video request',
  },
  callVoice: {
    access: callAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'restore-last-safe',
    id: 'callVoice',
    path: '/call/voice',
    title: 'Voice call',
  },
  componentGallery: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'componentGallery',
    path: '/component-gallery',
    title: 'Component gallery',
  },
  developerScenarios: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'developerScenarios',
    path: '/developer-scenarios',
    title: 'Developer scenarios',
  },
  customerAddMoney: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'dismiss-modal',
    id: 'customerAddMoney',
    path: '/(customer)/add-money',
    title: 'Add money',
  },
  customerCalls: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'root',
    id: 'customerCalls',
    path: '/(customer)/calls',
    title: 'Customer calls',
  },
  customerCallDetail: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerCallDetail',
    path: '/(customer)/calls/[callId]',
    title: 'Call detail',
  },
  customerFilters: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'dismiss-modal',
    id: 'customerFilters',
    path: '/(customer)/filters',
    title: 'Filters',
  },
  customerHome: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'exit-app',
    id: 'customerHome',
    path: '/(customer)/home',
    title: 'Customer home',
  },
  customerOnboardingLanguage: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerOnboardingLanguage',
    path: '/(customer-onboarding)/language',
    title: 'Language',
  },
  customerOnboardingMatchTags: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerOnboardingMatchTags',
    path: '/(customer-onboarding)/match-tags',
    title: 'Match tags',
  },
  customerOnboardingPermissions: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerOnboardingPermissions',
    path: '/(customer-onboarding)/permissions',
    title: 'Permissions',
  },
  customerOnboardingVoiceVerification: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerOnboardingVoiceVerification',
    path: '/(customer-onboarding)/voice-verification',
    title: 'Voice verification',
  },
  customerOnboardingHostApproval: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'restore-last-safe',
    id: 'customerOnboardingHostApproval',
    path: '/(customer-onboarding)/host-approval',
    title: 'Host approval',
  },
  customerOnboardingHostAgreement: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerOnboardingHostAgreement',
    path: '/(customer-onboarding)/host-agreement',
    title: 'Host agreement',
  },
  customerOnboardingProfile: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerOnboardingProfile',
    path: '/(customer-onboarding)/profile-setup',
    title: 'Customer profile setup',
  },
  customerPaymentStates: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'restore-last-safe',
    id: 'customerPaymentStates',
    path: '/(customer)/payment-states',
    title: 'Payment state',
  },
  customerProfile: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'root',
    id: 'customerProfile',
    path: '/(customer)/profile',
    title: 'Customer profile',
  },
  customerProfileEdit: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerProfileEdit',
    path: '/(customer)/profile-edit',
    title: 'Edit customer profile',
  },
  customerSettings: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerSettings',
    path: '/(customer)/settings',
    title: 'Settings',
  },
  customerLanguageSettings: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerLanguageSettings',
    path: '/(customer)/language-settings',
    title: 'Language settings',
  },
  customerMotionSettings: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerMotionSettings',
    path: '/(customer)/motion-settings',
    title: 'Motion settings',
  },
  customerNotifications: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'customerNotifications',
    path: '/(customer)/notifications',
    title: 'Notifications',
  },
  customerNotificationPreferences: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerNotificationPreferences',
    path: '/(customer)/notification-preferences',
    title: 'Notification preferences',
  },
  customerPrivacySafety: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerPrivacySafety',
    path: '/(customer)/privacy-safety',
    title: 'Privacy and safety',
  },
  customerBlockedUsers: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerBlockedUsers',
    path: '/(customer)/blocked-users',
    title: 'Blocked hosts',
  },
  customerReportHistory: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerReportHistory',
    path: '/(customer)/report-history',
    title: 'Report history',
  },
  customerDeleteAccount: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerDeleteAccount',
    path: '/(customer)/delete-account',
    title: 'Delete account',
  },
  customerReferrals: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'customerReferrals',
    path: '/(customer)/referrals',
    title: 'Referrals',
  },
  customerReferralDetail: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'customerReferralDetail',
    path: '/(customer)/referrals/[referralId]',
    title: 'Referral detail',
  },
  customerSupport: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'customerSupport',
    path: '/(customer)/support',
    title: 'Support',
  },
  customerSupportTicket: {
    access: customerAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'customerSupportTicket',
    path: '/(customer)/support-ticket/[ticketId]',
    title: 'Support ticket',
  },
  customerTransactionDetail: {
    access: customerAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'customerTransactionDetail',
    path: '/(customer)/transaction/[transactionId]',
    title: 'Transaction detail',
  },
  hostCalls: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'root',
    id: 'hostCalls',
    path: '/(host)/calls',
    title: 'Host calls',
  },
  hostDashboard: {
    access: hostAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'exit-app',
    id: 'hostDashboard',
    path: '/(host)/dashboard',
    title: 'Host dashboard',
  },
  hostRecent: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'root',
    id: 'hostRecent',
    path: '/(host)/recent',
    title: 'Recent',
  },
  hostEarnings: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'root',
    id: 'hostEarnings',
    path: '/(host)/earnings',
    title: 'Earnings',
  },
  hostWithdrawal: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostWithdrawal',
    path: '/(host)/withdrawal',
    title: 'Withdrawal',
  },
  hostLeaderboard: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostLeaderboard',
    path: '/(host)/leaderboard',
    title: 'Leaderboard',
  },
  hostOnboardingAgreement: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostOnboardingAgreement',
    path: '/(host-onboarding)/agreement',
    title: 'Host agreement',
  },
  hostOnboardingApplicationStates: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'restore-last-safe',
    id: 'hostOnboardingApplicationStates',
    path: '/(host-onboarding)/application-states',
    title: 'Application status',
  },
  hostOnboardingPayout: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostOnboardingPayout',
    path: '/(host-onboarding)/payout',
    title: 'Payout',
  },
  hostOnboardingPhoto: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostOnboardingPhoto',
    path: '/(host-onboarding)/photo',
    title: 'Host photo',
  },
  hostOnboardingProfile: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostOnboardingProfile',
    path: '/(host-onboarding)/host-profile-setup',
    title: 'Host profile setup',
  },
  hostOnboardingRules: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostOnboardingRules',
    path: '/(host-onboarding)/rules',
    title: 'Host rules',
  },
  hostOnboardingVerification: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostOnboardingVerification',
    path: '/(host-onboarding)/verification',
    title: 'Verification',
  },
  hostProfile: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'root',
    id: 'hostProfile',
    path: '/(host)/profile',
    title: 'Host profile',
  },
  hostProfileEdit: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostProfileEdit',
    path: '/(host)/profile-edit',
    title: 'Edit profile',
  },
  hostBankAccountAdd: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostBankAccountAdd',
    path: '/(host)/bank-account-add',
    title: 'Add bank account',
  },
  hostReferrals: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostReferrals',
    path: '/(host)/referrals',
    title: 'Referrals',
  },
  hostSettings: {
    access: hostAccess,
    allowLoggedOutDeepLink: false,
    backPolicy: 'previous',
    id: 'hostSettings',
    path: '/(host)/settings',
    title: 'Settings',
  },
  index: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'exit-app',
    id: 'index',
    path: '/',
    title: 'Splash',
  },
  invalidLink: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'invalidLink',
    path: '/invalid-link',
    title: 'Invalid link',
  },
  layoutQa: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'layoutQa',
    path: '/layout-qa',
    title: 'Layout QA',
  },
  motionLab: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'motionLab',
    path: '/motion-lab',
    title: 'Motion lab',
  },
  legalPrivacy: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'legalPrivacy',
    path: '/legal/privacy',
    title: 'Privacy policy',
  },
  legalTerms: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'legalTerms',
    path: '/legal/terms',
    title: 'Terms',
  },
  legalCommunityGuidelines: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'legalCommunityGuidelines',
    path: '/legal/community-guidelines',
    title: 'Community Guidelines',
  },
  linkCallInvitation: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'restore-last-safe',
    id: 'linkCallInvitation',
    path: '/link/call-invitation/[invitationId]',
    title: 'Call invitation',
  },
  linkNotification: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'restore-last-safe',
    id: 'linkNotification',
    path: '/link/notification/[destination]',
    title: 'Notification',
  },
  linkPaymentResult: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'restore-last-safe',
    id: 'linkPaymentResult',
    path: '/link/payment-result',
    title: 'Payment result link',
  },
  linkReferral: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'linkReferral',
    path: '/referral/[code]',
    title: 'Referral link',
  },
  linkSupportTicket: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'restore-last-safe',
    id: 'linkSupportTicket',
    path: '/link/support-ticket/[ticketId]',
    title: 'Support ticket link',
  },
  mandatoryUpdate: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'mandatoryUpdate',
    path: '/mandatory-update',
    title: 'Mandatory update',
  },
  notFound: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'root',
    id: 'notFound',
    path: '/+not-found',
    title: 'Not found',
  },
  tokenGallery: {
    access: publicAccess,
    allowLoggedOutDeepLink: true,
    backPolicy: 'previous',
    id: 'tokenGallery',
    path: '/token-gallery',
    title: 'Token gallery',
  },
} as const satisfies Record<AppRouteId, RouteDefinitionBase>;

const routeDefinitions = Object.values(appRoutes);
export type RouteDefinition = (typeof appRoutes)[AppRouteId];
export type AppRoutePath = RouteDefinition['path'];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dynamicRoutePatterns = routeDefinitions.map((route) => ({
  definition: route,
  pattern: new RegExp(
    `^${escapeRegExp(route.path).replace(/\\\/\\\[[^\]]+\\\]/g, '/[^/]+')}$`,
  ),
}));

export const getRouteDefinition = (
  pathname: string,
): RouteDefinition | undefined =>
  routeDefinitions.find((route) => route.path === pathname) ??
  dynamicRoutePatterns.find(({ pattern }) => pattern.test(pathname))
    ?.definition;
