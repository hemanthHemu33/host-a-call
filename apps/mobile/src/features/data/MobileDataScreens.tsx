import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  Gift,
  IndianRupee,
  Landmark,
  Languages,
  MapPin,
  Phone,
  PhoneIncoming,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  Star,
  Timer,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';

import {
  normalizeApiError,
  queryKeys,
  type CompletedCallRecord,
  type Host,
  type HostDashboard,
  type HostSummary,
  type Money,
  type Report,
  type Withdrawal,
} from '@connecto/domain';

import { getCustomerAvatarOptionsForGender } from '@/assets/avatars/customer-avatars';
import { invalidateDomainQueries } from '@/data/query-client';
import {
  KeyboardScreen,
  ScrollScreen,
  useResponsiveLayout,
} from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Banner } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/fields';
import { floatingTabBarBaseContentInset } from '@/components/ui/FloatingTabBar';
import {
  AppHeader,
  BackHeader,
  SectionHeader,
  WalletHeader,
} from '@/components/ui/navigation';
import {
  Avatar,
  CallHistoryRow,
  Card,
  EmptyState,
  ErrorState,
  HostCard,
  ListRow,
  MetricCard,
  RankBadge,
  Skeleton,
  StatusBadge,
  TransactionRow,
  WalletCard,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import type { IconComponent } from '@/components/ui/types';
import { appRoutes } from '@/navigation/routes';
import { frontendServices } from '@/services/adapters';

import {
  formatMoney,
  mobileDataIds,
  useCustomerProfileQuery,
  useEarningsQuery,
  useHostCallsQuery,
  useHostDashboardQuery,
  useHostProfileQuery,
  useHostsQuery,
  useNotificationsQuery,
  useReportsQuery,
  useTransactionsQuery,
  useWalletQuery,
  useWithdrawalsQuery,
} from './mobileDataHooks';

type QueryBoundaryProps<T> = {
  children: (data: T) => React.ReactNode;
  emptyMessage?: string;
  emptyTitle?: string;
  isEmpty?: (data: T) => boolean;
  query: UseQueryResult<T>;
};

function QueryBoundary<T>({
  children,
  emptyMessage = 'Try a different scenario or refresh this screen.',
  emptyTitle = 'Nothing here yet',
  isEmpty,
  query,
}: QueryBoundaryProps<T>) {
  if (query.isPending) {
    return (
      <Card>
        <Skeleton lines={4} />
      </Card>
    );
  }

  if (query.isError) {
    const error = normalizeApiError(query.error);

    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          void query.refetch();
        }}
        title={error.code === 'offline' ? 'Offline' : 'Could not load'}
      />
    );
  }

  if (query.data === undefined) {
    return (
      <EmptyState
        message="The service returned no readable data."
        title="No data"
      />
    );
  }

  if (isEmpty?.(query.data) === true) {
    return <EmptyState message={emptyMessage} title={emptyTitle} />;
  }

  return <>{children(query.data)}</>;
}

function DataScreenFrame({
  children,
  reserveFloatingTab = false,
  subtitle,
  testID,
  title,
}: {
  children: React.ReactNode;
  reserveFloatingTab?: boolean;
  subtitle: string;
  testID: string;
  title: string;
}) {
  return (
    <ScrollScreen
      bottomContentInset={
        reserveFloatingTab ? floatingTabBarBaseContentInset : 0
      }
      testID={testID}
    >
      <AppHeader subtitle={subtitle} title={title} />
      {children}
    </ScrollScreen>
  );
}

function mutationButtonProps(mutation: { isPending: boolean }): Pick<
  PressableProps,
  'disabled'
> & {
  loading: boolean;
} {
  return {
    disabled: mutation.isPending,
    loading: mutation.isPending,
  };
}

const oneLineDate = (iso: string) => iso.slice(0, 10);

function CallRows({ calls }: { calls: CompletedCallRecord[] }) {
  return (
    <View style={styles.stack}>
      {calls.map((call) => (
        <CallHistoryRow
          description={`${call.mediaMode} call with ${call.host.displayName}, ${String(
            call.timerSnapshot.billableSeconds,
          )} billable seconds`}
          key={call.id}
          meta={formatMoney(call.finalCharge)}
          title={oneLineDate(call.endedAtIso)}
        />
      ))}
    </View>
  );
}

const hostDashboardLeaderboardLimit = 5;
const recentHostCallsForDashboardLimit = 10;

const formatAvailabilityLabel = (
  availability: HostDashboard['host']['availability'],
) => (availability === 'online' ? 'ONLINE' : 'OFFLINE');

const sumCallCharges = (calls: CompletedCallRecord[]) => {
  const currency = calls[0]?.finalCharge.currency ?? 'INR';
  const amountPaise = calls.reduce(
    (total, call) => total + call.finalCharge.amountPaise,
    0,
  );

  return formatMoney({ amountPaise, currency });
};

type HostEarningsLeaderboardItem = {
  earnings: Money;
  host: HostSummary;
  position: number;
};

const estimateHostSummaryEarnings = (host: HostSummary): Money => {
  const blendedRatePaise = Math.round(
    host.voiceRate.amountPaise * 0.72 + host.videoRate.amountPaise * 0.28,
  );

  return {
    amountPaise: host.completedCalls * blendedRatePaise,
    currency: host.voiceRate.currency,
  };
};

const buildHostEarningsLeaderboard = (
  hosts: HostSummary[],
): HostEarningsLeaderboardItem[] =>
  hosts
    .map((host) => ({
      earnings: estimateHostSummaryEarnings(host),
      host,
    }))
    .sort(
      (left, right) => right.earnings.amountPaise - left.earnings.amountPaise,
    )
    .map((item, index) => ({
      ...item,
      position: index + 1,
    }));

const formatVerificationLabel = (
  status: HostDashboard['host']['verificationStatus'],
) =>
  status
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getVerificationTone = (
  status: HostDashboard['host']['verificationStatus'],
): 'error' | 'info' | 'success' | 'warning' => {
  if (status === 'verified') {
    return 'success';
  }

  if (status === 'rejected' || status === 'suspended') {
    return 'error';
  }

  if (status === 'changes-requested' || status === 'under-review') {
    return 'warning';
  }

  return 'info';
};

function HostDashboardWordmark() {
  return (
    <View
      accessibilityLabel="Connecto"
      accessibilityRole="image"
      style={styles.hostDashboardWordmark}
    >
      <Text style={styles.hostDashboardLogo}>Connecto</Text>
      <View style={styles.hostDashboardLogoAccent} />
    </View>
  );
}

function HostHeaderIconButton({
  accessibilityLabel,
  icon: Icon,
  onPress,
  tone = 'default',
}: {
  accessibilityLabel: string;
  icon: IconComponent;
  onPress: () => void;
  tone?: 'default' | 'primary';
}) {
  const color =
    tone === 'primary' ? ui.color.brand.primary : ui.color.text.primary;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={ui.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hostHeaderIconButton,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon color={color} size={34} strokeWidth={2.4} />
    </Pressable>
  );
}

function HostAvailabilityToggle({
  disabled,
  onPress,
  online,
}: {
  disabled: boolean;
  onPress: () => void;
  online: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(online ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
      toValue: online ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [online, progress]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(143,133,140,0.58)', ui.color.brand.primary],
  });
  const knobTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 26],
  });

  return (
    <Pressable
      accessibilityLabel={`Set host ${online ? 'offline' : 'online'}`}
      accessibilityRole="switch"
      accessibilityState={{
        checked: online,
        disabled,
      }}
      disabled={disabled}
      hitSlop={ui.hitSlop}
      onPress={onPress}
      style={[
        styles.hostAvailabilitySwitch,
        disabled ? styles.hostAvailabilitySwitchDisabled : null,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.hostAvailabilitySwitchTrack,
          { backgroundColor: trackColor },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.hostAvailabilityKnob,
          { transform: [{ translateX: knobTranslate }] },
        ]}
      />
    </Pressable>
  );
}

