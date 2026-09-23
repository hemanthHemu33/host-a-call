import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  FileQuestion,
  FileText,
  Gift,
  Languages as LanguagesIcon,
  LifeBuoy,
  LogOut,
  Mail,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import {
  normalizeApiError,
  queryKeys,
  type Customer,
  type CustomerProfileUpdate,
} from '@connecto/domain';

import {
  defaultCustomerAvatarUriForGender,
  getCustomerAvatarOptionsForGender,
  normalizeCustomerAvatarUri,
  resolveCustomerAvatarSource,
} from '@/assets/avatars/customer-avatars';
import {
  KeyboardScreen,
  ScrollScreen,
  useResponsiveLayout,
} from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { floatingTabBarBaseContentInset } from '@/components/ui/FloatingTabBar';
import {
  Banner,
  ConfirmationDialog,
  InlineError,
} from '@/components/ui/feedback';
import {
  RadioCard,
  SwitchRow,
  TextArea,
  TextField,
} from '@/components/ui/fields';
import { BackHeader, SectionHeader } from '@/components/ui/navigation';
import {
  Card,
  EmptyState,
  ErrorState,
  GlassSurface,
  LegalContent,
  Skeleton,
  StatusBadge,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import type { IconComponent } from '@/components/ui/types';
import { clearNavigationSession } from '@/navigation/navigation-store';
import { appRoutes } from '@/navigation/routes';
import { useHaptics, useMotion } from '@/motion/MotionProvider';
import type { MotionPreference } from '@/motion/types';
import {
  buildCustomerPreferredLanguages,
  customerOnboardingLanguageOptions,
} from '@/features/customer-onboarding/customer-onboarding.models';
import { mobileDataIds, useWalletQuery } from '@/features/data/mobileDataHooks';
import { persistAuthSnapshot } from '@/features/auth/auth.storage';
import { getAuthSnapshot } from '@/store/auth.store';
import { frontendServices } from '@/services/adapters';

import { customerAccountAdapter } from './customer-account.adapters';
import {
  customerLegalDocuments,
  defaultCustomerSupportDraft,
  formatCustomerDateTime,
  resolveDeleteAccountReasonLabel,
  resolveNotificationCategoryLabel,
  resolveNotificationLinkTarget,
  resolveNotificationTarget,
  resolveReportKindLabel,
  resolveReportStatusLabel,
  resolveSupportCategoryLabel,
  type CustomerNotificationCategory,
  type CustomerNotificationFeedItem,
  type CustomerProfileForm,
  type CustomerSupportAttachment,
  type CustomerSupportCategory,
  type CustomerSupportDraft,
  type LegalDocumentKey,
  type NotificationPreferences,
} from './customer-account.models';
import {
  useBlockedHostsQuery,
  useCreateSupportAttachmentMutation,
  useCustomerNotificationFeedQuery,
  useCustomerNotificationPreferencesQuery,
  useCustomerProfileSettingsQuery,
  useCustomerReportHistoryQuery,
  useCustomerSupportDraftQuery,
  useCustomerSupportTicketQuery,
  useCustomerSupportTicketsQuery,
  useDeleteAccountStateQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useRequestDeleteAccountMutation,
  useTriggerLocalNotificationPreviewMutation,
  useUnblockHostMutation,
  useUpdateNotificationPreferencesMutation,
  invalidateCustomerAccountQueries,
} from './customer-account.hooks';

const supportCategoryOptions = [
  {
    category: 'account',
    description: 'Login, profile, or account-state questions.',
  },
  {
    category: 'notifications',
    description: 'Push, alerts, and notification-routing issues.',
  },
  {
    category: 'payments',
    description: 'Wallet, add-money, and payment-verification questions.',
  },
  {
    category: 'safety',
    description: 'Safety-sensitive concerns or blocking follow-up.',
  },
  {
    category: 'technical',
    description: 'App, call, or device issues.',
  },
] as const satisfies readonly {
  category: CustomerSupportCategory;
  description: string;
}[];

const previewNotificationCategories = [
  'payment',
  'call',
  'support',
  'referral',
  'safety',
] as const satisfies readonly CustomerNotificationCategory[];

const motionPreferenceLabels = {
  full: 'Full motion',
  reduced: 'Reduce motion',
  system: 'Follow system',
} as const satisfies Record<MotionPreference, string>;

const motionPreferenceDescriptions = {
  full: 'Play Lottie icons, online pulses, and screen motion even when Android reduced motion is enabled.',
  reduced: 'Keep animation icons on a static frame and limit extra movement.',
  system: 'Use the Android motion accessibility setting for app motion.',
} as const satisfies Record<MotionPreference, string>;

const motionPreferenceOrder = [
  'full',
  'system',
  'reduced',
] as const satisfies readonly MotionPreference[];

const profileAvatarFallback = {
  backgroundColor: '#DDF7F2',
  foregroundColor: '#0F766E',
} as const;

const resolveProfileAvatarUri = (
  profileImageUri: string | null | undefined,
  gender: Customer['gender'] | null | undefined,
) =>
  normalizeCustomerAvatarUri(profileImageUri, gender) ??
  defaultCustomerAvatarUriForGender(gender);

const readParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

type RouterController = {
  back: ReturnType<typeof useRouter>['back'];
  push: ReturnType<typeof useRouter>['push'];
  replace: ReturnType<typeof useRouter>['replace'];
};

type RouteTarget =
  | string
  | {
      params?: Record<string, string>;
      pathname: string;
    };

const pushRoute = (router: RouterController, route: RouteTarget) => {
  router.push(route);
};

const replaceRoute = (router: RouterController, route: RouteTarget) => {
  router.replace(route);
};

const routeWithReturnTo = (
  route: RouteTarget,
  returnTo: string,
): RouteTarget => {
  if (typeof route === 'string') {
    return { params: { returnTo }, pathname: route };
  }

  return {
    ...route,
    params: {
      ...route.params,
      returnTo,
    },
  };
};

const returnToRouteOr = (
  router: RouterController,
  fallback: string,
  returnTo: string | string[] | undefined,
) => {
  replaceRoute(router, readParam(returnTo) ?? fallback);
};

const returnToCustomerProfile = (router: RouterController) => {
  replaceRoute(router, appRoutes.customerProfile.path);
};

const returnToCustomerSettings = (router: RouterController) => {
  replaceRoute(router, appRoutes.customerSettings.path);
};

const returnToPrivacySafety = (router: RouterController) => {
  replaceRoute(router, appRoutes.customerPrivacySafety.path);
};

const supportTicketReturnPath = (ticketId: string | null) =>
  ticketId === null
    ? appRoutes.customerSupport.path
    : appRoutes.customerSupportTicket.path.replace(
        '[ticketId]',
        encodeURIComponent(ticketId),
      );

function QueryCardState<T>({
  children,
  emptyMessage,
  emptyTitle,
  query,
  testID,
}: {
  children: (data: NonNullable<T>) => React.ReactNode;
  emptyMessage: string;
  emptyTitle: string;
  query: {
    data: T | undefined;
    error: unknown;
    isError: boolean;
    isPending: boolean;
    refetch: () => unknown;
  };
  testID?: string;
}) {
  if (query.isPending) {
    return (
      <View testID={testID}>
        <Card>
          <Skeleton lines={5} />
        </Card>
      </View>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        message={normalizeApiError(query.error).message}
        onRetry={() => {
          void query.refetch();
        }}
        title="Could not load"
      />
    );
  }

  const data = query.data;

  if (data === undefined || data === null) {
    return <EmptyState message={emptyMessage} title={emptyTitle} />;
  }

  return <>{children(data)}</>;
}

function MenuRow({
  description,
  destructive = false,
  icon: Icon,
  meta,
  onPress,
  title,
}: {
  description?: string;
  destructive?: boolean;
  icon?: IconComponent;
  meta?: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <GlassSurface
      contentStyle={styles.glassPressableContent}
      radius={ui.radii.xxl}
      shadow="soft"
      style={styles.menuRow}
      variant="standard"
    >
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.menuRowPressable,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.menuRowContent}>
          {Icon === undefined ? null : (
            <View
              style={[
                styles.menuIcon,
                destructive ? styles.menuIconDestructive : null,
              ]}
            >
              <Icon
                color={
                  destructive ? ui.color.status.error : ui.color.brand.primary
                }
                size={24}
                strokeWidth={2.4}
              />
            </View>
          )}
          <View style={styles.flex}>
            <Text
              style={[
                styles.rowTitle,
                destructive ? styles.rowTitleDanger : null,
              ]}
            >
              {title}
            </Text>
            {description === undefined ? null : (
              <Text style={styles.helper}>{description}</Text>
            )}
          </View>
          {meta === undefined ? null : (
            <Text style={styles.profileMenuMeta}>{meta}</Text>
          )}
          <ChevronRight color={ui.color.text.tertiary} size={28} />
        </View>
      </Pressable>
    </GlassSurface>
  );
}