function HostDashboardMetricTile({
  actionAccessibilityLabel,
  label,
  onPress,
  value,
}: {
  actionAccessibilityLabel?: string;
  label: string;
  onPress?: () => void;
  value: string;
}) {
  const content = (
    <Card style={styles.hostDashboardMetricTile}>
      <View style={styles.hostDashboardMetricHeader}>
        <Text style={styles.hostDashboardMetricLabel}>{label}</Text>
        {onPress === undefined ? null : (
          <View style={styles.hostDashboardMetricAction}>
            <ChevronRight
              color={ui.color.brand.primary}
              size={16}
              strokeWidth={2.6}
            />
          </View>
        )}
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.74}
        numberOfLines={1}
        style={styles.hostDashboardMetricValue}
      >
        {value}
      </Text>
    </Card>
  );

  if (onPress === undefined) {
    return content;
  }

  return (
    <Pressable
      accessibilityHint="Opens the detailed earnings screen."
      accessibilityLabel={actionAccessibilityLabel ?? label}
      accessibilityRole="button"
      hitSlop={ui.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hostDashboardMetricPressable,
        pressed ? styles.pressed : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

function HostDashboardLeaderboardRow({
  item,
}: {
  item: HostEarningsLeaderboardItem;
}) {
  const { earnings, host, position } = item;

  return (
    <Card style={styles.hostLeaderboardRow} variant="strong">
      <View style={styles.hostLeaderboardPosition}>
        <Text style={styles.hostLeaderboardPositionText}>
          {String(position)}
        </Text>
      </View>
      <Avatar
        label={host.displayName}
        size="sm"
        {...(host.profileImageUri === undefined
          ? {}
          : { source: { uri: host.profileImageUri } })}
      />
      <View style={styles.flex}>
        <View style={styles.hostLeaderboardNameRow}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            style={styles.hostLeaderboardName}
          >
            {host.displayName}
          </Text>
          <RankBadge rank={host.rank} />
        </View>
        <Text style={styles.hostLeaderboardMeta}>
          {String(host.completedCalls)} calls · {host.language}
        </Text>
      </View>
      <View style={styles.hostLeaderboardEarnings}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.hostLeaderboardAmount}
        >
          {formatMoney(earnings)}
        </Text>
        <Text style={styles.hostLeaderboardCaption}>Earnings</Text>
      </View>
    </Card>
  );
}

function HostDashboardCurrentPositionCard({
  item,
}: {
  item: HostEarningsLeaderboardItem;
}) {
  return (
    <Card style={styles.hostLeaderboardCurrentPositionCard} variant="strong">
      <View style={styles.hostLeaderboardCurrentPositionNumber}>
        <Text style={styles.hostLeaderboardCurrentPositionNumberText}>
          #{String(item.position)}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.hostLeaderboardCurrentPositionEyebrow}>
          YOUR LEADERBOARD POSITION
        </Text>
        <View style={styles.hostLeaderboardNameRow}>
          <Text numberOfLines={1} style={styles.hostLeaderboardName}>
            {item.host.displayName}
          </Text>
          <RankBadge rank={item.host.rank} />
        </View>
      </View>
      <View style={styles.hostLeaderboardEarnings}>
        <Text style={styles.hostLeaderboardAmount}>
          {formatMoney(item.earnings)}
        </Text>
        <Text style={styles.hostLeaderboardCaption}>Earnings</Text>
      </View>
    </Card>
  );
}

const hostWithdrawalQuickAmounts = [50, 100, 200, 300] as const;
const hostWithdrawalMinimumPaise = 5000;
const hostWithdrawalDefaultRupees = '100';
const hostFastWithdrawalDefaultUpiId = 'anjali@upi';
const hostVoiceCallRateLabel = 'INR 10/min';
const hostVideoCallRateLabel = 'INR 15/min';
const hostUpiIdPattern = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{2,64}$/;
const hostAvatarOptions = getCustomerAvatarOptionsForGender('woman');
const recentHostCallsLimit = 8;

type HostRecentCallCardItem = {
  customerName: string;
  dateLabel: string;
  durationLabel: string;
  earnedAmountLabel: string;
  id: string;
  modeLabel: string;
  timeLabel: string;
};

const formatHostRecentCallDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${String(remainingSeconds)} sec`;
  }

  if (remainingSeconds === 0) {
    return `${String(minutes)} min`;
  }

  return `${String(minutes)} min ${String(remainingSeconds).padStart(2, '0')} sec`;
};

const formatHostRecentCallDateTime = (iso: string) => {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return { dateLabel: day, timeLabel: time };
};

const formatHostRecentCallAmount = (money: Money) =>
  new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(money.amountPaise / 100);

const formatHostNotifyTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

const hostRecentCallSamples: readonly HostRecentCallCardItem[] = [
  {
    customerName: 'Hemanth',
    dateLabel: '03 Aug',
    durationLabel: '3 min 12 sec',
    earnedAmountLabel: '32',
    id: 'sample-host-recent-1',
    modeLabel: 'Voice call',
    timeLabel: '8:45 pm',
  },
  {
    customerName: 'Kavya',
    dateLabel: '03 Aug',
    durationLabel: '6 min 20 sec',
    earnedAmountLabel: '54',
    id: 'sample-host-recent-2',
    modeLabel: 'Video call',
    timeLabel: '6:10 pm',
  },
  {
    customerName: 'Rohit',
    dateLabel: '02 Aug',
    durationLabel: '2 min 44 sec',
    earnedAmountLabel: '24',
    id: 'sample-host-recent-3',
    modeLabel: 'Voice call',
    timeLabel: '9:30 pm',
  },
  {
    customerName: 'Meghana',
    dateLabel: '02 Aug',
    durationLabel: '4 min 08 sec',
    earnedAmountLabel: '41',
    id: 'sample-host-recent-4',
    modeLabel: 'Voice call',
    timeLabel: '7:05 pm',
  },
  {
    customerName: 'Aarav',
    dateLabel: '01 Aug',
    durationLabel: '5 min 16 sec',
    earnedAmountLabel: '62',
    id: 'sample-host-recent-5',
    modeLabel: 'Video call',
    timeLabel: '10:25 pm',
  },
];

const buildHostRecentCalls = (
  calls: CompletedCallRecord[],
): HostRecentCallCardItem[] => {
  const realCalls = calls.slice(0, recentHostCallsLimit).map((call) => ({
    customerName: call.customer.displayName,
    ...formatHostRecentCallDateTime(call.endedAtIso),
    durationLabel: formatHostRecentCallDuration(
      call.timerSnapshot.connectedSeconds,
    ),
    earnedAmountLabel: formatHostRecentCallAmount(call.finalCharge),
    id: call.id,
    modeLabel: call.mediaMode === 'video' ? 'Video call' : 'Voice call',
  }));
  const sampleCount = Math.max(0, recentHostCallsLimit - realCalls.length);

  return [...realCalls, ...hostRecentCallSamples.slice(0, sampleCount)].slice(
    0,
    recentHostCallsLimit,
  );
};

function HostRecentCallCard({
  call,
  notifiedAtLabel,
  onNotify,
}: {
  call: HostRecentCallCardItem;
  notifiedAtLabel: string | undefined;
  onNotify: () => void;
}) {
  return (
    <Card style={styles.hostRecentCallCard} variant="strong">
      <View style={styles.hostRecentCallHeader}>
        <View style={styles.hostRecentCallIdentity}>
          <Avatar label={call.customerName} size="md" />
          <View style={styles.hostRecentCallCopy}>
            <Text numberOfLines={1} style={styles.hostRecentCallName}>
              {call.customerName}
            </Text>
            <View style={styles.hostRecentCallModeBadge}>
              <Text style={styles.hostRecentCallModeText}>
                {call.modeLabel}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.hostRecentCallEarnings}>
          <IndianRupee
            color={ui.color.brand.primary}
            size={15}
            strokeWidth={2.6}
          />
          <Text style={styles.hostRecentCallEarningsText}>
            {call.earnedAmountLabel}
          </Text>
        </View>
      </View>

      <View style={styles.hostRecentCallMetaGrid}>
        <View style={styles.hostRecentCallMetaTile}>
          <Calendar
            color={ui.color.brand.primary}
            size={16}
            strokeWidth={2.4}
          />
          <View style={styles.hostRecentCallMetaCopy}>
            <Text style={styles.hostRecentCallMetaLabel}>Date</Text>
            <Text numberOfLines={1} style={styles.hostRecentCallMetaValue}>
              {call.dateLabel}
            </Text>
          </View>
        </View>
        <View style={styles.hostRecentCallMetaTile}>
          <Clock3 color={ui.color.brand.primary} size={16} strokeWidth={2.4} />
          <View style={styles.hostRecentCallMetaCopy}>
            <Text style={styles.hostRecentCallMetaLabel}>Time</Text>
            <Text numberOfLines={1} style={styles.hostRecentCallMetaValue}>
              {call.timeLabel}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.hostRecentCallMetaTile,
            styles.hostRecentCallMetaTileDuration,
          ]}
        >
          <Timer color={ui.color.brand.primary} size={16} strokeWidth={2.4} />
          <View style={styles.hostRecentCallMetaCopy}>
            <Text style={styles.hostRecentCallMetaLabel}>Duration</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.76}
              numberOfLines={1}
              style={styles.hostRecentCallMetaValue}
            >
              {call.durationLabel}
            </Text>
          </View>
        </View>
      </View>

      {notifiedAtLabel === undefined ? (
        <Button
          icon={Bell}
          onPress={onNotify}
          style={styles.hostRecentCallNotifyButton}
          testID={`host-recent-notify-${call.id}`}
          title="Notify user"
          variant="tonal"
        />
      ) : (
        <View style={styles.hostRecentCallNotifiedState}>
          <Bell color={ui.color.brand.primary} size={16} strokeWidth={2.4} />
          <Text style={styles.hostRecentCallNotifiedText}>
            Notified at {notifiedAtLabel}
          </Text>
        </View>
      )}
    </Card>
  );
}
const hostDefaultAvatarUri =
  hostAvatarOptions[0]?.uri ?? 'asset://connecto/customer-avatar/female/01';

type HostWithdrawalAmountValidation =
  { kind: 'invalid'; message: string } | { kind: 'valid'; money: Money };
type HostWithdrawalPayoutMethod = 'bank' | 'upi';

type HostPayoutAccount = {
  accountNumberLast4: string;
  bankName: string;
  holderName: string;
  id: string;
  ifsc: string;
  primary: boolean;
};

type HostProfileDetail = {
  Icon: IconComponent;
  label: string;
  value: string;
};

type HostProfileEditDraft = {
  displayName: string;
  profileImageUri: string;
};

const readParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const hostBankAccountAddRoute = (returnTo: string) => ({
  params: { returnTo },
  pathname: appRoutes.hostBankAccountAdd.path,
});

const initialHostPayoutAccounts: HostPayoutAccount[] = [
  {
    accountNumberLast4: '4821',
    bankName: 'HDFC Bank',
    holderName: 'Anjali Sharma',
    id: 'host-payout-bank-1',
    ifsc: 'HDFC0004218',
    primary: true,
  },
  {
    accountNumberLast4: '9074',
    bankName: 'ICICI Bank',
    holderName: 'Anjali Sharma',
    id: 'host-payout-bank-2',
    ifsc: 'ICIC0001122',
    primary: false,
  },
];

const hostPayoutAccountsQueryKey = [
  'host',
  mobileDataIds.hostId,
  'payout-accounts',
] as const;

const useHostPayoutAccountsQuery = () =>
  useQuery({
    initialData: initialHostPayoutAccounts,
    queryFn: () => initialHostPayoutAccounts,
    queryKey: hostPayoutAccountsQueryKey,
    staleTime: Infinity,
  });

const withPrimaryHostPayoutAccount = (
  accounts: HostPayoutAccount[],
  primaryId: string,
) =>
  accounts.map((account) => ({
    ...account,
    primary: account.id === primaryId,
  }));

const addHostPayoutAccount = ({
  account,
  accounts,
  makePrimary,
}: {
  account: HostPayoutAccount;
  accounts: HostPayoutAccount[];
  makePrimary: boolean;
}) => [
  ...accounts.map((existing) => ({
    ...existing,
    primary: makePrimary ? false : existing.primary,
  })),
  account,
];

const createInrMoney = (amountPaise: number): Money => ({
  amountPaise: Math.max(0, Math.trunc(amountPaise)),
  currency: 'INR',
});

const parseHostUpiId = (value: string) => {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return {
      kind: 'invalid' as const,
      message: 'Enter a UPI ID for fast withdrawal.',
    };
  }

  if (!hostUpiIdPattern.test(normalized)) {
    return {
      kind: 'invalid' as const,
      message: 'Enter a valid UPI ID, for example name@bank.',
    };
  }

  return { kind: 'valid' as const, upiId: normalized };
};

const parseHostWithdrawalAmount = (
  value: string,
  available: Money | undefined,
): HostWithdrawalAmountValidation => {
  const normalized = value.trim().replace(/[,\s]/g, '');

  if (normalized.length === 0) {
    return {
      kind: 'invalid',
      message: 'Enter an amount to withdraw.',
    };
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      kind: 'invalid',
      message: 'Use whole rupees only.',
    };
  }

  const amountPaise = Number(normalized) * 100;

  if (!Number.isSafeInteger(amountPaise)) {
    return {
      kind: 'invalid',
      message: 'Enter a smaller amount.',
    };
  }

  if (amountPaise < hostWithdrawalMinimumPaise) {
    return {
      kind: 'invalid',
      message: `Minimum withdrawal is ${formatMoney(
        createInrMoney(hostWithdrawalMinimumPaise),
      )}.`,
    };
  }

  if (available !== undefined && amountPaise > available.amountPaise) {
    return {
      kind: 'invalid',
      message: `Available balance is ${formatMoney(available)}.`,
    };
  }

  return { kind: 'valid', money: createInrMoney(amountPaise) };
};

const withdrawalStatusLabel = (status: Withdrawal['status']) =>
  status
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const withdrawalStatusTone = (
  status: Withdrawal['status'],
): 'error' | 'info' | 'success' | 'warning' => {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'failed' || status === 'cancelled') {
    return 'error';
  }

  if (status === 'requested' || status === 'compliance-review') {
    return 'warning';
  }

  return 'info';
};

function HostWithdrawalQuickAmount({
  amount,
  disabled,
  onPress,
  selected,
}: {
  amount: number;
  disabled: boolean;
  onPress: (amount: number) => void;
  selected: boolean;
}) {
  const money = createInrMoney(amount * 100);

  return (
    <Card
      style={[
        styles.hostWithdrawalQuickCard,
        selected ? styles.hostWithdrawalQuickCardSelected : null,
        disabled ? styles.hostWithdrawalQuickCardDisabled : null,
      ]}
      variant="strong"
    >
      <Pressable
        accessibilityLabel={`Withdraw ${formatMoney(money)}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        hitSlop={ui.hitSlop}
        onPress={() => {
          onPress(amount);
        }}
        style={({ pressed }) => [
          styles.hostWithdrawalQuickPressable,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text
          style={[
            styles.hostWithdrawalQuickText,
            selected ? styles.hostWithdrawalQuickTextSelected : null,
          ]}
        >
          {formatMoney(money)}
        </Text>
      </Pressable>
    </Card>
  );
}

function HostPayoutAccountCard({
  account,
  compact = false,
  onMakePrimary,
}: {
  account: HostPayoutAccount;
  compact?: boolean;
  onMakePrimary?: (accountId: string) => void;
}) {
  return (
    <Card
      style={[
        styles.hostPayoutAccountCard,
        compact ? styles.hostPayoutAccountCardCompact : null,
        onMakePrimary === undefined
          ? null
          : styles.hostPayoutAccountCardSelectable,
      ]}
      variant="strong"
    >
      {onMakePrimary === undefined ? null : (
        <Pressable
          accessibilityLabel={
            account.primary
              ? `${account.bankName} is the primary bank account`
              : `Make ${account.bankName} primary`
          }
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: account.primary,
            disabled: account.primary,
          }}
          disabled={account.primary}
          hitSlop={ui.hitSlop}
          onPress={() => {
            onMakePrimary(account.id);
          }}
          style={({ pressed }) => [
            styles.hostPayoutPrimaryControl,
            pressed ? styles.pressed : null,
          ]}
          testID={`host-payout-primary-${account.id}`}
        >
          <View
            style={[
              styles.hostPayoutPrimaryCheckbox,
              account.primary ? styles.hostPayoutPrimaryCheckboxChecked : null,
            ]}
          >
            {account.primary ? (
              <Check color={ui.color.text.inverse} size={17} strokeWidth={3} />
            ) : null}
          </View>
        </Pressable>
      )}
      <View style={styles.hostWithdrawalIconBubble}>
        <Landmark color={ui.color.brand.primary} size={24} />
      </View>
      <View style={styles.flex}>
        <View style={styles.hostPayoutAccountHeader}>
          <Text style={styles.hostPayoutAccountTitle}>{account.bankName}</Text>
          {account.primary ? (
            <StatusBadge label="Primary" tone="success" />
          ) : null}
        </View>
        <Text style={styles.hostPayoutAccountMeta}>
          {account.holderName} - Account ending {account.accountNumberLast4}
        </Text>
        <Text style={styles.hostWithdrawalHelper}>IFSC {account.ifsc}</Text>
      </View>
    </Card>
  );
}

function HostWithdrawalPayoutMethodOption({
  Icon,
  description,
  label,
  method,
  onPress,
  selected,
}: {
  Icon: IconComponent;
  description: string;
  label: string;
  method: HostWithdrawalPayoutMethod;
  onPress: (method: HostWithdrawalPayoutMethod) => void;
  selected: boolean;
}) {
  return (
    <Card
      style={[
        styles.hostWithdrawalMethodCard,
        selected ? styles.hostWithdrawalMethodCardSelected : null,
      ]}
      variant="strong"
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        hitSlop={ui.hitSlop}
        onPress={() => {
          onPress(method);
        }}
        style={({ pressed }) => [
          styles.hostWithdrawalMethodPressable,
          pressed ? styles.pressed : null,
        ]}
      >
        <View
          style={[
            styles.hostWithdrawalMethodIcon,
            selected ? styles.hostWithdrawalMethodIconSelected : null,
          ]}
        >
          <Icon
            color={selected ? ui.color.text.inverse : ui.color.brand.primary}
            size={22}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.hostWithdrawalMethodTitle}>{label}</Text>
          <Text style={styles.hostWithdrawalMethodDescription}>
            {description}
          </Text>
        </View>
        <View
          style={[
            styles.hostWithdrawalMethodRadio,
            selected ? styles.hostWithdrawalMethodRadioSelected : null,
          ]}
        >
          {selected ? (
            <View style={styles.hostWithdrawalMethodRadioDot} />
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
}

function HostWithdrawalPayoutCard({
  accounts,
  method,
  onMethodChange,
  onUpiIdChange,
  upiErrorText,
  upiId,
}: {
  accounts: HostPayoutAccount[];
  method: HostWithdrawalPayoutMethod;
  onMethodChange: (method: HostWithdrawalPayoutMethod) => void;
  onUpiIdChange: (value: string) => void;
  upiErrorText?: string;
  upiId: string;
}) {
  const primaryAccount =
    accounts.find((account) => account.primary) ?? accounts[0];

  return (
    <View style={styles.hostWithdrawalPayoutSection}>
      <SectionHeader
        subtitle="Use UPI for fast withdrawal or send it to a saved bank account."
        title="Payout method"
      />
      <HostWithdrawalPayoutMethodOption
        Icon={Smartphone}
        description="Fastest route after backend review."
        label="Fast UPI"
        method="upi"
        onPress={onMethodChange}
        selected={method === 'upi'}
      />
      {method === 'upi' ? (
        <TextField
          {...(upiErrorText === undefined ? {} : { errorText: upiErrorText })}
          helperText="We will send the approved withdrawal to this UPI ID."
          inputMode="email"
          label="UPI ID"
          onChangeText={onUpiIdChange}
          placeholder="name@bank"
          testID="host-withdrawal-upi-id"
          value={upiId}
        />
      ) : null}
      <HostWithdrawalPayoutMethodOption
        Icon={Landmark}
        description={
          primaryAccount === undefined
            ? 'Add a bank account from profile.'
            : `Primary bank account ending ${primaryAccount.accountNumberLast4}.`
        }
        label="Bank account"
        method="bank"
        onPress={onMethodChange}
        selected={method === 'bank'}
      />
      {primaryAccount === undefined ? null : (
        <HostPayoutAccountCard account={primaryAccount} compact />
      )}
      <Text style={styles.hostWithdrawalHelper}>
        Requests are reviewed before processing. UPI withdrawals usually settle
        faster after approval.
      </Text>
    </View>
  );
}

function HostProfileDetailRow({ detail }: { detail: HostProfileDetail }) {
  const Icon = detail.Icon;

  return (
    <Card style={styles.hostProfileDetailCard} variant="strong">
      <View style={styles.hostProfileDetailIcon}>
        <Icon color={ui.color.brand.primary} size={21} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.hostProfileDetailLabel}>{detail.label}</Text>
        <Text style={styles.hostProfileDetailValue}>{detail.value}</Text>
      </View>
    </Card>
  );
}

function HostProfileEditForm({
  accounts,
  draft,
  onAddBankAccount,
  onDraftChange,
  onMakePrimary,
}: {
  accounts: HostPayoutAccount[];
  draft: HostProfileEditDraft;
  onAddBankAccount: () => void;
  onDraftChange: (draft: HostProfileEditDraft) => void;
  onMakePrimary: (accountId: string) => void;
}) {
  const { readableContentWidth } = useResponsiveLayout();
  const [primaryLanguage, setPrimaryLanguage] = useState('Telugu');
  const [secondaryLanguage, setSecondaryLanguage] = useState('English');
  const [city, setCity] = useState('Hyderabad');
  const [upiId, setUpiId] = useState(hostFastWithdrawalDefaultUpiId);
  const avatarOptionWidth = Math.floor(
    (readableContentWidth - ui.spacing[5] * 2 - ui.spacing[3] * 2) / 3,
  );
  const profileAvatarSize = Math.min(
    160,
    Math.max(128, Math.round(readableContentWidth * 0.38)),
  );
  const avatarOptionSize = Math.min(
    88,
    Math.max(72, avatarOptionWidth - ui.spacing[2] * 2),
  );

  return (
    <View style={styles.hostProfileEditStack}>
      <Card style={styles.hostProfileEditSection} variant="strong">
        <View style={styles.hostProfileEditSectionHeader}>
          <Text style={styles.hostProfileEditSectionTitle}>
            Personal details
          </Text>
          <Text style={styles.hostProfileEditSectionSubtitle}>
            Public profile details customers see before starting a call.
          </Text>
        </View>

        <View style={styles.hostAvatarEditRow}>
          <Avatar
            label={draft.displayName}
            size={profileAvatarSize}
            source={{ uri: draft.profileImageUri }}
          />
          <View style={styles.flex}>
            <Text style={styles.hostProfileSpotlightTitle}>Profile avatar</Text>
            <Text style={styles.hostProfileSpotlightBody}>
              Choose the avatar shown on dashboard, search, and profile.
            </Text>
          </View>
        </View>

        <View style={styles.hostAvatarPresetGrid}>
          {hostAvatarOptions.map((avatar) => {
            const selected = draft.profileImageUri === avatar.uri;

            return (
              <Pressable
                accessibilityLabel={`Use ${avatar.label} avatar`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={avatar.uri}
                onPress={() => {
                  onDraftChange({
                    ...draft,
                    profileImageUri: avatar.uri,
                  });
                }}
                style={({ pressed }) => [
                  styles.hostAvatarPresetButton,
                  {
                    minHeight: avatarOptionSize + 42,
                    width: avatarOptionWidth,
                  },
                  selected ? styles.hostAvatarPresetButtonSelected : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`host-profile-avatar-${avatar.gender}-${avatar.id}`}
              >
                <Avatar
                  label={draft.displayName}
                  size={avatarOptionSize}
                  source={{ uri: avatar.uri }}
                />
                <Text
                  style={[
                    styles.hostAvatarPresetLabel,
                    selected ? styles.hostAvatarPresetLabelSelected : null,
                  ]}
                >
                  {avatar.id}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Display name"
          onChangeText={(value) => {
            onDraftChange({
              ...draft,
              displayName: value,
            });
          }}
          placeholder="Name shown to customers"
          value={draft.displayName}
        />
        <TextField
          label="Primary language"
          onChangeText={setPrimaryLanguage}
          placeholder="Primary language"
          value={primaryLanguage}
        />
        <TextField
          label="Secondary language"
          onChangeText={setSecondaryLanguage}
          placeholder="Secondary language"
          value={secondaryLanguage}
        />
        <TextField
          label="City"
          onChangeText={setCity}
          placeholder="Current city"
          value={city}
        />
      </Card>

      <Card style={styles.hostProfileEditSection} variant="strong">
        <View style={styles.hostProfileEditSectionHeader}>
          <Text style={styles.hostProfileEditSectionTitle}>
            Banking details
          </Text>
          <Text style={styles.hostProfileEditSectionSubtitle}>
            Keep UPI and up to 2 bank accounts ready for withdrawal review.
          </Text>
        </View>
        <TextField
          autoCapitalize="none"
          inputMode="email"
          label="Fast withdrawal UPI ID"
          onChangeText={setUpiId}
          placeholder="name@bank"
          value={upiId}
        />
        <View style={styles.hostProfileBankStack}>
          {accounts.map((account) => (
            <HostPayoutAccountCard
              account={account}
              key={account.id}
              onMakePrimary={onMakePrimary}
            />
          ))}
        </View>
        <Button
          icon={Plus}
          onPress={onAddBankAccount}
          testID="host-add-bank-account"
          title="Add bank account"
          variant="secondary"
        />
      </Card>
    </View>
  );
}

function HostWithdrawalHistoryRow({ withdrawal }: { withdrawal: Withdrawal }) {
  return (
    <Card style={styles.hostWithdrawalHistoryCard} variant="strong">
      <View style={styles.hostWithdrawalIconBubble}>
        <IndianRupee color={ui.color.brand.primary} size={22} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.hostWithdrawalHistoryTitle}>
          {formatMoney(withdrawal.amount)}
        </Text>
        <Text style={styles.hostWithdrawalHistoryMeta}>
          Requested {oneLineDate(withdrawal.requestedAtIso)}
        </Text>
      </View>
      <StatusBadge
        label={withdrawalStatusLabel(withdrawal.status)}
        tone={withdrawalStatusTone(withdrawal.status)}
      />
    </Card>
  );
}

export function CustomerHomeScreen() {
  const router = useRouter();
  const hosts = useHostsQuery();
  const wallet = useWalletQuery();

  return (
    <DataScreenFrame
      subtitle="Hosts and wallet state come from frontendServices."
      testID="customer-home-data-screen"
      title="Find a host"
    >
      <QueryBoundary query={wallet}>
        {(walletData) => (
          <WalletCard
            balance={formatMoney(walletData.balance)}
            onPress={() => {
              router.push(appRoutes.customerAddMoney.path);
            }}
          />
        )}
      </QueryBoundary>

      <SectionHeader
        actionLabel="Filters"
        onAction={() => {
          router.push(appRoutes.customerFilters.path);
        }}
        subtitle="Mock mode supports empty, offline, and partial-data scenarios."
        title="Available hosts"
      />
      <QueryBoundary
        emptyMessage="Switch host availability in developer scenarios."
        emptyTitle="No hosts available"
        isEmpty={(data) => data.length === 0}
        query={hosts}
      >
        {(hostList) => (
          <View style={styles.stack}>
            {hostList.map((host) => (
              <HostCard
                key={host.id}
                language={host.language}
                name={host.displayName}
                rank={host.rank}
                rate="Rs 10/min"
                status={host.availability}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </DataScreenFrame>
  );
}

export function CustomerWalletScreen() {
  const router = useRouter();
  const wallet = useWalletQuery();
  const transactions = useTransactionsQuery();

  return (
    <DataScreenFrame
      subtitle="Balance and ledger are cached through TanStack Query."
      testID="customer-wallet-data-screen"
      title="Wallet"
    >
      <QueryBoundary query={wallet}>
        {(walletData) => (
          <WalletHeader
            balance={formatMoney(walletData.balance)}
            onPress={() => {
              router.push(appRoutes.customerAddMoney.path);
            }}
          />
        )}
      </QueryBoundary>

      <SectionHeader title="Transactions" />
      <QueryBoundary
        emptyTitle="No transactions"
        isEmpty={(data) => data.length === 0}
        query={transactions}
      >
        {(items) => (
          <View style={styles.stack}>
            {items.map((transaction) => (
              <TransactionRow
                description={`${transaction.type} · ${oneLineDate(
                  transaction.occurredAtIso,
                )}`}
                key={transaction.id}
                meta={formatMoney(transaction.amount)}
                title={transaction.referenceId}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </DataScreenFrame>
  );
}

export function CustomerProfileScreen() {
  const profile = useCustomerProfileQuery();
  const notifications = useNotificationsQuery();

  return (
    <DataScreenFrame
      subtitle="Profile and notifications are service-backed."
      testID="customer-profile-data-screen"
      title="Profile"
    >
      <QueryBoundary query={profile}>
        {(customer) => (
          <Card style={styles.profileCard}>
            <Avatar
              label={customer.displayName}
              size="lg"
              {...(customer.profileImageUri === undefined
                ? {}
                : { source: { uri: customer.profileImageUri } })}
            />
            <View style={styles.flex}>
              <Text style={styles.title}>{customer.displayName}</Text>
              <Text style={styles.body}>
                Languages: {customer.preferredLanguages.join(', ')}
              </Text>
              {customer.gender === undefined ? null : (
                <Text style={styles.body}>Gender: {customer.gender}</Text>
              )}
              {customer.dateOfBirthIso === undefined ? null : (
                <Text style={styles.body}>
                  Date of birth: {customer.dateOfBirthIso}
                </Text>
              )}
              <Text style={styles.body}>
                Notifications: {customer.notificationPermission}
              </Text>
              <StatusBadge
                label={customer.ageConfirmed ? 'age confirmed' : 'age pending'}
                tone={customer.ageConfirmed ? 'success' : 'warning'}
              />
            </View>
          </Card>
        )}
      </QueryBoundary>

      <SectionHeader title="Notifications" />
      <QueryBoundary
        emptyTitle="No notifications"
        isEmpty={(data) => data.length === 0}
        query={notifications}
      >
        {(items) => (
          <View style={styles.stack}>
            {items.map((notification) => (
              <ListRow
                description={notification.body}
                icon={Bell}
                key={notification.id}
                meta={oneLineDate(notification.createdAtIso)}
                title={notification.title}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </DataScreenFrame>
  );
}

export function CustomerAddMoneyScreen() {
  const queryClient = useQueryClient();
  const payment = useMutation({
    mutationFn: () =>
      frontendServices.payment.createPayment({
        amount: { amountPaise: 25000, currency: 'INR' },
        customerId: mobileDataIds.customerId,
      }),
    onSuccess: async () => {
      await invalidateDomainQueries(queryClient, 'payment');
    },
  });

  return (
    <DataScreenFrame
      subtitle="Payment creation is mocked through the payment service."
      testID="customer-add-money-data-screen"
      title="Add money"
    >
      <MetricCard label="Top-up amount" value="₹250" />
      <Button
        {...mutationButtonProps(payment)}
        icon={IndianRupee}
        onPress={() => {
          payment.mutate();
        }}
        title="Create payment order"
      />
      {payment.isError ? (
        <Banner
          message={normalizeApiError(payment.error).message}
          title="Payment failed"
          tone="error"
        />
      ) : null}
      {payment.data === undefined ? null : (
        <Card style={styles.stack}>
          <Text style={styles.title}>Order {payment.data.providerOrderId}</Text>
          <StatusBadge label={payment.data.status} tone="info" />
        </Card>
      )}
    </DataScreenFrame>
  );
}

export function CustomerPaymentStatesScreen() {
  const queryClient = useQueryClient();
  const payment = useMutation({
    mutationFn: () =>
      frontendServices.payment.verifyPayment({
        paymentId: mobileDataIds.paymentId,
      }),
    onSuccess: async () => {
      await invalidateDomainQueries(queryClient, 'payment');
    },
  });

  return (
    <DataScreenFrame
      subtitle="Switch payment result from developer scenarios."
      testID="customer-payment-states-data-screen"
      title="Payment result"
    >
      <Button
        {...mutationButtonProps(payment)}
        onPress={() => {
          payment.mutate();
        }}
        title="Verify latest payment"
      />
      {payment.isError ? (
        <Banner
          message={normalizeApiError(payment.error).message}
          title="Verification failed"
          tone="error"
        />
      ) : null}
      {payment.data === undefined ? (
        <EmptyState
          message="Run verification to load the current mock result."
          title="Awaiting payment result"
        />
      ) : (
        <Card style={styles.stack}>
          <Text style={styles.title}>{formatMoney(payment.data.amount)}</Text>
          <StatusBadge
            label={payment.data.status}
            tone={payment.data.status === 'success' ? 'success' : 'warning'}
          />
        </Card>
      )}
    </DataScreenFrame>
  );
}

export function HostDashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dashboard = useHostDashboardQuery();
  const hostCalls = useHostCallsQuery();
  const hosts = useHostsQuery();
  const updateAvailability = useMutation({
    mutationFn: (availability: HostDashboard['host']['availability']) =>
      frontendServices.host.updateAvailability({
        availability,
        hostId: mobileDataIds.hostId,
      }),
    onSuccess: async () => {
      await invalidateDomainQueries(queryClient, 'host');
    },
  });

  return (
    <ScrollScreen
      bottomContentInset={floatingTabBarBaseContentInset}
      contentStyle={styles.hostDashboardContent}
      testID="host-dashboard-data-screen"
    >
      <View style={styles.hostDashboardTopBar}>
        <HostDashboardWordmark />
        <HostHeaderIconButton
          accessibilityLabel="Open settings"
          icon={Settings}
          onPress={() => {
            router.push(appRoutes.hostSettings.path);
          }}
        />
      </View>

      <QueryBoundary query={dashboard}>
        {(data) => {
          const online = data.host.availability === 'online';
          const recentCalls = (hostCalls.data ?? []).slice(
            0,
            recentHostCallsForDashboardLimit,
          );
          const todayEarnings =
            recentCalls.length > 0
              ? sumCallCharges(recentCalls)
              : formatMoney(data.earnings.weekToDate);

          return (
            <View style={styles.hostDashboardStack}>
              <Card style={styles.hostDashboardHero} variant="strong">
                <View style={styles.hostDashboardHeroTop}>
                  <Avatar
                    label={data.host.displayName}
                    size="lg"
                    {...(data.host.profileImageUri === undefined
                      ? {}
                      : { source: { uri: data.host.profileImageUri } })}
                  />
                  <View style={styles.hostAvailabilityControl}>
                    <HostAvailabilityToggle
                      disabled={updateAvailability.isPending}
                      onPress={() => {
                        updateAvailability.mutate(online ? 'paused' : 'online');
                      }}
                      online={online}
                    />
                    <Text style={styles.hostAvailabilityText}>
                      {formatAvailabilityLabel(data.host.availability)}
                    </Text>
                  </View>
                </View>

                <View style={styles.hostDashboardHeroCopy}>
                  <Text numberOfLines={1} style={styles.hostWelcomeText}>
                    Welcome Back {data.host.displayName}
                  </Text>
                  <RankBadge rank={data.host.rank} />
                </View>
              </Card>

              <Card style={styles.hostIncomingCallCard} variant="strong">
                <View style={styles.hostIncomingCallRow}>
                  <View style={styles.hostIncomingCallIcon}>
                    <PhoneIncoming color={ui.color.brand.primary} size={24} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.hostIncomingCallTitle}>
                      Incoming voice call
                    </Text>
                    <Text style={styles.hostIncomingCallMeta}>
                      Hemanth - Telugu - {hostVoiceCallRateLabel}
                    </Text>
                  </View>
                </View>
                <Button
                  icon={PhoneIncoming}
                  onPress={() => {
                    router.push(appRoutes.callIncoming.path);
                  }}
                  testID="host-dashboard-open-incoming-call"
                  title="Open call"
                />
              </Card>

              <View style={styles.hostDashboardMetricRow}>
                <HostDashboardMetricTile
                  label="Today Earnings"
                  value={todayEarnings}
                />
                <HostDashboardMetricTile
                  actionAccessibilityLabel="Open total earnings details"
                  label="Total Earnings"
                  onPress={() => {
                    router.push(appRoutes.hostEarnings.path);
                  }}
                  value={formatMoney(data.earnings.lifetime)}
                />
              </View>

              <View style={styles.hostRecentSection}>
                <SectionHeader
                  subtitle="Other hosts ranked by mock earning totals."
                  title="Host Earnings Leaderboard"
                />
                <QueryBoundary
                  emptyMessage="Other host earnings will appear here."
                  emptyTitle="No leaderboard yet"
                  isEmpty={(items) =>
                    buildHostEarningsLeaderboard(items).length === 0
                  }
                  query={hosts}
                >
                  {(items) => {
                    const leaderboard = buildHostEarningsLeaderboard(items);
                    const currentHostItem = leaderboard.find(
                      (item) => item.host.id === data.host.id,
                    );
                    const otherHosts = leaderboard
                      .filter((item) => item.host.id !== data.host.id)
                      .slice(0, hostDashboardLeaderboardLimit);

                    return (
                      <View style={styles.hostLeaderboardList}>
                        {currentHostItem === undefined ? null : (
                          <HostDashboardCurrentPositionCard
                            item={currentHostItem}
                          />
                        )}
                        {otherHosts.map((item) => (
                          <HostDashboardLeaderboardRow
                            item={item}
                            key={item.host.id}
                          />
                        ))}
                      </View>
                    );
                  }}
                </QueryBoundary>
              </View>
            </View>
          );
        }}
      </QueryBoundary>
    </ScrollScreen>
  );
}

export function HostRecentScreen() {
  const router = useRouter();
  const hostCalls = useHostCallsQuery();
  const [notifiedAtByCallId, setNotifiedAtByCallId] = useState<
    Record<string, string>
  >({});

  return (
    <ScrollScreen
      bottomContentInset={floatingTabBarBaseContentInset}
      contentStyle={styles.hostRecentCallsContent}
      testID="host-recent-data-screen"
    >
      <View style={styles.hostRecentCallsHeader}>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.hostRecentCallsTitle}>
            Recent
          </Text>
        </View>
        <HostHeaderIconButton
          accessibilityLabel="Open settings"
          icon={Settings}
          onPress={() => {
            router.push(appRoutes.hostSettings.path);
          }}
        />
      </View>

      <QueryBoundary
        emptyMessage="Recent callers will appear here after completed calls."
        emptyTitle="No recent callers yet"
        isEmpty={(items) => items.length === 0}
        query={hostCalls}
      >
        {(items) => {
          const recentCalls = buildHostRecentCalls(items);

          return (
            <View style={styles.hostRecentCallsStack}>
              <View style={styles.hostRecentCallList}>
                {recentCalls.map((call) => (
                  <HostRecentCallCard
                    call={call}
                    key={call.id}
                    notifiedAtLabel={notifiedAtByCallId[call.id]}
                    onNotify={() => {
                      setNotifiedAtByCallId((current) => {
                        if (current[call.id] !== undefined) {
                          return current;
                        }

                        return {
                          ...current,
                          [call.id]: formatHostNotifyTime(
                            new Date().toISOString(),
                          ),
                        };
                      });
                    }}
                  />
                ))}
              </View>
            </View>
          );
        }}
      </QueryBoundary>
    </ScrollScreen>
  );
}

export function HostCallsScreen() {
  const calls = useHostCallsQuery();

  return (
    <DataScreenFrame
      reserveFloatingTab
      subtitle="Host call history uses the shared call service."
      testID="host-calls-data-screen"
      title="Host calls"
    >
      <QueryBoundary
        emptyTitle="No host calls"
        isEmpty={(data) => data.length === 0}
        query={calls}
      >
        {(items) => <CallRows calls={items} />}
      </QueryBoundary>
    </DataScreenFrame>
  );
}

export function HostEarningsScreen() {
  const router = useRouter();
  const earnings = useEarningsQuery();
  const withdrawals = useWithdrawalsQuery();

  return (
    <ScrollScreen
      bottomContentInset={floatingTabBarBaseContentInset}
      contentStyle={styles.hostEarningsContent}
      testID="host-earnings-data-screen"
    >
      <View style={styles.hostEarningsHeader}>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.hostEarningsTitle}>
            Earnings
          </Text>
          <Text style={styles.hostEarningsSubtitle}>
            Track payouts, pending amounts, and withdrawal requests.
          </Text>
        </View>
        <HostHeaderIconButton
          accessibilityLabel="Open settings"
          icon={Settings}
          onPress={() => {
            router.push(appRoutes.hostSettings.path);
          }}
        />
      </View>

      <QueryBoundary query={earnings}>
        {(earningsData) => (
          <View style={styles.hostEarningsStack}>
            <Card style={styles.hostEarningsHero} variant="strong">
              <View style={styles.hostEarningsHeroTop}>
                <View style={styles.hostEarningsHeroIcon}>
                  <Wallet color={ui.color.brand.primary} size={30} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.hostEarningsHeroLabel}>
                    Available to withdraw
                  </Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    numberOfLines={1}
                    style={styles.hostEarningsHeroAmount}
                  >
                    {formatMoney(earningsData.available)}
                  </Text>
                </View>
              </View>
              <Button
                icon={IndianRupee}
                onPress={() => {
                  router.push(appRoutes.hostWithdrawal.path);
                }}
                title="Withdraw balance"
              />
            </Card>

            <View style={styles.hostEarningsMetricGrid}>
              <HostDashboardMetricTile
                label="Pending"
                value={formatMoney(earningsData.pending)}
              />
              <HostDashboardMetricTile
                label="This week"
                value={formatMoney(earningsData.weekToDate)}
              />
              <HostDashboardMetricTile
                label="Lifetime"
                value={formatMoney(earningsData.lifetime)}
              />
            </View>
          </View>
        )}
      </QueryBoundary>

      <SectionHeader
        actionLabel="Withdraw"
        onAction={() => {
          router.push(appRoutes.hostWithdrawal.path);
        }}
        title="Withdrawal history"
      />
      <QueryBoundary
        emptyMessage="Submitted withdrawal requests will appear here."
        emptyTitle="No withdrawals yet"
        isEmpty={(data) => data.length === 0}
        query={withdrawals}
      >
        {(items) => (
          <View style={styles.hostWithdrawalHistoryStack}>
            {items.map((withdrawal) => (
              <HostWithdrawalHistoryRow
                key={withdrawal.id}
                withdrawal={withdrawal}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </ScrollScreen>
  );
}

export function HostWithdrawalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const earnings = useEarningsQuery();
  const withdrawals = useWithdrawalsQuery();
  const payoutAccounts = useHostPayoutAccountsQuery();
  const [amountText, setAmountText] = useState(hostWithdrawalDefaultRupees);
  const [payoutMethod, setPayoutMethod] =
    useState<HostWithdrawalPayoutMethod>('upi');
  const [upiIdText, setUpiIdText] = useState(hostFastWithdrawalDefaultUpiId);
  const primaryPayoutAccount = payoutAccounts.data.find(
    (account) => account.primary,
  );
  const validation = parseHostWithdrawalAmount(
    amountText,
    earnings.data?.available,
  );
  const upiValidation = parseHostUpiId(upiIdText);
  const amountErrorText =
    validation.kind === 'invalid' ? validation.message : undefined;
  const upiErrorText =
    payoutMethod === 'upi' && upiValidation.kind === 'invalid'
      ? upiValidation.message
      : undefined;
  const requestWithdrawal = useMutation({
    mutationFn: () => {
      if (validation.kind !== 'valid') {
        throw new Error(validation.message);
      }

      if (payoutMethod === 'upi' && upiValidation.kind !== 'valid') {
        throw new Error(upiValidation.message);
      }

      return frontendServices.withdrawal.requestWithdrawal({
        amount: validation.money,
        hostId: mobileDataIds.hostId,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.earnings.detail(mobileDataIds.hostId)],
        }),
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.withdrawal.list(mobileDataIds.hostId)],
        }),
      ]);
    },
  });
  const canSubmit =
    earnings.data !== undefined &&
    validation.kind === 'valid' &&
    (payoutMethod === 'bank'
      ? primaryPayoutAccount !== undefined
      : upiValidation.kind === 'valid') &&
    !requestWithdrawal.isPending;
  const submitTitle =
    validation.kind === 'valid'
      ? `${payoutMethod === 'upi' ? 'Fast withdraw' : 'Withdraw'} ${formatMoney(
          validation.money,
        )}`
      : 'Submit withdrawal request';

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          disabled={!canSubmit}
          icon={IndianRupee}
          loading={requestWithdrawal.isPending}
          onPress={() => {
            requestWithdrawal.mutate();
          }}
          testID="host-withdrawal-submit"
          title={submitTitle}
        />
      }
      contentStyle={styles.hostWithdrawalContent}
      testID="host-withdrawal-screen"
    >
      <BackHeader
        onPress={() => {
          router.back();
        }}
        title="Withdrawal"
      />

      <QueryBoundary query={earnings}>
        {(earningsData) => (
          <View style={styles.hostWithdrawalStack}>
            <Card style={styles.hostWithdrawalHero} variant="strong">
              <View style={styles.hostWithdrawalHeroTop}>
                <View style={styles.hostWithdrawalIconBubbleLarge}>
                  <IndianRupee color={ui.color.brand.primary} size={30} />
                </View>
                <View style={styles.hostWithdrawalHeroCopy}>
                  <Text style={styles.hostWithdrawalHeroLabel}>
                    Available balance
                  </Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    numberOfLines={1}
                    style={styles.hostWithdrawalHeroAmount}
                  >
                    {formatMoney(earningsData.available)}
                  </Text>
                </View>
              </View>
              <View style={styles.hostWithdrawalHeroStats}>
                <View style={styles.hostWithdrawalMiniStat}>
                  <Text style={styles.hostWithdrawalMiniLabel}>Pending</Text>
                  <Text style={styles.hostWithdrawalMiniValue}>
                    {formatMoney(earningsData.pending)}
                  </Text>
                </View>
                <View style={styles.hostWithdrawalMiniDivider} />
                <View style={styles.hostWithdrawalMiniStat}>
                  <Text style={styles.hostWithdrawalMiniLabel}>This week</Text>
                  <Text style={styles.hostWithdrawalMiniValue}>
                    {formatMoney(earningsData.weekToDate)}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.hostWithdrawalAmountSection}>
              <SectionHeader
                subtitle="Choose a quick amount or enter a custom amount."
                title="Withdrawal amount"
              />
              <View style={styles.hostWithdrawalQuickGrid}>
                {hostWithdrawalQuickAmounts.map((amount) => {
                  const disabled =
                    amount * 100 > earningsData.available.amountPaise;

                  return (
                    <HostWithdrawalQuickAmount
                      amount={amount}
                      disabled={disabled}
                      key={amount}
                      onPress={(nextAmount) => {
                        setAmountText(String(nextAmount));
                      }}
                      selected={amountText === String(amount)}
                    />
                  );
                })}
              </View>
              <TextField
                {...(amountErrorText === undefined
                  ? {}
                  : { errorText: amountErrorText })}
                helperText="Whole rupee amounts only."
                inputMode="numeric"
                keyboardType="number-pad"
                label="Custom amount"
                onChangeText={(text) => {
                  setAmountText(text.replace(/[^\d]/g, ''));
                }}
                placeholder="Enter amount"
                testID="host-withdrawal-amount"
                value={amountText}
              />
            </View>

            <HostWithdrawalPayoutCard
              accounts={payoutAccounts.data}
              method={payoutMethod}
              onMethodChange={setPayoutMethod}
              onUpiIdChange={setUpiIdText}
              {...(upiErrorText === undefined ? {} : { upiErrorText })}
              upiId={upiIdText}
            />

            {requestWithdrawal.isError ? (
              <Banner
                message={normalizeApiError(requestWithdrawal.error).message}
                title="Withdrawal failed"
                tone="error"
              />
            ) : null}
            {requestWithdrawal.data === undefined ? null : (
              <Banner
                message={`${formatMoney(
                  requestWithdrawal.data.amount,
                )} is waiting for backend review${
                  payoutMethod === 'upi' && upiValidation.kind === 'valid'
                    ? ` for ${upiValidation.upiId}.`
                    : '.'
                }`}
                title="Withdrawal requested"
                tone="success"
              />
            )}
          </View>
        )}
      </QueryBoundary>

      <SectionHeader title="Withdrawal history" />
      <QueryBoundary
        emptyMessage="Submitted withdrawal requests will appear here."
        emptyTitle="No withdrawals yet"
        isEmpty={(data) => data.length === 0}
        query={withdrawals}
      >
        {(items) => (
          <View style={styles.hostWithdrawalHistoryStack}>
            {items.map((withdrawal) => (
              <HostWithdrawalHistoryRow
                key={withdrawal.id}
                withdrawal={withdrawal}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </KeyboardScreen>
  );
}

export function HostProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useHostProfileQuery();
  const payoutAccounts = useHostPayoutAccountsQuery();
  const reports = useReportsQuery();
  const makePrimaryAccount = (accountId: string) => {
    queryClient.setQueryData<HostPayoutAccount[]>(
      hostPayoutAccountsQueryKey,
      (current) =>
        withPrimaryHostPayoutAccount(
          current ?? initialHostPayoutAccounts,
          accountId,
        ),
    );
  };

  return (
    <ScrollScreen
      bottomContentInset={floatingTabBarBaseContentInset}
      contentStyle={styles.hostProfileContent}
      testID="host-profile-data-screen"
    >
      <View style={styles.hostProfileHeader}>
        <View style={styles.flex}>
          <Text
            accessibilityRole="header"
            style={styles.hostProfileHeaderTitle}
          >
            Profile
          </Text>
          <Text style={styles.hostProfileHeaderSubtitle}>
            Manage host details, payout accounts, and safety status.
          </Text>
        </View>
        <HostHeaderIconButton
          accessibilityLabel="Open settings"
          icon={Settings}
          onPress={() => {
            router.push(appRoutes.hostSettings.path);
          }}
        />
      </View>

      <QueryBoundary query={profile}>
        {(host) => {
          const details: HostProfileDetail[] = [
            {
              Icon: Languages,
              label: 'Languages',
              value: host.languages.join(', '),
            },
            {
              Icon: MapPin,
              label: 'Location',
              value: 'Hyderabad, Telangana',
            },
            {
              Icon: Phone,
              label: 'Voice rate',
              value: hostVoiceCallRateLabel,
            },
            {
              Icon: Calendar,
              label: 'Joined',
              value: '16 Jul 2026',
            },
            {
              Icon: Phone,
              label: 'Video call rate',
              value: hostVideoCallRateLabel,
            },
            {
              Icon: Smartphone,
              label: 'Fast withdrawal',
              value: hostFastWithdrawalDefaultUpiId,
            },
          ];

          return (
            <View style={styles.hostProfileStack}>
              <Card style={styles.hostProfileHero} variant="strong">
                <View style={styles.hostProfileHeroTop}>
                  <Avatar
                    label={host.displayName}
                    size="lg"
                    {...(host.profileImageUri === undefined
                      ? {}
                      : { source: { uri: host.profileImageUri } })}
                  />
                  <View style={styles.hostProfileHeroCopy}>
                    <Text numberOfLines={1} style={styles.hostProfileName}>
                      {host.displayName}
                    </Text>
                    <Text style={styles.hostProfileSubtitle}>
                      Gold voice host - Online
                    </Text>
                    <View style={styles.hostProfileBadgeRow}>
                      <RankBadge rank={host.rank} />
                      <StatusBadge
                        label={formatVerificationLabel(host.verificationStatus)}
                        tone={getVerificationTone(host.verificationStatus)}
                      />
                    </View>
                  </View>
                  <HostHeaderIconButton
                    accessibilityLabel="Edit host profile"
                    icon={Edit3}
                    onPress={() => {
                      router.push(appRoutes.hostProfileEdit.path);
                    }}
                    tone="primary"
                  />
                </View>
              </Card>

              <View style={styles.hostProfileDetailGrid}>
                {details.map((detail) => (
                  <HostProfileDetailRow
                    detail={detail}
                    key={`${detail.label}-${detail.value}`}
                  />
                ))}
              </View>

              <SectionHeader
                actionLabel="Add"
                onAction={() => {
                  router.push(
                    hostBankAccountAddRoute(appRoutes.hostProfile.path),
                  );
                }}
                subtitle={`${String(payoutAccounts.data.length)} bank accounts added.`}
                title="Bank details"
              />
              <View style={styles.hostProfileBankStack}>
                {payoutAccounts.data.map((account) => (
                  <HostPayoutAccountCard
                    account={account}
                    key={account.id}
                    onMakePrimary={makePrimaryAccount}
                  />
                ))}
              </View>

              <SectionHeader title="Growth" />
              <Pressable
                accessibilityLabel="Open referrals"
                accessibilityRole="button"
                onPress={() => {
                  router.push(appRoutes.hostReferrals.path);
                }}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
                testID="host-profile-referrals"
              >
                <ListRow
                  description="Invite new users and track host referral rewards."
                  icon={Gift}
                  meta="Open"
                  title="Referrals"
                />
              </Pressable>

              <Card style={styles.hostProfileSpotlight}>
                <View style={styles.hostProfileSpotlightIcon}>
                  <ShieldCheck color={ui.color.brand.primary} size={22} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.hostProfileSpotlightTitle}>
                    Host ready status
                  </Text>
                  <Text style={styles.hostProfileSpotlightBody}>
                    Agreement, payout, and safety status stay connected to this
                    profile.
                  </Text>
                </View>
              </Card>
            </View>
          );
        }}
      </QueryBoundary>

      <SectionHeader title="Recent reports" />
      <QueryBoundary
        emptyTitle="No reports"
        isEmpty={(data) => data.length === 0}
        query={reports}
      >
        {(items) => (
          <View style={styles.stack}>
            {items.map((report: Report) => (
              <ListRow
                description={report.description}
                icon={ShieldCheck}
                key={report.id}
                meta={report.status}
                title={report.kind}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
    </ScrollScreen>
  );
}

export function HostProfileEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useHostProfileQuery();
  const payoutAccounts = useHostPayoutAccountsQuery();
  const [draft, setDraft] = useState<HostProfileEditDraft | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const activeDraft =
    draft ??
    (profile.data === undefined
      ? null
      : {
          displayName: profile.data.displayName,
          profileImageUri: profile.data.profileImageUri ?? hostDefaultAvatarUri,
        });
  const saveProfileDraft = () => {
    if (activeDraft === null) {
      return;
    }

    queryClient.setQueryData(
      queryKeys.host.profile(mobileDataIds.hostId),
      (current: Host | undefined) =>
        current === undefined
          ? current
          : {
              ...current,
              displayName: activeDraft.displayName,
              profileImageUri: activeDraft.profileImageUri,
            },
    );
    queryClient.setQueryData(
      queryKeys.host.dashboard(mobileDataIds.hostId),
      (current: HostDashboard | undefined) =>
        current === undefined
          ? current
          : {
              ...current,
              host: {
                ...current.host,
                displayName: activeDraft.displayName,
                profileImageUri: activeDraft.profileImageUri,
              },
            },
    );
    queryClient.setQueryData(
      queryKeys.customer.hosts,
      (current: HostSummary[] | undefined) =>
        current?.map((host) =>
          host.id === mobileDataIds.hostId
            ? {
                ...host,
                displayName: activeDraft.displayName,
                profileImageUri: activeDraft.profileImageUri,
              }
            : host,
        ),
    );
    setSavedAt(
      new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  };
  const makePrimaryAccount = (accountId: string) => {
    queryClient.setQueryData<HostPayoutAccount[]>(
      hostPayoutAccountsQueryKey,
      (current) =>
        withPrimaryHostPayoutAccount(
          current ?? initialHostPayoutAccounts,
          accountId,
        ),
    );
  };

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          disabled={activeDraft === null}
          onPress={saveProfileDraft}
          testID="host-profile-save"
          title="Save changes"
        />
      }
      contentStyle={styles.hostProfileEditContent}
      testID="host-profile-edit-screen"
    >
      <BackHeader
        onPress={() => {
          router.back();
        }}
        title="Edit profile"
      />
      <Card style={styles.hostProfileEditIntro} variant="strong">
        <View style={styles.hostWithdrawalIconBubble}>
          <UserRound color={ui.color.brand.primary} size={24} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.hostProfileSpotlightTitle}>
            Profile and payout setup
          </Text>
          <Text style={styles.hostProfileSpotlightBody}>
            Keep public profile details and up to 2 payout accounts ready for
            backend review.
          </Text>
        </View>
      </Card>
      {savedAt === null ? null : (
        <Banner
          message={`Last saved at ${savedAt}.`}
          title="Draft updated"
          tone="success"
        />
      )}
      <QueryBoundary query={profile}>
        {() =>
          activeDraft === null ? null : (
            <HostProfileEditForm
              accounts={payoutAccounts.data}
              draft={activeDraft}
              onAddBankAccount={() => {
                router.push(
                  hostBankAccountAddRoute(appRoutes.hostProfileEdit.path),
                );
              }}
              onDraftChange={setDraft}
              onMakePrimary={makePrimaryAccount}
            />
          )
        }
      </QueryBoundary>
    </KeyboardScreen>
  );
}

const hostBankIfscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const normalizeHostBankAccountNumber = (value: string) =>
  value.replace(/[^\d]/g, '');

export function HostBankAccountAddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const queryClient = useQueryClient();
  const payoutAccounts = useHostPayoutAccountsQuery();
  const [holderName, setHolderName] = useState('Anjali Sharma');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [makePrimary, setMakePrimary] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const accountDigits = normalizeHostBankAccountNumber(accountNumber);
  const normalizedIfsc = ifsc.trim().toUpperCase();
  const shouldMakePrimary = makePrimary || payoutAccounts.data.length === 0;
  const returnTo = readParam(params.returnTo) ?? appRoutes.hostProfile.path;
  const returnToOrigin = () => {
    router.replace(returnTo);
  };
  const validateDraft = () => {
    if (holderName.trim().length === 0) {
      return 'Enter the account holder name.';
    }

    if (bankName.trim().length === 0) {
      return 'Enter the bank name.';
    }

    if (accountDigits.length < 4) {
      return 'Enter a valid account number.';
    }

    if (!hostBankIfscPattern.test(normalizedIfsc)) {
      return 'Enter a valid IFSC code.';
    }

    return null;
  };

  const saveAccount = () => {
    const error = validateDraft();

    if (error !== null) {
      setSubmitError(error);
      return;
    }

    const account: HostPayoutAccount = {
      accountNumberLast4: accountDigits.slice(-4),
      bankName: bankName.trim(),
      holderName: holderName.trim(),
      id: `host-payout-bank-${String(Date.now())}`,
      ifsc: normalizedIfsc,
      primary: shouldMakePrimary,
    };

    queryClient.setQueryData<HostPayoutAccount[]>(
      hostPayoutAccountsQueryKey,
      (current) =>
        addHostPayoutAccount({
          account,
          accounts: current ?? initialHostPayoutAccounts,
          makePrimary: account.primary,
        }),
    );
    returnToOrigin();
  };

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          icon={Landmark}
          onPress={saveAccount}
          testID="host-bank-account-save"
          title="Save bank account"
        />
      }
      contentStyle={styles.hostProfileEditContent}
      testID="host-bank-account-add-screen"
    >
      <BackHeader
        onPress={() => {
          returnToOrigin();
        }}
        title="Add bank account"
      />
      <Card style={styles.hostProfileEditSection} variant="strong">
        <View style={styles.hostProfileEditSectionHeader}>
          <Text style={styles.hostProfileEditSectionTitle}>
            Bank account details
          </Text>
          <Text style={styles.hostProfileEditSectionSubtitle}>
            Add the account used for reviewed host withdrawals.
          </Text>
        </View>
        <TextField
          label="Account holder name"
          onChangeText={(value) => {
            setHolderName(value);
            setSubmitError(null);
          }}
          placeholder="Name as per bank"
          testID="host-bank-holder-name"
          value={holderName}
        />
        <TextField
          label="Bank name"
          onChangeText={(value) => {
            setBankName(value);
            setSubmitError(null);
          }}
          placeholder="HDFC Bank"
          testID="host-bank-name"
          value={bankName}
        />
        <TextField
          inputMode="numeric"
          keyboardType="number-pad"
          label="Account number"
          onChangeText={(value) => {
            setAccountNumber(normalizeHostBankAccountNumber(value));
            setSubmitError(null);
          }}
          placeholder="Account number"
          testID="host-bank-account-number"
          value={accountNumber}
        />
        <TextField
          autoCapitalize="characters"
          label="IFSC code"
          onChangeText={(value) => {
            setIfsc(value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            setSubmitError(null);
          }}
          placeholder="HDFC0004218"
          testID="host-bank-ifsc"
          value={ifsc}
        />
        <Pressable
          accessibilityLabel="Make this bank account primary"
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: shouldMakePrimary,
            disabled: payoutAccounts.data.length === 0,
          }}
          disabled={payoutAccounts.data.length === 0}
          hitSlop={ui.hitSlop}
          onPress={() => {
            setMakePrimary((current) => !current);
          }}
          style={({ pressed }) => [
            styles.hostBankPrimaryRow,
            pressed ? styles.pressed : null,
          ]}
          testID="host-bank-make-primary"
        >
          <View
            style={[
              styles.hostPayoutPrimaryCheckbox,
              shouldMakePrimary
                ? styles.hostPayoutPrimaryCheckboxChecked
                : null,
            ]}
          >
            {shouldMakePrimary ? (
              <Check color={ui.color.text.inverse} size={17} strokeWidth={3} />
            ) : null}
          </View>
          <Text style={styles.hostBankPrimaryText}>
            {shouldMakePrimary ? 'Primary account' : 'Make primary account'}
          </Text>
        </Pressable>
      </Card>
      {submitError === null ? null : (
        <Banner message={submitError} title="Check bank details" tone="error" />
      )}
    </KeyboardScreen>
  );
}

export function HostReferralsScreen() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  return (
    <ScrollScreen
      contentStyle={styles.hostReferralContent}
      testID="host-referrals-screen"
    >
      <BackHeader
        onPress={() => {
          router.back();
        }}
        title="Referrals"
      />

      <Card style={styles.hostReferralHero} variant="strong">
        <View style={styles.hostProfileSpotlightIcon}>
          <Gift color={ui.color.brand.primary} size={22} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.hostProfileSpotlightTitle}>Invite and earn</Text>
          <Text style={styles.hostProfileSpotlightBody}>
            Share your host referral code and track rewards after referred users
            complete verification.
          </Text>
        </View>
      </Card>

      {copied ? (
        <Banner
          message="Referral code copied for this mock session."
          title="Code ready"
          tone="success"
        />
      ) : null}

      <Card style={styles.hostReferralCodeCard} variant="strong">
        <View style={styles.flex}>
          <Text style={styles.hostReferralLabel}>Your referral code</Text>
          <Text style={styles.hostReferralCode}>ANJALI15</Text>
        </View>
        <Button
          compact
          onPress={() => {
            setCopied(true);
          }}
          title="Copy code"
          variant="secondary"
        />
      </Card>

      <SectionHeader
        subtitle="Rewards are mock-service backed until backend referral rules are connected."
        title="Referral progress"
      />
      <View style={styles.stack}>
        <ListRow
          description="Shared from profile and onboarding links."
          icon={UserRound}
          meta="12"
          title="Invites sent"
        />
        <ListRow
          description="Completed signup and verification."
          icon={ShieldCheck}
          meta="4"
          title="Qualified referrals"
        />
        <ListRow
          description="Released after policy checks."
          icon={IndianRupee}
          meta="INR 600"
          title="Rewards earned"
        />
      </View>
    </ScrollScreen>
  );
}

export function HostLeaderboardScreen() {
  const hosts = useHostsQuery();

  return (
    <DataScreenFrame
      subtitle="Ranking reads the same host summary service as customer search."
      testID="host-leaderboard-data-screen"
      title="Leaderboard"
    >
      <QueryBoundary
        emptyTitle="No ranked hosts"
        isEmpty={(data) => data.length === 0}
        query={hosts}
      >
        {(items) => (
          <View style={styles.stack}>
            {[...items]
              .sort(
                (left: HostSummary, right: HostSummary) =>
                  right.completedCalls - left.completedCalls,
              )
              .map((host, index) => (
                <ListRow
                  description={`${String(host.completedCalls)} completed calls`}
                  icon={index === 0 ? Star : Phone}
                  key={host.id}
                  meta={host.rank}
                  title={`${String(index + 1)}. ${host.displayName}`}
                />
              ))}
          </View>
        )}
      </QueryBoundary>
    </DataScreenFrame>
  );
}

export function CustomerFiltersScreen() {
  const hosts = useHostsQuery();

  return (
    <DataScreenFrame
      subtitle="Filter options are derived from the host service response."
      testID="customer-filters-data-screen"
      title="Filters"
    >
      <QueryBoundary
        emptyTitle="No filter options"
        isEmpty={(data) => data.length === 0}
        query={hosts}
      >
        {(items) => (
          <View style={styles.stack}>
            {Array.from(new Set(items.map((host) => host.language))).map(
              (language) => (
                <ListRow
                  description="Language available in current host inventory"
                  icon={RefreshCw}
                  key={language}
                  title={language}
                />
              ),
            )}
          </View>
        )}
      </QueryBoundary>
    </DataScreenFrame>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  flex: {
    flex: 1,
    gap: ui.spacing[2],
  },
  hostAvailabilityControl: {
    alignItems: 'center',
    gap: ui.spacing[1],
  },
  hostAvailabilityKnob: {
    backgroundColor: ui.color.text.inverse,
    borderRadius: ui.radii.full,
    height: 24,
    shadowColor: '#79334f',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    width: 24,
  },
  hostAvailabilitySwitch: {
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 4,
    width: 60,
  },
  hostAvailabilitySwitchDisabled: {
    opacity: 0.58,
  },
  hostAvailabilitySwitchTrack: {
    borderRadius: ui.radii.full,
  },
  hostAvailabilityText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'uppercase',
  },
  hostDashboardContent: {
    gap: ui.spacing[4],
    paddingTop: ui.spacing[3],
  },
  hostDashboardHero: {
    gap: ui.spacing[4],
    padding: ui.spacing[5],
  },
  hostDashboardHeroCopy: {
    gap: ui.spacing[3],
  },
  hostDashboardHeroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hostIncomingCallCard: {
    gap: ui.spacing[4],
    padding: ui.spacing[4],
  },
  hostIncomingCallIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  hostIncomingCallMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostIncomingCallRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  hostIncomingCallTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  hostDashboardLogo: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  hostDashboardLogoAccent: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    height: 6,
    marginBottom: 4,
    width: 6,
  },
  hostDashboardMetricLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostDashboardMetricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
    justifyContent: 'space-between',
  },
  hostDashboardMetricAction: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.16)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  hostDashboardMetricPressable: {
    flex: 1,
  },
  hostDashboardMetricRow: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  hostDashboardMetricTile: {
    flex: 1,
    gap: ui.spacing[2],
    minWidth: 0,
  },
  hostDashboardMetricValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  hostDashboardStack: {
    gap: ui.spacing[4],
  },
  hostDashboardTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  hostDashboardWordmark: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[1],
  },
  hostEarningsContent: {
    gap: ui.spacing[5],
    paddingTop: ui.spacing[3],
  },
  hostEarningsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
    minHeight: 56,
  },
  hostEarningsHero: {
    gap: ui.spacing[4],
    padding: ui.spacing[5],
  },
  hostEarningsHeroAmount: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 36,
    lineHeight: 42,
  },
  hostEarningsHeroIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  hostEarningsHeroLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  hostEarningsHeroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  hostEarningsMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  hostEarningsStack: {
    gap: ui.spacing[4],
  },
  hostEarningsSubtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  hostEarningsTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  hostRecentCallsActionGroup: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: ui.spacing[2],
    width: 152,
  },
  hostRecentCallsContent: {
    gap: ui.spacing[4],
    paddingTop: ui.spacing[3],
  },
  hostRecentCallsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
    minHeight: 56,
  },
  hostRecentCallsStack: {
    gap: ui.spacing[3],
  },
  hostRecentCallsTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  hostPayoutAccountCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[4],
    position: 'relative',
  },
  hostPayoutAccountCardCompact: {
    padding: ui.spacing[3],
  },
  hostPayoutAccountCardSelectable: {
    paddingRight: ui.spacing[8],
  },
  hostPayoutAccountHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  hostPayoutAccountMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostPayoutAccountTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostPayoutPrimaryCheckbox: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: 'rgba(201,54,116,0.34)',
    borderRadius: ui.radii.full,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  hostPayoutPrimaryCheckboxChecked: {
    backgroundColor: ui.color.brand.primary,
    borderColor: ui.color.brand.primary,
  },
  hostPayoutPrimaryControl: {
    position: 'absolute',
    right: ui.spacing[3],
    top: ui.spacing[3],
    zIndex: 2,
  },
  hostAvatarEditRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  hostAvatarPresetButton: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.lg,
    borderWidth: 1,
    gap: ui.spacing[1],
    minHeight: 86,
    minWidth: 74,
    padding: ui.spacing[2],
  },
  hostAvatarPresetButtonSelected: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.brand.primary,
  },
  hostAvatarPresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  hostAvatarPresetLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostAvatarPresetLabelSelected: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.bold,
  },
  hostBankPrimaryRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[2],
    minHeight: ui.minTouch,
  },
  hostBankPrimaryText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostProfileBankStack: {
    gap: ui.spacing[3],
  },
  hostProfileBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  hostProfileContent: {
    gap: ui.spacing[5],
    paddingTop: ui.spacing[3],
  },
  hostProfileDetailCard: {
    alignItems: 'center',
    flexDirection: 'row',
    flexBasis: '47%',
    flexGrow: 1,
    gap: ui.spacing[3],
    minWidth: 0,
    padding: ui.spacing[4],
  },
  hostProfileDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  hostProfileDetailIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.18)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  hostProfileDetailLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostProfileDetailValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostProfileEditContent: {
    gap: ui.spacing[5],
    paddingTop: ui.spacing[3],
  },
  hostProfileEditIntro: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[4],
  },
  hostProfileEditSection: {
    gap: ui.spacing[4],
    padding: ui.spacing[4],
  },
  hostProfileEditSectionHeader: {
    gap: ui.spacing[1],
  },
  hostProfileEditSectionSubtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostProfileEditSectionTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostProfileEditStack: {
    gap: ui.spacing[4],
  },
  hostHeaderIconButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: ui.radii.full,
    borderWidth: 0,
    height: ui.minTouch,
    justifyContent: 'center',
    width: ui.minTouch,
  },
  hostProfileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
    minHeight: 56,
  },
  hostProfileHeaderSubtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  hostProfileHeaderTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  hostProfileHero: {
    gap: ui.spacing[4],
    padding: ui.spacing[5],
  },
  hostProfileHeroCopy: {
    flex: 1,
    gap: ui.spacing[2],
    minWidth: 0,
  },
  hostProfileHeroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  hostProfileLanguagePill: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[1],
  },
  hostProfileLanguageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  hostProfileLanguageText: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostProfileName: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  hostProfileSpotlight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  hostProfileSpotlightBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostProfileSpotlightIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  hostProfileSpotlightTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostProfileStack: {
    gap: ui.spacing[5],
  },
  hostProfileSubtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textTransform: 'capitalize',
  },
  hostReferralCode: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 30,
    lineHeight: 36,
  },
  hostReferralCodeCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  hostReferralContent: {
    gap: ui.spacing[5],
    paddingTop: ui.spacing[3],
  },
  hostReferralHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  hostReferralLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostRecentCallCard: {
    gap: ui.spacing[3],
    padding: ui.spacing[4],
  },
  hostRecentCallCopy: {
    flex: 1,
    gap: ui.spacing[2],
    minWidth: 0,
  },
  hostRecentCallEarnings: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.16)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: ui.spacing[1],
    paddingHorizontal: ui.spacing[2],
    paddingVertical: ui.spacing[1],
  },
  hostRecentCallEarningsText: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.caption.lineHeight,
  },
  hostRecentCallHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  hostRecentCallIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minWidth: 0,
  },
  hostRecentCallList: {
    gap: ui.spacing[3],
  },
  hostRecentCallMetaCopy: {
    flex: 1,
    minWidth: 0,
  },
  hostRecentCallMetaGrid: {
    flexDirection: 'row',
    gap: ui.spacing[2],
  },
  hostRecentCallMetaLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  hostRecentCallMetaTile: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: ui.spacing[2],
    minWidth: 0,
    padding: ui.spacing[2],
  },
  hostRecentCallMetaTileDuration: {
    flex: 1.28,
  },
  hostRecentCallMetaValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostRecentCallModeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    paddingHorizontal: ui.spacing[2],
    paddingVertical: 3,
  },
  hostRecentCallModeText: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  hostRecentCallName: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  hostRecentCallNotifiedState: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.18)',
    borderRadius: ui.radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: ui.spacing[2],
    justifyContent: 'center',
    minHeight: ui.minTouch,
    paddingHorizontal: ui.spacing[3],
  },
  hostRecentCallNotifiedText: {
    color: ui.color.brand.primaryPressed,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostRecentCallNotifyButton: {
    width: '100%',
  },
  hostRecentSection: {
    gap: ui.spacing[3],
  },
  hostLeaderboardCurrentPositionCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(62,111,217,0.16)',
    borderColor: 'rgba(62,111,217,0.34)',
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[3],
  },
  hostLeaderboardCurrentPositionEyebrow: {
    color: ui.color.status.info,
    fontFamily: ui.font.bold,
    fontSize: 10,
    letterSpacing: 0.65,
    lineHeight: 13,
  },
  hostLeaderboardCurrentPositionNumber: {
    alignItems: 'center',
    backgroundColor: ui.color.status.info,
    borderRadius: ui.radii.lg,
    height: 42,
    justifyContent: 'center',
    width: 52,
  },
  hostLeaderboardCurrentPositionNumberText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  hostLeaderboardAmount: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.label.lineHeight,
    textAlign: 'right',
  },
  hostLeaderboardCaption: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'right',
  },
  hostLeaderboardEarnings: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
    maxWidth: 98,
  },
  hostLeaderboardList: {
    gap: ui.spacing[3],
  },
  hostLeaderboardMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostLeaderboardName: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    minWidth: 0,
  },
  hostLeaderboardNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
  },
  hostLeaderboardPosition: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  hostLeaderboardPositionText: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  hostLeaderboardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[3],
  },
  hostWithdrawalAmountSection: {
    gap: ui.spacing[3],
  },
  hostWithdrawalContent: {
    gap: ui.spacing[5],
  },
  hostWithdrawalHelper: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostWithdrawalMethodCard: {
    borderColor: 'rgba(201,54,116,0.22)',
    padding: 0,
  },
  hostWithdrawalMethodCardSelected: {
    borderColor: ui.color.brand.primary,
  },
  hostWithdrawalMethodDescription: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostWithdrawalMethodIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  hostWithdrawalMethodIconSelected: {
    backgroundColor: ui.color.brand.primary,
  },
  hostWithdrawalMethodPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 74,
    padding: ui.spacing[4],
  },
  hostWithdrawalMethodRadio: {
    alignItems: 'center',
    borderColor: 'rgba(201,54,116,0.28)',
    borderRadius: ui.radii.full,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  hostWithdrawalMethodRadioDot: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    height: 10,
    width: 10,
  },
  hostWithdrawalMethodRadioSelected: {
    borderColor: ui.color.brand.primary,
  },
  hostWithdrawalMethodTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostWithdrawalPayoutSection: {
    gap: ui.spacing[3],
  },
  hostWithdrawalHero: {
    gap: ui.spacing[5],
    padding: ui.spacing[5],
  },
  hostWithdrawalHeroAmount: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 36,
    lineHeight: 42,
  },
  hostWithdrawalHeroCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  hostWithdrawalHeroLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  hostWithdrawalHeroStats: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  hostWithdrawalHeroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  hostWithdrawalHistoryCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[4],
  },
  hostWithdrawalHistoryMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostWithdrawalHistoryStack: {
    gap: ui.spacing[3],
  },
  hostWithdrawalHistoryTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostWithdrawalIconBubble: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  hostWithdrawalIconBubbleLarge: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: 'rgba(201,54,116,0.22)',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  hostWithdrawalMiniDivider: {
    backgroundColor: 'rgba(201,54,116,0.16)',
    height: 42,
    width: 1,
  },
  hostWithdrawalMiniLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  hostWithdrawalMiniStat: {
    flex: 1,
    gap: ui.spacing[1],
  },
  hostWithdrawalMiniValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostWithdrawalPayoutCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[4],
  },
  hostWithdrawalPayoutHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  hostWithdrawalPayoutMeta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostWithdrawalPayoutTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostWithdrawalQuickCard: {
    borderColor: 'rgba(201,54,116,0.22)',
    flexBasis: '47%',
    flexGrow: 1,
    padding: 0,
  },
  hostWithdrawalQuickCardDisabled: {
    opacity: 0.42,
  },
  hostWithdrawalQuickCardSelected: {
    borderColor: ui.color.brand.primary,
  },
  hostWithdrawalQuickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  hostWithdrawalQuickPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[3],
  },
  hostWithdrawalQuickText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostWithdrawalQuickTextSelected: {
    color: ui.color.brand.primary,
  },
  hostWithdrawalStack: {
    gap: ui.spacing[5],
  },
  hostWelcomeText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  profileCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  stack: {
    gap: ui.spacing[3],
  },
  title: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
});