function LanguageChip({
  label,
  onPress,
  selected,
  testID,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageChip,
        selected ? styles.languageChipSelected : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <Text
        maxFontSizeMultiplier={2}
        style={[
          styles.languageChipText,
          selected ? styles.languageChipTextSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AttachmentRow({
  attachment,
  onRemove,
}: {
  attachment: CustomerSupportAttachment;
  onRemove?: () => void;
}) {
  return (
    <Card style={styles.attachmentCard}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{attachment.fileName}</Text>
        <Text style={styles.helper}>
          {attachment.sizeLabel} •{' '}
          {formatCustomerDateTime(attachment.capturedAtIso)}
        </Text>
      </View>
      {onRemove === undefined ? null : (
        <Button compact onPress={onRemove} title="Remove" variant="ghost" />
      )}
    </Card>
  );
}

const profileInitials = (displayName: string) =>
  displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const formatMemberSince = (iso: string | null | undefined) => {
  if (iso === null || iso === undefined) {
    return 'Member since Connecto';
  }

  return `Member since ${new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))}`;
};

const formatCustomerGenderLabel = (
  gender: Customer['gender'] | null | undefined,
) => {
  if (gender === 'man') {
    return 'Male';
  }

  if (gender === 'woman') {
    return 'Female';
  }

  if (gender === null || gender === undefined) {
    return 'Not set';
  }

  return gender
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

const languageCardOrder = [
  'Telugu',
  'Hindi',
  'Bangla',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Punjabi',
  'Odia',
  'Gujarati',
] as const satisfies readonly Customer['preferredLanguages'][number][];

const languageCardDetails: Record<
  (typeof languageCardOrder)[number],
  { mark: string; subtitle: string }
> = {
  Bangla: { mark: 'BA', subtitle: 'Bangla' },
  Gujarati: { mark: 'GU', subtitle: 'Gujarati' },
  Hindi: { mark: 'HI', subtitle: 'Hindi' },
  Kannada: { mark: 'KA', subtitle: 'Kannada' },
  Malayalam: { mark: 'MA', subtitle: 'Malayalam' },
  Odia: { mark: 'OD', subtitle: 'Odia' },
  Punjabi: { mark: 'PA', subtitle: 'Punjabi' },
  Tamil: { mark: 'TA', subtitle: 'Tamil' },
  Telugu: { mark: 'TE', subtitle: 'Telugu' },
};

function ProfilePresetAvatar({
  displayName,
  gender,
  profileImageUri,
  size = 'lg',
}: {
  displayName: string;
  gender?: Customer['gender'] | null;
  profileImageUri: string | null | undefined;
  size?: 'lg' | 'md' | 'xl' | number;
}) {
  const avatarSource = resolveCustomerAvatarSource(profileImageUri, gender);
  const dimension =
    typeof size === 'number'
      ? size
      : size === 'xl'
        ? 96
        : size === 'lg'
          ? 72
          : 52;

  return (
    <View
      accessibilityLabel={`${displayName} avatar`}
      style={[
        styles.profileAvatar,
        {
          backgroundColor:
            avatarSource === undefined
              ? profileAvatarFallback.backgroundColor
              : 'transparent',
          height: dimension,
          width: dimension,
        },
      ]}
    >
      {avatarSource === undefined ? (
        <Text
          style={[
            styles.profileAvatarText,
            {
              color: profileAvatarFallback.foregroundColor,
              fontSize: Math.max(ui.type.title.fontSize, dimension * 0.34),
              lineHeight: Math.max(ui.type.title.lineHeight, dimension * 0.4),
            },
          ]}
        >
          {profileInitials(displayName)}
        </Text>
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          source={avatarSource}
          style={styles.profileAvatarImage}
        />
      )}
    </View>
  );
}

function ProfileDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileDetailLine}>
      <Text style={styles.helper}>{label}</Text>
      <Text style={styles.profileDetailValue}>{value}</Text>
    </View>
  );
}

export function ProfileHeroCard({ customer }: { customer: Customer }) {
  return (
    <Card style={styles.profileHeroCard}>
      <ProfilePresetAvatar
        displayName={customer.displayName}
        gender={customer.gender}
        profileImageUri={customer.profileImageUri}
        size="xl"
      />
      <View style={styles.profileHeroCopy}>
        <Text accessibilityRole="header" style={styles.profileHeroName}>
          {customer.displayName}
        </Text>
        <Text style={styles.helper}>
          {formatCustomerGenderLabel(customer.gender)}
          {' • '}
          {customer.dateOfBirthIso === undefined
            ? 'Date of birth unavailable'
            : customer.dateOfBirthIso}
        </Text>
        <View style={styles.badgeWrap}>
          <StatusBadge
            label={customer.ageConfirmed ? '18+ confirmed' : 'Age pending'}
            tone={customer.ageConfirmed ? 'success' : 'warning'}
          />
          <StatusBadge
            label={customer.notificationPermission}
            tone={
              customer.notificationPermission === 'granted' ? 'success' : 'info'
            }
          />
        </View>
      </View>
    </Card>
  );
}

function ProfileOverviewCard({
  customer,
  onEditProfile,
}: {
  customer: Customer;
  onEditProfile: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Card style={styles.profileOverviewHero} variant="strong">
        <View style={styles.profileOverviewHeroTop}>
          <ProfilePresetAvatar
            displayName={customer.displayName}
            gender={customer.gender}
            profileImageUri={customer.profileImageUri}
            size="lg"
          />
          <View style={styles.profileOverviewHeroCopy}>
            <View style={styles.profileOverviewNameRow}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={styles.profileOverviewName}
              >
                {customer.displayName}
              </Text>
            </View>
            <Text style={styles.profileOverviewMeta}>
              {formatMemberSince(customer.onboardingCompletedAtIso)}
            </Text>
            <View style={styles.profileOverviewLanguageRow}>
              {customer.preferredLanguages.map((language) => (
                <View key={language} style={styles.profileOverviewLanguagePill}>
                  <Text style={styles.profileOverviewLanguageText}>
                    {language}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <Pressable
            accessibilityLabel="Edit customer profile"
            accessibilityRole="button"
            hitSlop={ui.hitSlop}
            onPress={onEditProfile}
            style={({ pressed }) => [
              styles.profileOverviewEditButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Edit3 color={ui.color.brand.primary} size={30} strokeWidth={2.4} />
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

function buildCustomerProfileUpdate(input: {
  customer: Customer;
  dateOfBirthIso: string;
  displayName: string;
  gender: NonNullable<CustomerProfileForm['gender']>;
  preferredLanguages?: Customer['preferredLanguages'];
  profileImageUri: string | null;
}): CustomerProfileUpdate {
  const preferredLanguages =
    input.preferredLanguages ?? input.customer.preferredLanguages;

  return {
    ageConfirmed: true,
    dateOfBirthIso: input.dateOfBirthIso,
    displayName: input.displayName.trim(),
    gender: input.gender,
    notificationPermission: input.customer.notificationPermission,
    onboardingCompletedAtIso:
      input.customer.onboardingCompletedAtIso ?? new Date().toISOString(),
    preferredLanguages,
    profileImageUri: input.profileImageUri,
  };
}

export function CustomerProfileOverviewScreen() {
  const router = useRouter();
  const profileQuery = useCustomerProfileSettingsQuery();

  return (
    <ScrollScreen
      bottomContentInset={floatingTabBarBaseContentInset}
      contentStyle={styles.profileScreenContent}
      testID="customer-profile-overview-screen"
    >
      <View style={styles.profileTopBar}>
        <Text accessibilityRole="header" style={styles.profileScreenTitle}>
          My Profile
        </Text>
        <Pressable
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={() => {
            pushRoute(router, appRoutes.customerSettings.path);
          }}
          style={styles.plainIconButton}
        >
          <Settings color={ui.color.text.primary} size={34} strokeWidth={2.4} />
        </Pressable>
      </View>
      <QueryCardState
        emptyMessage="Profile information is not available."
        emptyTitle="Profile unavailable"
        query={profileQuery}
      >
        {(customer) => (
          <>
            <ProfileOverviewCard
              customer={customer}
              onEditProfile={() => {
                pushRoute(router, appRoutes.customerProfileEdit.path);
              }}
            />
            <View style={styles.profileMenuStack}>
              <MenuRow
                icon={Clock3}
                onPress={() => {
                  pushRoute(router, appRoutes.customerCalls.path);
                }}
                title="Recents"
              />
              <MenuRow
                icon={LanguagesIcon}
                meta={customer.preferredLanguages[0] ?? 'English'}
                onPress={() => {
                  pushRoute(
                    router,
                    routeWithReturnTo(
                      appRoutes.customerLanguageSettings.path,
                      appRoutes.customerProfile.path,
                    ),
                  );
                }}
                title="Change Language"
              />
              <MenuRow
                icon={Gift}
                onPress={() => {
                  pushRoute(
                    router,
                    routeWithReturnTo(
                      appRoutes.customerReferrals.path,
                      appRoutes.customerProfile.path,
                    ),
                  );
                }}
                title="Referrals"
              />
              <MenuRow
                icon={Share2}
                onPress={() => {
                  void Share.share({
                    message: 'Try Connecto for voice calls with experts.',
                  });
                }}
                title="Share App"
              />
              <MenuRow
                icon={Mail}
                onPress={() => {
                  pushRoute(
                    router,
                    routeWithReturnTo(
                      appRoutes.customerSupport.path,
                      appRoutes.customerProfile.path,
                    ),
                  );
                }}
                title="Contact Us"
              />
            </View>
          </>
        )}
      </QueryCardState>
      <View style={styles.safeFooter}>
        <ShieldCheck color={ui.color.status.success} size={22} />
        <Text style={styles.safeFooterText}>100% Safe and Private</Text>
      </View>
    </ScrollScreen>
  );
}

type CustomerSettingsScreenProps = {
  backRoute?: string;
  settingsRoute?: string;
  testID?: string;
};

export function CustomerSettingsScreen({
  backRoute = appRoutes.customerProfile.path,
  settingsRoute = appRoutes.customerSettings.path,
  testID = 'customer-settings-screen',
}: CustomerSettingsScreenProps = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { motionPreference } = useMotion();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const signOutMutation = useMutation({
    mutationFn: () => frontendServices.auth.signOut(),
    onSuccess: async () => {
      const route = clearNavigationSession();
      await persistAuthSnapshot(getAuthSnapshot());
      await invalidateCustomerAccountQueries(queryClient);
      replaceRoute(router, route);
    },
  });

  return (
    <ScrollScreen contentStyle={styles.settingsScreenContent} testID={testID}>
      <View style={styles.settingsHeader}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={() => {
            replaceRoute(router, backRoute);
          }}
          style={styles.plainIconButton}
        >
          <ArrowLeft color={ui.color.text.primary} size={30} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.profileScreenTitle}>
          Settings
        </Text>
      </View>
      <View style={styles.profileMenuStack}>
        <MenuRow
          icon={Sparkles}
          meta={motionPreferenceLabels[motionPreference]}
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(
                appRoutes.customerMotionSettings.path,
                settingsRoute,
              ),
            );
          }}
          title="Motion"
        />
        <MenuRow
          icon={FileText}
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(appRoutes.legalTerms.path, settingsRoute),
            );
          }}
          title="Terms & Conditions"
        />
        <MenuRow
          icon={Shield}
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(appRoutes.legalPrivacy.path, settingsRoute),
            );
          }}
          title="Privacy Policy"
        />
        <MenuRow
          icon={FileQuestion}
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(appRoutes.customerSupport.path, settingsRoute),
            );
          }}
          title="FAQs"
        />
        <MenuRow
          icon={LogOut}
          onPress={() => {
            setLogoutVisible(true);
          }}
          title="Logout"
        />
        <MenuRow
          destructive
          icon={Trash2}
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(
                appRoutes.customerDeleteAccount.path,
                settingsRoute,
              ),
            );
          }}
          title="Delete Account"
        />
      </View>
      {signOutMutation.isError ? (
        <InlineError
          message={normalizeApiError(signOutMutation.error).message}
        />
      ) : null}
      <View style={styles.settingsFooter}>
        <View style={styles.safeFooter}>
          <ShieldCheck color={ui.color.status.success} size={22} />
          <Text style={styles.safeFooterText}>100% Safe and Private</Text>
        </View>
        <Text style={styles.versionText}>Version: 1.5.6 (20250175)</Text>
      </View>
      <ConfirmationDialog
        confirmLabel="Log out"
        message="You will be signed out on this device. Wallet, support, and call history remain available again after you sign back in."
        onCancel={() => {
          setLogoutVisible(false);
        }}
        onConfirm={() => {
          setLogoutVisible(false);
          signOutMutation.mutate();
        }}
        title="Log out of Connecto?"
        visible={logoutVisible}
      />
    </ScrollScreen>
  );
}

export function CustomerMotionSettingsScreen() {
  const router = useRouter();
  const {
    motionPreference,
    nonEssentialHapticsEnabled,
    reducedMotionEnabled,
    setMotionPreference,
    setNonEssentialHapticsEnabled,
    systemReducedMotionEnabled,
  } = useMotion();

  return (
    <ScrollScreen
      contentStyle={styles.settingsScreenContent}
      testID="customer-motion-settings-screen"
    >
      <BackHeader
        onPress={() => {
          returnToCustomerSettings(router);
        }}
        title="Motion"
      />

      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Current status</Text>
        <View style={styles.badgeWrap}>
          <StatusBadge
            label={
              systemReducedMotionEnabled ? 'Android reduced' : 'Android normal'
            }
            tone={systemReducedMotionEnabled ? 'warning' : 'success'}
          />
          <StatusBadge
            label={reducedMotionEnabled ? 'Reduced active' : 'Full active'}
            tone={reducedMotionEnabled ? 'warning' : 'info'}
          />
        </View>
        <Text style={styles.helper}>
          This controls Connecto animation icons, online pulse effects, and
          standard motion on this device.
        </Text>
      </Card>

      <View style={styles.stack}>
        {motionPreferenceOrder.map((preference) => (
          <RadioCard
            description={motionPreferenceDescriptions[preference]}
            key={preference}
            label={motionPreferenceLabels[preference]}
            onPress={() => {
              setMotionPreference(preference);
            }}
            selected={motionPreference === preference}
            testID={`motion-preference-${preference}`}
          />
        ))}
      </View>

      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Touch feedback</Text>
        <SwitchRow
          label="Vibration feedback"
          onValueChange={setNonEssentialHapticsEnabled}
          testID="motion-haptics-toggle"
          value={nonEssentialHapticsEnabled}
        />
      </Card>
    </ScrollScreen>
  );
}

export function CustomerProfileEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { readableContentWidth } = useResponsiveLayout();
  const profileQuery = useCustomerProfileSettingsQuery();
  const [form, setForm] = useState<CustomerProfileForm | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const customer = profileQuery.data;
  const initialForm =
    customer === undefined
      ? null
      : ({
          dateOfBirthInput: customer.dateOfBirthIso ?? '',
          displayName: customer.displayName,
          gender: customer.gender ?? null,
          profileImageUri: resolveProfileAvatarUri(
            customer.profileImageUri,
            customer.gender,
          ),
        } satisfies CustomerProfileForm);
  const activeForm = form ?? initialForm;
  const submitMutation = useMutation({
    mutationFn: async (currentForm: CustomerProfileForm) => {
      if (customer === undefined) {
        throw new Error('Profile data is not ready.');
      }

      const dateOfBirthIso = customer.dateOfBirthIso;
      const gender = customer.gender;

      if (dateOfBirthIso === undefined || gender === undefined) {
        throw new Error('Locked profile details are not ready.');
      }

      return frontendServices.customer.updateProfile({
        customerId: customer.id,
        profile: buildCustomerProfileUpdate({
          customer,
          dateOfBirthIso,
          displayName: currentForm.displayName,
          gender,
          profileImageUri: currentForm.profileImageUri,
        }),
      });
    },
    onSuccess: async (customer) => {
      queryClient.setQueryData(
        queryKeys.customer.profile(mobileDataIds.customerId),
        customer,
      );
      await invalidateCustomerAccountQueries(queryClient);
      returnToCustomerProfile(router);
    },
  });

  if (profileQuery.isError) {
    return (
      <ScrollScreen testID="customer-profile-edit-error">
        <BackHeader
          onPress={() => {
            returnToCustomerProfile(router);
          }}
          title="Edit profile"
        />
        <ErrorState
          message={normalizeApiError(profileQuery.error).message}
          onRetry={() => {
            void profileQuery.refetch();
          }}
          title="Could not load profile"
        />
      </ScrollScreen>
    );
  }

  if (profileQuery.isPending || customer === undefined || activeForm === null) {
    return (
      <ScrollScreen testID="customer-profile-edit-loading">
        <BackHeader
          onPress={() => {
            returnToCustomerProfile(router);
          }}
          title="Edit profile"
        />
        <Card>
          <Skeleton lines={8} />
        </Card>
      </ScrollScreen>
    );
  }

  const displayNameError =
    activeForm.displayName.trim().length === 0
      ? 'Enter your display name.'
      : null;
  const avatarOptions = getCustomerAvatarOptionsForGender(customer.gender);
  const avatarOptionWidth = Math.floor(
    (readableContentWidth - ui.spacing[5] * 2 - ui.spacing[3] * 2) / 3,
  );
  const profileAvatarSize = Math.min(
    132,
    Math.max(96, Math.round(readableContentWidth * 0.3)),
  );
  const avatarOptionSize = Math.min(
    88,
    Math.max(72, avatarOptionWidth - ui.spacing[2] * 2),
  );

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          loading={submitMutation.isPending}
          onPress={() => {
            if (displayNameError !== null) {
              setSubmitError('Fix the highlighted fields before saving.');
              return;
            }

            setSubmitError(null);
            submitMutation.mutate(activeForm);
          }}
          testID="profile-save"
          title="Save changes"
        />
      }
      testID="customer-profile-edit-screen"
    >
      <BackHeader
        onPress={() => {
          returnToCustomerProfile(router);
        }}
        title="Edit profile"
      />
      <Card style={styles.heroCard} variant="standard">
        <ProfilePresetAvatar
          displayName={activeForm.displayName}
          gender={customer.gender}
          profileImageUri={activeForm.profileImageUri}
          size={profileAvatarSize}
        />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>Avatar</Text>
          <Text style={styles.helper}>
            Choose an avatar for your customer profile.
          </Text>
        </View>
      </Card>
      <Card style={styles.cardStack} variant="strong">
        <Text style={styles.cardTitle}>Avatar options</Text>
        <View style={styles.avatarPresetRow}>
          {avatarOptions.map((avatar) => {
            const selected = activeForm.profileImageUri === avatar.uri;

            return (
              <Pressable
                accessibilityLabel={`Use ${avatar.label} avatar`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={avatar.uri}
                onPress={() => {
                  setForm(
                    (current) =>
                      ({
                        ...(current ?? activeForm),
                        profileImageUri: avatar.uri,
                      }) satisfies CustomerProfileForm,
                  );
                  setSubmitError(null);
                }}
                style={({ pressed }) => [
                  styles.avatarPresetButton,
                  {
                    minHeight: avatarOptionSize + 38,
                    width: avatarOptionWidth,
                  },
                  selected ? styles.avatarPresetButtonSelected : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`profile-avatar-${avatar.gender}-${avatar.id}`}
              >
                <ProfilePresetAvatar
                  displayName={activeForm.displayName}
                  gender={customer.gender}
                  profileImageUri={avatar.uri}
                  size={avatarOptionSize}
                />
                <Text
                  style={[
                    styles.avatarPresetLabel,
                    selected ? styles.avatarPresetLabelSelected : null,
                  ]}
                >
                  {avatar.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <TextField
        {...(displayNameError === null ? {} : { errorText: displayNameError })}
        label="Display name"
        onChangeText={(value) => {
          setForm(
            (current) =>
              ({
                ...(current ?? activeForm),
                displayName: value,
              }) satisfies CustomerProfileForm,
          );
          setSubmitError(null);
        }}
        placeholder="How hosts and support should address you"
        testID="profile-display-name"
        value={activeForm.displayName}
      />
      <Card style={styles.cardStack} variant="strong">
        <Text style={styles.cardTitle}>Profile details</Text>
        <ProfileDetailLine
          label="Date of birth"
          value={customer.dateOfBirthIso ?? 'Not available'}
        />
        <ProfileDetailLine
          label="Gender"
          value={formatCustomerGenderLabel(customer.gender)}
        />
        <Text style={styles.helper}>
          These details are locked after account setup.
        </Text>
      </Card>
      {submitError === null ? null : <InlineError message={submitError} />}
      {submitMutation.isError ? (
        <InlineError
          message={normalizeApiError(submitMutation.error).message}
        />
      ) : null}
    </KeyboardScreen>
  );
}

export function CustomerLanguageSettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const profileQuery = useCustomerProfileSettingsQuery();
  const [primaryLanguage, setPrimaryLanguage] = useState<
    Customer['preferredLanguages'][number] | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const customer = profileQuery.data;
  const initialPrimaryLanguage =
    customer === undefined
      ? null
      : (customer.preferredLanguages[0] ??
        customerOnboardingLanguageOptions[0].language);
  const activePrimaryLanguage = primaryLanguage ?? initialPrimaryLanguage;
  const languageOptions = languageCardOrder
    .map((language) =>
      customerOnboardingLanguageOptions.find(
        (option) => option.language === language,
      ),
    )
    .filter(
      (option): option is (typeof customerOnboardingLanguageOptions)[number] =>
        option !== undefined,
    );
  const changed =
    activePrimaryLanguage !== null &&
    activePrimaryLanguage !== initialPrimaryLanguage;
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (customer === undefined || activePrimaryLanguage === null) {
        throw new Error('Choose a primary language before saving.');
      }

      return frontendServices.customer.updateProfile({
        customerId: customer.id,
        profile: buildCustomerProfileUpdate({
          customer,
          dateOfBirthIso: customer.dateOfBirthIso ?? '1995-01-01',
          displayName: customer.displayName,
          gender: customer.gender ?? 'prefer-not-to-say',
          preferredLanguages: buildCustomerPreferredLanguages(
            activePrimaryLanguage,
            null,
          ),
          profileImageUri: customer.profileImageUri ?? null,
        }),
      });
    },
    onSuccess: async (customer) => {
      queryClient.setQueryData(
        queryKeys.customer.profile(mobileDataIds.customerId),
        customer,
      );
      await invalidateCustomerAccountQueries(queryClient);
      returnToCustomerProfile(router);
    },
  });

  if (profileQuery.isError) {
    return (
      <ScrollScreen testID="customer-language-settings-error">
        <BackHeader
          onPress={() => {
            returnToCustomerProfile(router);
          }}
          title="Language settings"
        />
        <ErrorState
          message={normalizeApiError(profileQuery.error).message}
          onRetry={() => {
            void profileQuery.refetch();
          }}
          title="Could not load language settings"
        />
      </ScrollScreen>
    );
  }

  if (
    profileQuery.isPending ||
    customer === undefined ||
    activePrimaryLanguage === null
  ) {
    return (
      <ScrollScreen testID="customer-language-settings-loading">
        <BackHeader
          onPress={() => {
            returnToCustomerProfile(router);
          }}
          title="Language settings"
        />
        <Card>
          <Skeleton lines={8} />
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          disabled={!changed}
          loading={saveMutation.isPending}
          onPress={() => {
            setSubmitError(null);
            saveMutation.mutate();
          }}
          testID="language-save"
          title="Save Changes"
        />
      }
      contentStyle={styles.languageScreenContent}
      testID="customer-language-settings-screen"
    >
      <BackHeader
        onPress={() => {
          returnToCustomerProfile(router);
        }}
        title="Talk to experts in this language"
      />
      <View accessibilityRole="radiogroup" style={styles.languageGrid}>
        {languageOptions.map((option) => {
          const selected = activePrimaryLanguage === option.language;
          const detail =
            option.language in languageCardDetails
              ? languageCardDetails[
                  option.language as keyof typeof languageCardDetails
                ]
              : { mark: 'EN', subtitle: 'English' };

          return (
            <Pressable
              accessibilityLabel={`Use ${option.language}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.language}
              onPress={() => {
                setPrimaryLanguage(option.language);
                haptics.selection();
                setSubmitError(null);
              }}
              style={({ pressed }) => [
                styles.languageCard,
                selected ? styles.languageCardSelected : null,
                pressed ? styles.pressed : null,
              ]}
              testID={`primary-language-${option.language}`}
            >
              <View
                style={[
                  styles.languageRadio,
                  selected ? styles.languageRadioSelected : null,
                ]}
              >
                {selected ? (
                  <Check
                    color={ui.color.brand.primary}
                    size={20}
                    strokeWidth={3}
                  />
                ) : null}
              </View>
              <View style={styles.languageCardCopy}>
                <Text
                  style={[
                    styles.languageCardTitle,
                    selected ? styles.languageCardTitleSelected : null,
                  ]}
                >
                  {option.language}
                </Text>
                <Text
                  style={[
                    styles.languageCardSubtitle,
                    selected ? styles.languageCardSubtitleSelected : null,
                  ]}
                >
                  {detail.subtitle}
                </Text>
              </View>
              <Text
                style={[
                  styles.languageCardMark,
                  selected ? styles.languageCardMarkSelected : null,
                ]}
              >
                {detail.mark}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {submitError === null ? null : <InlineError message={submitError} />}
      {saveMutation.isError ? (
        <InlineError message={normalizeApiError(saveMutation.error).message} />
      ) : null}
    </KeyboardScreen>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: CustomerNotificationFeedItem;
  onPress: () => void;
}) {
  return (
    <GlassSurface
      contentStyle={styles.glassPressableContent}
      radius={ui.radii.xl}
      shadow="soft"
      style={styles.listRowCard}
      variant="standard"
    >
      <Pressable
        accessibilityLabel={item.title}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.listRowPressable,
          pressed ? styles.pressed : null,
        ]}
        testID={`notification-${item.id}`}
      >
        <View style={styles.listRowHeader}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.helper}>{item.body}</Text>
            <Text style={styles.helper}>
              {resolveNotificationCategoryLabel(item.category)} •{' '}
              {formatCustomerDateTime(item.createdAtIso)}
            </Text>
          </View>
          <View style={styles.trailingColumn}>
            <StatusBadge
              label={item.readAtIso === null ? 'Unread' : 'Read'}
              tone={item.readAtIso === null ? 'warning' : 'success'}
            />
            <Text style={styles.metaText}>{item.source}</Text>
          </View>
        </View>
      </Pressable>
    </GlassSurface>
  );
}

export function CustomerNotificationCenterScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const notificationsQuery = useCustomerNotificationFeedQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllMutation = useMarkAllNotificationsReadMutation();
  const previewMutation = useTriggerLocalNotificationPreviewMutation();

  const unreadCount =
    notificationsQuery.data?.filter(
      (notification) => notification.readAtIso === null,
    ).length ?? 0;

  return (
    <ScrollScreen testID="customer-notifications-screen">
      <BackHeader
        onPress={() => {
          returnToCustomerProfile(router);
        }}
        title="Notifications"
      />
      <Banner
        message="Local mock alerts use Expo notification payloads that route through the in-app notification boundary."
        title="Notification routing"
        tone="info"
      />
      <SectionHeader
        {...(unreadCount === 0 ? {} : { actionLabel: 'Mark all read' })}
        onAction={() => {
          markAllMutation.mutate();
        }}
        title="Local preview"
      />
      <View style={styles.languageWrap}>
        {previewNotificationCategories.map((category) => (
          <LanguageChip
            key={category}
            label={`Preview ${resolveNotificationCategoryLabel(category)}`}
            onPress={() => {
              previewMutation.mutate(category, {
                onSuccess: () => {
                  haptics.selection();
                },
              });
            }}
            selected={false}
            testID={`preview-notification-${category}`}
          />
        ))}
      </View>
      {markAllMutation.isError ? (
        <InlineError
          message={normalizeApiError(markAllMutation.error).message}
        />
      ) : null}
      <SectionHeader
        subtitle={`${String(unreadCount)} unread`}
        title="Notification centre"
      />
      <QueryCardState
        emptyMessage="Local previews and account updates will appear here."
        emptyTitle="No notifications"
        query={notificationsQuery}
      >
        {(items) => (
          <View style={styles.stack}>
            {items.map((item) => (
              <NotificationRow
                item={item}
                key={item.id}
                onPress={() => {
                  const navigate = () => {
                    pushRoute(
                      router,
                      routeWithReturnTo(
                        resolveNotificationTarget(item),
                        appRoutes.customerNotifications.path,
                      ),
                    );
                  };

                  if (item.readAtIso !== null) {
                    navigate();
                    return;
                  }

                  markReadMutation.mutate(item.id, {
                    onSuccess: () => {
                      navigate();
                    },
                  });
                }}
              />
            ))}
          </View>
        )}
      </QueryCardState>
    </ScrollScreen>
  );
}

export function CustomerNotificationPreferencesScreen() {
  const router = useRouter();
  const profileQuery = useCustomerProfileSettingsQuery();
  const preferencesQuery = useCustomerNotificationPreferencesQuery();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const saveMutation = useUpdateNotificationPreferencesMutation();
  const activeDraft = draft ?? preferencesQuery.data ?? null;

  if (preferencesQuery.isError) {
    return (
      <ScrollScreen testID="customer-notification-preferences-error">
        <BackHeader
          onPress={() => {
            replaceRoute(router, appRoutes.customerNotifications.path);
          }}
          title="Notification preferences"
        />
        <ErrorState
          message={normalizeApiError(preferencesQuery.error).message}
          onRetry={() => {
            void preferencesQuery.refetch();
          }}
          title="Could not load preferences"
        />
      </ScrollScreen>
    );
  }

  if (preferencesQuery.isPending || activeDraft === null) {
    return (
      <ScrollScreen testID="customer-notification-preferences-loading">
        <BackHeader
          onPress={() => {
            replaceRoute(router, appRoutes.customerNotifications.path);
          }}
          title="Notification preferences"
        />
        <Card>
          <Skeleton lines={7} />
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          loading={saveMutation.isPending}
          onPress={() => {
            saveMutation.mutate(activeDraft);
          }}
          testID="notification-preferences-save"
          title="Save preferences"
        />
      }
      testID="customer-notification-preferences-screen"
    >
      <BackHeader
        onPress={() => {
          replaceRoute(router, appRoutes.customerNotifications.path);
        }}
        title="Notification preferences"
      />
      <Banner
        message={`System permission is currently ${profileQuery.data?.notificationPermission ?? 'unknown'}. Category switches below are local product preferences and do not promise delivery if the system permission stays denied.`}
        title="System status"
        tone="info"
      />
      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Categories</Text>
        <SwitchRow
          label="Payments"
          onValueChange={(value) => {
            setDraft(
              (current) =>
                ({
                  ...(current ?? activeDraft),
                  payment: value,
                }) satisfies NotificationPreferences,
            );
          }}
          testID="pref-payment"
          value={activeDraft.payment}
        />
        <SwitchRow
          label="Calls"
          onValueChange={(value) => {
            setDraft(
              (current) =>
                ({
                  ...(current ?? activeDraft),
                  call: value,
                }) satisfies NotificationPreferences,
            );
          }}
          testID="pref-call"
          value={activeDraft.call}
        />
        <SwitchRow
          label="Safety"
          onValueChange={(value) => {
            setDraft(
              (current) =>
                ({
                  ...(current ?? activeDraft),
                  safety: value,
                }) satisfies NotificationPreferences,
            );
          }}
          testID="pref-safety"
          value={activeDraft.safety}
        />
        <SwitchRow
          label="Referrals"
          onValueChange={(value) => {
            setDraft(
              (current) =>
                ({
                  ...(current ?? activeDraft),
                  referral: value,
                }) satisfies NotificationPreferences,
            );
          }}
          testID="pref-referral"
          value={activeDraft.referral}
        />
        <SwitchRow
          label="Support"
          onValueChange={(value) => {
            setDraft(
              (current) =>
                ({
                  ...(current ?? activeDraft),
                  support: value,
                }) satisfies NotificationPreferences,
            );
          }}
          testID="pref-support"
          value={activeDraft.support}
        />
      </Card>
      {saveMutation.isError ? (
        <InlineError message={normalizeApiError(saveMutation.error).message} />
      ) : null}
    </KeyboardScreen>
  );
}

export function CustomerPrivacySafetyScreen() {
  const router = useRouter();
  const blockedHostsQuery = useBlockedHostsQuery();
  const reportsQuery = useCustomerReportHistoryQuery();

  return (
    <ScrollScreen testID="customer-privacy-safety-screen">
      <BackHeader
        onPress={() => {
          returnToCustomerProfile(router);
        }}
        title="Privacy & safety"
      />
      <Banner
        message="Blocking hides hosts from discovery on this device. Reporting creates a review trail without promising an immediate outcome."
        title="Safety tools"
        tone="warning"
      />
      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Privacy controls</Text>
        <Text style={styles.helper}>
          Notification preferences, support drafts, and account requests persist
          locally through SecureStore-compatible storage in this frontend-only
          stage.
        </Text>
      </Card>
      <SectionHeader title="Safety history" />
      <View style={styles.stack}>
        <MenuRow
          description="Review currently blocked hosts and unblock them if you want them to return to discovery."
          meta={`${String(blockedHostsQuery.data?.length ?? 0)} blocked`}
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(
                appRoutes.customerBlockedUsers.path,
                appRoutes.customerPrivacySafety.path,
              ),
            );
          }}
          title="Blocked hosts"
        />
        <MenuRow
          description="See every submitted customer report and whether it is open, reviewing, resolved, or dismissed."
          meta={`${String(reportsQuery.data?.length ?? 0)} reports`}
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(
                appRoutes.customerReportHistory.path,
                appRoutes.customerPrivacySafety.path,
              ),
            );
          }}
          title="Report history"
        />
        <MenuRow
          description="Read the current community standards that govern conduct and anti-abuse messaging."
          onPress={() => {
            pushRoute(
              router,
              routeWithReturnTo(
                appRoutes.legalCommunityGuidelines.path,
                appRoutes.customerPrivacySafety.path,
              ),
            );
          }}
          title="Community Guidelines"
        />
      </View>
    </ScrollScreen>
  );
}

export function CustomerBlockedUsersScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const blockedHostsQuery = useBlockedHostsQuery();
  const unblockMutation = useUnblockHostMutation();

  return (
    <ScrollScreen testID="customer-blocked-hosts-screen">
      <BackHeader
        onPress={() => {
          returnToPrivacySafety(router);
        }}
        title="Blocked hosts"
      />
      <QueryCardState
        emptyMessage="Blocking from discovery or in-call safety actions will list hosts here."
        emptyTitle="No blocked hosts"
        query={blockedHostsQuery}
      >
        {(blockedHosts) => (
          <View style={styles.stack}>
            {blockedHosts.map((host) => (
              <Card key={host.hostId} style={styles.cardStack}>
                <View style={styles.listRowHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{host.displayName}</Text>
                    <Text style={styles.helper}>
                      {host.language} • {host.rank} • {host.availability}
                    </Text>
                  </View>
                  <Button
                    compact
                    disabled={unblockMutation.isPending}
                    onPress={() => {
                      unblockMutation.mutate(host.hostId, {
                        onSuccess: () => {
                          haptics.selection();
                        },
                      });
                    }}
                    title="Unblock"
                    variant="secondary"
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryCardState>
      {unblockMutation.isError ? (
        <InlineError
          message={normalizeApiError(unblockMutation.error).message}
        />
      ) : null}
    </ScrollScreen>
  );
}

export function CustomerReportHistoryScreen() {
  const router = useRouter();
  const reportsQuery = useCustomerReportHistoryQuery();

  return (
    <ScrollScreen testID="customer-report-history-screen">
      <BackHeader
        onPress={() => {
          returnToPrivacySafety(router);
        }}
        title="Report history"
      />
      <QueryCardState
        emptyMessage="Reports submitted from discovery, calls, or support follow-up will appear here."
        emptyTitle="No reports yet"
        query={reportsQuery}
      >
        {(reports) => (
          <View style={styles.stack}>
            {reports.map((report) => (
              <Card key={report.id} style={styles.cardStack}>
                <View style={styles.listRowHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>
                      {resolveReportKindLabel(report.kind)}
                    </Text>
                    <Text style={styles.helper}>{report.description}</Text>
                    <Text style={styles.helper}>
                      Target: {report.targetId} •{' '}
                      {formatCustomerDateTime(report.createdAtIso)}
                    </Text>
                  </View>
                  <StatusBadge
                    label={resolveReportStatusLabel(report.status)}
                    tone={
                      report.status === 'resolved'
                        ? 'success'
                        : report.status === 'dismissed'
                          ? 'info'
                          : 'warning'
                    }
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryCardState>
    </ScrollScreen>
  );
}

export function CustomerSupportCenterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    callId?: string | string[];
    returnTo?: string | string[];
  }>();
  const linkedCallId = readParam(params.callId) ?? null;
  const ticketsQuery = useCustomerSupportTicketsQuery();
  const draftQuery = useCustomerSupportDraftQuery();
  const createAttachmentMutation = useCreateSupportAttachmentMutation();
  const initialDraft =
    draftQuery.data === undefined
      ? null
      : ({
          ...draftQuery.data,
          category: draftQuery.data.category,
          linkedCallId: linkedCallId ?? draftQuery.data.linkedCallId,
        } satisfies CustomerSupportDraft);
  const submitMutation = useMutation({
    mutationFn: (draft: CustomerSupportDraft) =>
      customerAccountAdapter.submitSupportTicket(
        mobileDataIds.customerId,
        draft,
      ),
    onSuccess: async (ticket) => {
      await customerAccountAdapter.saveSupportDraft(
        mobileDataIds.customerId,
        defaultCustomerSupportDraft,
      );
      replaceRoute(router, {
        params: {
          returnTo: appRoutes.customerSupport.path,
          ticketId: ticket.id,
        },
        pathname: appRoutes.customerSupportTicket.path,
      });
    },
  });
  const [draft, setDraft] = useState<CustomerSupportDraft | null>(null);
  const saveTimeoutRef = useRef<unknown>(null);
  const activeDraft = draft ?? initialDraft;

  useEffect(() => {
    if (draft === null) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current as number);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void customerAccountAdapter.saveSupportDraft(
        mobileDataIds.customerId,
        draft,
      );
      saveTimeoutRef.current = null;
    }, 120);

    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current as number);
        saveTimeoutRef.current = null;
      }
    };
  }, [draft]);

  if (draftQuery.isError) {
    return (
      <ScrollScreen testID="customer-support-error">
        <BackHeader
          onPress={() => {
            returnToRouteOr(
              router,
              appRoutes.customerProfile.path,
              params.returnTo,
            );
          }}
          title="Support"
        />
        <ErrorState
          message={normalizeApiError(draftQuery.error).message}
          onRetry={() => {
            void draftQuery.refetch();
          }}
          title="Could not load support draft"
        />
      </ScrollScreen>
    );
  }

  if (draftQuery.isPending || activeDraft === null) {
    return (
      <ScrollScreen testID="customer-support-loading">
        <BackHeader
          onPress={() => {
            returnToRouteOr(
              router,
              appRoutes.customerProfile.path,
              params.returnTo,
            );
          }}
          title="Support"
        />
        <Card>
          <Skeleton lines={9} />
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          loading={submitMutation.isPending}
          onPress={() => {
            submitMutation.mutate(activeDraft);
          }}
          testID="support-submit"
          title={submitMutation.isError ? 'Retry submission' : 'Submit ticket'}
        />
      }
      testID="customer-support-screen"
    >
      <BackHeader
        onPress={() => {
          returnToRouteOr(
            router,
            appRoutes.customerProfile.path,
            params.returnTo,
          );
        }}
        title="Support"
      />
      <SectionHeader
        subtitle="Drafts persist locally so temporary submission failures do not lose your work."
        title="New ticket"
      />
      {linkedCallId === null ? null : (
        <Banner
          message={`Linked call: ${linkedCallId}`}
          title="Context attached"
          tone="info"
        />
      )}
      <TextField
        label="Subject"
        onChangeText={(value) => {
          setDraft(
            (current) =>
              ({
                ...(current ?? activeDraft),
                subject: value,
              }) satisfies CustomerSupportDraft,
          );
        }}
        placeholder="Short summary for support"
        testID="support-subject"
        value={activeDraft.subject}
      />
      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Category</Text>
        <View accessibilityRole="radiogroup" style={styles.optionStack}>
          {supportCategoryOptions.map((option) => (
            <RadioCard
              description={option.description}
              key={option.category}
              label={resolveSupportCategoryLabel(option.category)}
              onPress={() => {
                setDraft(
                  (current) =>
                    ({
                      ...(current ?? activeDraft),
                      category: option.category,
                    }) satisfies CustomerSupportDraft,
                );
              }}
              selected={activeDraft.category === option.category}
              testID={`support-category-${option.category}`}
            />
          ))}
        </View>
      </Card>
      <TextArea
        helperText="Explain what happened, when it happened, and any steps that reproduce it."
        label="Details"
        onChangeText={(value) => {
          setDraft(
            (current) =>
              ({
                ...(current ?? activeDraft),
                body: value,
              }) satisfies CustomerSupportDraft,
          );
        }}
        placeholder="Describe the issue"
        testID="support-body"
        value={activeDraft.body}
      />
      {submitMutation.isError ? (
        <>
          <InlineError
            message={normalizeApiError(submitMutation.error).message}
          />
          <Banner
            message="Your draft is still saved on this device. Review it and retry whenever the issue is recoverable."
            title="Draft retained"
            tone="warning"
          />
        </>
      ) : null}
      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Attachments metadata</Text>
        <Text style={styles.helper}>
          This stage stores attachment metadata only, not media bytes.
        </Text>
        <Button
          icon={FileText}
          loading={createAttachmentMutation.isPending}
          onPress={() => {
            createAttachmentMutation.mutate(
              { linkedCallId: activeDraft.linkedCallId },
              {
                onSuccess: (attachment) => {
                  setDraft(
                    (current) =>
                      ({
                        ...(current ?? activeDraft),
                        attachments: [
                          ...(current ?? activeDraft).attachments,
                          attachment,
                        ],
                      }) satisfies CustomerSupportDraft,
                  );
                },
              },
            );
          }}
          testID="support-add-attachment"
          title="Add attachment metadata"
          variant="secondary"
        />
      </Card>
      {activeDraft.attachments.length === 0 ? null : (
        <View style={styles.stack}>
          {activeDraft.attachments.map((attachment) => (
            <AttachmentRow
              attachment={attachment}
              key={attachment.attachmentId}
              onRemove={() => {
                setDraft(
                  (current) =>
                    ({
                      ...(current ?? activeDraft),
                      attachments: (current ?? activeDraft).attachments.filter(
                        (item) => item.attachmentId !== attachment.attachmentId,
                      ),
                    }) satisfies CustomerSupportDraft,
                );
              }}
            />
          ))}
        </View>
      )}
      <SectionHeader title="Existing tickets" />
      <QueryCardState
        emptyMessage="Submitted tickets will appear here after creation."
        emptyTitle="No support tickets"
        query={ticketsQuery}
      >
        {(tickets) => (
          <View style={styles.stack}>
            {tickets.map((ticket) => (
              <GlassSurface
                contentStyle={styles.glassPressableContent}
                key={ticket.id}
                radius={ui.radii.xl}
                shadow="soft"
                style={styles.listRowCard}
                variant="standard"
              >
                <Pressable
                  accessibilityLabel={`Open support ticket ${ticket.ticketReference}`}
                  accessibilityRole="button"
                  onPress={() => {
                    pushRoute(router, {
                      params: {
                        returnTo: appRoutes.customerSupport.path,
                        ticketId: ticket.id,
                      },
                      pathname: appRoutes.customerSupportTicket.path,
                    });
                  }}
                  style={({ pressed }) => [
                    styles.listRowPressable,
                    pressed ? styles.pressed : null,
                  ]}
                  testID={`support-ticket-${ticket.id}`}
                >
                  <View style={styles.listRowHeader}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{ticket.subject}</Text>
                      <Text style={styles.helper}>
                        {resolveSupportCategoryLabel(ticket.category)} •{' '}
                        {formatCustomerDateTime(ticket.updatedAtIso)}
                      </Text>
                    </View>
                    <StatusBadge label={ticket.status} tone="warning" />
                  </View>
                </Pressable>
              </GlassSurface>
            ))}
          </View>
        )}
      </QueryCardState>
    </KeyboardScreen>
  );
}

export function CustomerSupportTicketDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
    ticketId?: string | string[];
  }>();
  const ticketId = readParam(params.ticketId) ?? null;
  const ticketQuery = useCustomerSupportTicketQuery(ticketId);

  return (
    <ScrollScreen testID="customer-support-ticket-detail-screen">
      <BackHeader
        onPress={() => {
          returnToRouteOr(
            router,
            appRoutes.customerSupport.path,
            params.returnTo,
          );
        }}
        title="Support ticket"
      />
      <QueryCardState
        emptyMessage="The selected ticket could not be found."
        emptyTitle="Ticket unavailable"
        query={ticketQuery}
      >
        {(ticket) => (
          <>
            <Card style={styles.cardStack}>
              <View style={styles.listRowHeader}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{ticket.subject}</Text>
                  <Text style={styles.helper}>{ticket.body}</Text>
                </View>
                <StatusBadge label={ticket.status} tone="warning" />
              </View>
              <Text style={styles.helper}>
                Reference: {ticket.ticketReference}
              </Text>
              <Text style={styles.helper}>
                Category: {resolveSupportCategoryLabel(ticket.category)}
              </Text>
              <Text style={styles.helper}>
                Created: {formatCustomerDateTime(ticket.createdAtIso)}
              </Text>
              <Text style={styles.helper}>
                Updated: {formatCustomerDateTime(ticket.updatedAtIso)}
              </Text>
              <Text style={styles.helper}>Source: {ticket.source}</Text>
            </Card>
            {ticket.attachments.length === 0 ? null : (
              <Card style={styles.cardStack}>
                <Text style={styles.cardTitle}>Attachments metadata</Text>
                <View style={styles.stack}>
                  {ticket.attachments.map((attachment) => (
                    <AttachmentRow
                      attachment={attachment}
                      key={attachment.attachmentId}
                    />
                  ))}
                </View>
              </Card>
            )}
            <View style={styles.inlineActionRow}>
              {ticket.linkedCallId === null ? null : (
                <Button
                  icon={LifeBuoy}
                  onPress={() => {
                    pushRoute(router, {
                      params: {
                        callId: ticket.linkedCallId ?? '',
                        returnTo: supportTicketReturnPath(ticketId),
                      },
                      pathname: appRoutes.customerCallDetail.path,
                    });
                  }}
                  title="Open call"
                  variant="secondary"
                />
              )}
            </View>
          </>
        )}
      </QueryCardState>
    </ScrollScreen>
  );
}

export function CustomerDeleteAccountScreen() {
  const router = useRouter();
  const walletQuery = useWalletQuery();
  const deleteAccountQuery = useDeleteAccountStateQuery();
  const requestDeleteMutation = useRequestDeleteAccountMutation();
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <ScrollScreen testID="customer-delete-account-screen">
      <BackHeader
        onPress={() => {
          returnToCustomerSettings(router);
        }}
        title="Delete account"
      />
      <Banner
        message="Account deletion is irreversible. Support history, legal access, and wallet visibility stay available only until the request is accepted."
        title="Read before continuing"
        tone="warning"
      />
      <QueryCardState
        emptyMessage="Delete-account state is not available."
        emptyTitle="Unavailable"
        query={deleteAccountQuery}
      >
        {(state) => (
          <>
            {state.status === 'pending' ? (
              <Card style={styles.cardStack}>
                <Text style={styles.cardTitle}>Request pending</Text>
                <Text style={styles.helper}>Reference: {state.request.id}</Text>
                <Text style={styles.helper}>
                  Requested:{' '}
                  {formatCustomerDateTime(state.request.requestedAtIso)}
                </Text>
                <Text style={styles.helper}>
                  Wallet and support remain visible until review finishes.
                </Text>
              </Card>
            ) : state.status === 'blocked' ? (
              <Card style={styles.cardStack}>
                <Text style={styles.cardTitle}>Deletion blocked</Text>
                <Text style={styles.helper}>
                  Resolve the following issues before deletion can continue.
                </Text>
                <View style={styles.stack}>
                  {state.reasons.map((reason) => (
                    <Banner
                      key={reason}
                      message={resolveDeleteAccountReasonLabel(
                        walletQuery.data?.balance,
                      )}
                      title={reason}
                      tone="warning"
                    />
                  ))}
                </View>
                <View style={styles.inlineActionRow}>
                  <Button
                    icon={Wallet}
                    onPress={() => {
                      pushRoute(
                        router,
                        routeWithReturnTo(
                          appRoutes.customerAddMoney.path,
                          appRoutes.customerDeleteAccount.path,
                        ),
                      );
                    }}
                    title="Open add money"
                    variant="secondary"
                  />
                </View>
              </Card>
            ) : (
              <Card style={styles.cardStack}>
                <Text style={styles.cardTitle}>Deletion available</Text>
                <Text style={styles.helper}>
                  No unresolved wallet balance is currently preventing a
                  deletion request.
                </Text>
                <Button
                  icon={Trash2}
                  loading={requestDeleteMutation.isPending}
                  onPress={() => {
                    setConfirmVisible(true);
                  }}
                  title="Request account deletion"
                  variant="destructive"
                />
              </Card>
            )}
          </>
        )}
      </QueryCardState>
      {requestDeleteMutation.isError ? (
        <InlineError
          message={normalizeApiError(requestDeleteMutation.error).message}
        />
      ) : null}
      <ConfirmationDialog
        confirmLabel="Request deletion"
        destructive
        message="This starts an account-deletion review. Any unresolved wallet value will still block completion."
        onCancel={() => {
          setConfirmVisible(false);
        }}
        onConfirm={() => {
          setConfirmVisible(false);
          requestDeleteMutation.mutate();
        }}
        title="Request account deletion?"
        visible={confirmVisible}
      />
    </ScrollScreen>
  );
}

function LegalDocumentScreen({
  documentKey,
}: {
  documentKey: LegalDocumentKey;
}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const document = customerLegalDocuments[documentKey];

  return (
    <ScrollScreen testID={`legal-${documentKey}-screen`}>
      <StatusBar hidden />
      <BackHeader
        onPress={() => {
          returnToRouteOr(
            router,
            appRoutes.customerSettings.path,
            params.returnTo,
          );
        }}
        title="Legal"
      />
      <LegalContent title={document.title}>
        <View style={styles.badgeWrap}>
          <StatusBadge label={document.version} tone="info" />
          <StatusBadge label={document.effectiveDateLabel} tone="success" />
        </View>
        {document.sections.map((section) => (
          <View key={section.title} style={styles.legalSection}>
            <Text style={styles.legalSectionTitle}>{section.title}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.helper}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </LegalContent>
    </ScrollScreen>
  );
}

export const TermsOfServiceScreen = () => (
  <LegalDocumentScreen documentKey="terms" />
);

export const PrivacyPolicyScreen = () => (
  <LegalDocumentScreen documentKey="privacy" />
);

export const CommunityGuidelinesScreen = () => (
  <LegalDocumentScreen documentKey="community-guidelines" />
);

export function NotificationLinkBoundaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    destination?: string | string[];
    notificationId?: string | string[];
    ticketId?: string | string[];
  }>();
  const destination = readParam(params.destination);
  const notificationId = readParam(params.notificationId);
  const ticketId = readParam(params.ticketId);
  const markReadMutation = useMarkNotificationReadMutation();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    handledRef.current = true;

    if (destination === undefined) {
      replaceRoute(router, appRoutes.invalidLink.path);
      return;
    }

    const target = resolveNotificationLinkTarget({
      destination,
      params: {
        notificationId,
        ticketId,
      },
    });

    if (target === null) {
      replaceRoute(router, appRoutes.invalidLink.path);
      return;
    }

    const navigate = () => {
      replaceRoute(router, target);
    };

    if (notificationId === undefined) {
      navigate();
      return;
    }

    markReadMutation.mutate(notificationId, {
      onSuccess: () => {
        navigate();
      },
    });
  }, [destination, markReadMutation, notificationId, router, ticketId]);

  return (
    <ScrollScreen testID="notification-link-boundary-screen">
      <Card>
        <Skeleton lines={3} />
      </Card>
    </ScrollScreen>
  );
}

export function SupportTicketLinkBoundaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ticketId?: string | string[] }>();
  const ticketId = readParam(params.ticketId);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    handledRef.current = true;

    if (ticketId === undefined) {
      replaceRoute(router, appRoutes.invalidLink.path);
      return;
    }

    replaceRoute(router, {
      params: { ticketId },
      pathname: appRoutes.customerSupportTicket.path,
    });
  }, [router, ticketId]);

  return (
    <ScrollScreen testID="support-ticket-link-boundary-screen">
      <Card>
        <Skeleton lines={3} />
      </Card>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  attachmentCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  avatarPresetButton: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.lg,
    borderWidth: 1,
    gap: ui.spacing[1],
    minHeight: 96,
    minWidth: 88,
    padding: ui.spacing[2],
  },
  avatarPresetButtonSelected: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.brand.primary,
  },
  avatarPresetLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  avatarPresetLabelSelected: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.bold,
  },
  avatarPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  cardStack: {
    gap: ui.spacing[3],
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  flex: {
    flex: 1,
  },
  glassPressableContent: {
    padding: 0,
  },
  helper: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  heroCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  heroTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  inlineActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  languageCard: {
    alignItems: 'center',
    backgroundColor: ui.glass.surface,
    borderColor: ui.color.brand.primary,
    borderRadius: ui.radii.xl,
    borderWidth: 1.5,
    flexBasis: '47.5%',
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 88,
    overflow: 'hidden',
    paddingHorizontal: ui.spacing[3],
    position: 'relative',
  },
  languageCardCopy: {
    flex: 1,
    gap: ui.spacing[1],
    zIndex: 1,
  },
  languageCardMark: {
    bottom: -18,
    color: ui.color.brand.primarySoft,
    fontFamily: ui.font.bold,
    fontSize: 52,
    lineHeight: 58,
    position: 'absolute',
    right: ui.spacing[2],
  },
  languageCardMarkSelected: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  languageCardSelected: {
    backgroundColor: ui.color.brand.primary,
  },
  languageCardSubtitle: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  languageCardSubtitleSelected: {
    color: ui.color.text.inverse,
    opacity: 0.82,
  },
  languageCardTitle: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  languageCardTitleSelected: {
    color: ui.color.text.inverse,
  },
  languageChip: {
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    minHeight: ui.minTouch,
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[2],
  },
  languageChipSelected: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.brand.primary,
  },
  languageChipText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  languageChipTextSelected: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.bold,
  },
  languageWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  legalSection: {
    borderTopColor: ui.glass.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: ui.spacing[3],
    paddingTop: ui.spacing[4],
  },
  legalSectionTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 17,
    lineHeight: 23,
  },
  languageRadio: {
    alignItems: 'center',
    borderColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    borderWidth: 2.5,
    height: 32,
    justifyContent: 'center',
    width: 32,
    zIndex: 1,
  },
  languageRadioSelected: {
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.borderStrong,
  },
  languageScreenContent: {
    gap: ui.spacing[5],
  },
  listRowCard: {
    borderRadius: ui.radii.xl,
  },
  listRowPressable: {
    padding: ui.spacing[4],
  },
  listRowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  menuRow: {
    borderRadius: ui.radii.xxl,
    minHeight: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  menuRowContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[4],
  },
  menuRowPressable: {
    flex: 1,
  },
  menuIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
  },
  menuIconDestructive: {
    backgroundColor: ui.color.status.errorSoft,
    borderRadius: ui.radii.full,
    height: 36,
  },
  metaText: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'capitalize',
  },
  optionStack: {
    gap: ui.spacing[3],
  },
  plainIconButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: ui.radii.full,
    borderWidth: 0,
    justifyContent: 'center',
    minHeight: ui.minTouch,
    minWidth: ui.minTouch,
  },
  pressed: {
    opacity: ui.opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  profileAvatar: {
    alignItems: 'center',
    borderRadius: ui.radii.full,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    height: '100%',
    width: '100%',
  },
  profileAvatarText: {
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  profileDetailLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  profileDetailValue: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  profileHeroActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  profileHeroButton: {
    flex: 1,
  },
  profileHeroCard: {
    alignItems: 'center',
    gap: ui.spacing[4],
    paddingVertical: ui.spacing[6],
  },
  profileHeroCopy: {
    alignItems: 'center',
    gap: ui.spacing[1],
  },
  profileHeroMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  profileHeroName: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  profileOverviewHero: {
    padding: ui.spacing[5],
  },
  profileOverviewHeroCopy: {
    flex: 1,
    gap: ui.spacing[2],
    minWidth: 0,
  },
  profileOverviewHeroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  profileOverviewEditButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: ui.radii.full,
    borderWidth: 0,
    height: ui.minTouch,
    justifyContent: 'center',
    width: ui.minTouch,
  },
  profileOverviewNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
    minWidth: 0,
  },
  profileOverviewLanguagePill: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[1],
  },
  profileOverviewLanguageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  profileOverviewLanguageText: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  profileOverviewMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  profileOverviewName: {
    color: ui.color.text.primary,
    flexShrink: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  profileOverviewSpotlight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  profileOverviewSpotlightBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  profileOverviewSpotlightIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  profileOverviewSpotlightTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  profileOverviewStatLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  profileOverviewStatRow: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  profileOverviewStatTile: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderColor: 'rgba(255,255,255,0.58)',
    borderRadius: ui.radii.xl,
    borderWidth: 1,
    flex: 1,
    gap: ui.spacing[2],
    minWidth: 0,
    padding: ui.spacing[4],
  },
  profileOverviewStatValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textTransform: 'capitalize',
  },
  profileMenuMeta: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textTransform: 'capitalize',
  },
  profileMenuStack: {
    gap: ui.spacing[4],
  },
  profileScreenContent: {
    flexGrow: 1,
    gap: ui.spacing[4],
  },
  profileScreenTitle: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  profileTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
  },
  rowTitleDanger: {
    color: ui.color.status.error,
  },
  rowTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  safeFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: ui.spacing[8],
  },
  safeFooterText: {
    color: ui.color.status.success,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  settingsFooter: {
    gap: ui.spacing[2],
    marginTop: 'auto',
  },
  settingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
    minHeight: 56,
  },
  settingsScreenContent: {
    flexGrow: 1,
    gap: ui.spacing[4],
  },
  stack: {
    gap: ui.spacing[4],
  },
  trailingColumn: {
    alignItems: 'flex-end',
    gap: ui.spacing[2],
  },
  versionText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  walletPill: {
    alignItems: 'center',
    ...ui.shadow.button,
    backgroundColor: 'rgba(62,111,217,0.58)',
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: 26,
    flexDirection: 'row',
    gap: 7,
    minHeight: 48,
    paddingLeft: 13,
    paddingRight: 6,
  },
  walletPillAdd: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  walletPillText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 16,
    lineHeight: 20,
  },
});
