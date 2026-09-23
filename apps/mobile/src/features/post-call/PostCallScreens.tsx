import { FlashList } from '@shopify/flash-list';
import {
  FileText,
  Flag,
  IndianRupee,
  LifeBuoy,
  MoreVertical,
  PhoneCall,
  Star,
  Trash2,
  User,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { normalizeApiError, type HostSummary } from '@connecto/domain';

import { LottieIllustration } from '@/components/animations/LottieIllustration';
import {
  KeyboardScreen,
  ScrollScreen,
  useResponsiveLayout,
} from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Banner, InlineError } from '@/components/ui/feedback';
import { RadioCard, TextArea } from '@/components/ui/fields';
import { getFloatingTabBarContentInset } from '@/components/ui/FloatingTabBar';
import { BackHeader, SectionHeader } from '@/components/ui/navigation';
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  GlassSurface,
  Skeleton,
  StatusBadge,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { mobileDataIds, useHostsQuery } from '@/features/data/mobileDataHooks';
import { useHaptics } from '@/motion/MotionProvider';
import { usePulseStyle } from '@/motion/reanimated';
import { appRoutes } from '@/navigation/routes';

import {
  blockHostAfterCall,
  parseCallSummaryRouteParams,
} from '../calls/call-safety';
import { outgoingCallRouteParamsForHost } from '../calls/call.preconnect';
import {
  postCallAdapter,
  type EnsurePostCallRecordInput,
} from './post-call.adapters';
import {
  normalizePostCallErrorMessage,
  useCreatePostCallEvidenceMetadata,
  usePostCallRecordQuery,
  usePostCallRecordsQuery,
  usePostCallSupportTicketQuery,
  usePostCallSupportTicketsQuery,
  useSubmitPostCallRatingMutation,
  useSubmitPostCallSupportTicketMutation,
} from './post-call.hooks';
import {
  formatPostCallCurrency,
  formatPostCallDateTime,
  formatPostCallDuration,
  resolvePostCallEndReasonLabel,
  resolvePostCallIssueCategoryLabel,
  resolvePostCallRatingTagLabel,
  sortPostCallRecords,
  type PostCallEvidenceMetadata,
  type PostCallIssueCategory,
  type PostCallRatingTag,
  type PostCallRecord,
} from './post-call.models';

const summaryPollIntervalMs = 1_200;
const ratingTags = [
  'clear-audio',
  'helpful',
  'respectful',
  'engaging',
  'technical-issue',
  'call-dropped',
  'billing-confusing',
  'host-rude',
] as const satisfies readonly PostCallRatingTag[];

const issueCategories = [
  {
    category: 'billing',
    description: 'Charges, timing, or wallet questions.',
  },
  {
    category: 'audio-quality',
    description: 'Audio cuts, echo, or low clarity.',
  },
  {
    category: 'video-quality',
    description: 'Video upgrade issues or unstable video.',
  },
  {
    category: 'host-behaviour',
    description: 'Behaviour concerns with the host.',
  },
  {
    category: 'technical',
    description: 'App or call-state problems.',
  },
  {
    category: 'safety',
    description: 'Safety-sensitive concerns that need review.',
  },
] as const satisfies readonly {
  category: PostCallIssueCategory;
  description: string;
}[];

const readParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

type RouteTarget =
  | string
  | {
      params?: Record<string, string>;
      pathname: string;
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

const callDetailReturnPath = (callId: string | null) =>
  callId === null
    ? appRoutes.customerCalls.path
    : `${appRoutes.customerCalls.path}/${encodeURIComponent(callId)}`;

const supportTicketReturnPath = (ticketId: string | null) =>
  ticketId === null
    ? appRoutes.customerSupport.path
    : appRoutes.customerSupportTicket.path.replace(
        '[ticketId]',
        encodeURIComponent(ticketId),
      );

const toSummarySeed = (
  params: ReturnType<typeof parseCallSummaryRouteParams>,
): EnsurePostCallRecordInput | null => {
  if (
    params.callId === undefined ||
    params.hostId === undefined ||
    params.hostName === undefined
  ) {
    return null;
  }

  return {
    callId: params.callId,
    connectedDurationMs: params.connectedDurationMs,
    endedAtIso: params.endedAtIso,
    hostId: params.hostId,
    hostName: params.hostName,
    mediaMode: params.mediaMode,
    reason: params.reason,
    remainingBalancePaise: params.remainingBalancePaise,
    sessionId: params.sessionId,
    videoDurationMs: params.videoDurationMs,
  };
};

function QueryCardState<T>({
  children,
  emptyMessage,
  emptyTitle,
  isEmpty,
  query,
  skeletonLines = 4,
}: {
  children: (data: NonNullable<T>) => React.ReactNode;
  emptyMessage: string;
  emptyTitle: string;
  isEmpty?: (data: T) => boolean;
  query: {
    data: T | undefined;
    error: unknown;
    isError: boolean;
    isPending: boolean;
    refetch: () => unknown;
  };
  skeletonLines?: number;
}) {
  if (query.isPending) {
    return (
      <Card>
        <Skeleton lines={skeletonLines} />
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

  if (query.data === undefined || query.data === null) {
    return <EmptyState message={emptyMessage} title={emptyTitle} />;
  }

  if (isEmpty?.(query.data) === true) {
    return <EmptyState message={emptyMessage} title={emptyTitle} />;
  }

  const data = query.data as NonNullable<T>;

  return <>{children(data)}</>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
      <Text style={styles.summaryMetricValue}>{value}</Text>
    </View>
  );
}

function TagChip({
  label,
  onPress,
  selected,
  testID,
}: {
  label: string;
  onPress?: () => void;
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
        styles.tagChip,
        selected ? styles.tagChipSelected : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.tagChipText,
          selected ? styles.tagChipTextSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatusBannerForRecord({ record }: { record: PostCallRecord }) {
  if (record.finalizationStatus === 'processing') {
    return (
      <Banner
        message="Estimated pricing is visible now. Final verification is still running in the mock settlement adapter."
        title="Calculating final total"
        tone="warning"
      />
    );
  }

  return (
    <Banner
      message="Final billing is verified for this call and survives app restart through secure local persistence."
      title="Finalized"
      tone="success"
    />
  );
}

function CallHeroCard({ record }: { record: PostCallRecord }) {
  const totalLabel =
    record.chargeBreakdown.finalizedTotal === null
      ? formatPostCallCurrency(record.chargeBreakdown.estimatedTotal)
      : formatPostCallCurrency(record.chargeBreakdown.finalizedTotal);

  return (
    <Card style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <Avatar
          label={record.hostName}
          size="lg"
          {...(record.hostAvatarUri === undefined
            ? {}
            : { source: { uri: record.hostAvatarUri } })}
        />
        <View style={styles.heroCopy}>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            {record.hostName}
          </Text>
          <Text style={styles.body}>
            {formatPostCallDateTime(record.endedAtIso)} •{' '}
            {resolvePostCallEndReasonLabel(record.endReason)}
          </Text>
          <View style={styles.badgeRow}>
            <StatusBadge label={record.mediaSummary} tone="info" />
            <StatusBadge
              label={record.verificationState}
              tone={
                record.verificationState === 'verified' ? 'success' : 'warning'
              }
            />
          </View>
        </View>
      </View>
      <View style={styles.metricGrid}>
        <SummaryMetric
          label="Voice"
          value={formatPostCallDuration(record.voiceDurationSeconds)}
        />
        <SummaryMetric
          label="Video"
          value={formatPostCallDuration(record.videoDurationSeconds)}
        />
        <SummaryMetric label="Total" value={totalLabel} />
      </View>
    </Card>
  );
}

function CallBreakdownCard({ record }: { record: PostCallRecord }) {
  return (
    <Card style={styles.cardStack}>
      <Text style={styles.cardTitle}>Charges</Text>
      <DetailLine label="Call ID" value={record.callId} />
      <DetailLine
        label="Voice rate"
        value={`${formatPostCallCurrency(record.priceSnapshot.voiceRate)}/min`}
      />
      <DetailLine
        label="Video rate"
        value={`${formatPostCallCurrency(record.priceSnapshot.videoRate)}/min`}
      />
      <DetailLine
        label="Estimated voice"
        value={formatPostCallCurrency(record.chargeBreakdown.estimatedVoice)}
      />
      <DetailLine
        label="Estimated video"
        value={formatPostCallCurrency(record.chargeBreakdown.estimatedVideo)}
      />
      <DetailLine
        label="Estimated total"
        value={formatPostCallCurrency(record.chargeBreakdown.estimatedTotal)}
      />
      <DetailLine
        label="Final total"
        value={
          record.chargeBreakdown.finalizedTotal === null
            ? 'Verification pending'
            : formatPostCallCurrency(record.chargeBreakdown.finalizedTotal)
        }
      />
      <DetailLine
        label="Wallet after call"
        value={formatPostCallCurrency(record.walletBalanceAfter)}
      />
    </Card>
  );
}

function CallSupportCard({ record }: { record: PostCallRecord }) {
  return (
    <Card style={styles.cardStack}>
      <Text style={styles.cardTitle}>Verification</Text>
      <DetailLine
        label="Billing status"
        value={
          record.finalizationStatus === 'finalized'
            ? 'Final total verified'
            : 'Verification pending'
        }
      />
      <DetailLine
        label="Support"
        value={
          record.linkedSupportTicketId === null
            ? 'No linked ticket'
            : record.linkedSupportTicketId
        }
      />
    </Card>
  );
}

function RatingReadOnlyCard({ record }: { record: PostCallRecord }) {
  if (record.rating === null) {
    return null;
  }

  return (
    <Card style={styles.cardStack}>
      <Text style={styles.cardTitle}>Your rating</Text>
      <Text style={styles.ratingHeadline}>
        {Array.from({ length: record.rating.stars }, () => '★').join(' ')}
      </Text>
      <Text style={styles.body}>
        Submitted {formatPostCallDateTime(record.rating.submittedAtIso)}
      </Text>
      <View style={styles.tagWrap}>
        {record.rating.tags.map((tag) => (
          <TagChip
            key={tag}
            label={resolvePostCallRatingTagLabel(tag)}
            selected
          />
        ))}
      </View>
      {record.rating.comment.trim().length === 0 ? null : (
        <Text style={styles.body}>{record.rating.comment}</Text>
      )}
    </Card>
  );
}

function RatingComposer({
  onReportInstead,
  onSkip,
  record,
  showSkip,
}: {
  onReportInstead: () => void;
  onSkip?: () => void;
  record: PostCallRecord;
  showSkip: boolean;
}) {
  const mutation = useSubmitPostCallRatingMutation();
  const haptics = useHaptics();
  const [comment, setComment] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<PostCallRatingTag[]>([]);

  if (record.connectedDurationSeconds === 0 || record.rating !== null) {
    return null;
  }

  const submit = () => {
    if (selectedStars === 0) {
      setErrorText('Choose a star rating before submitting.');
      return;
    }

    setErrorText(null);
    mutation.mutate(
      {
        callId: record.callId,
        comment: comment.trim(),
        stars: selectedStars,
        tags: selectedTags,
      },
      {
        onSuccess: () => {
          haptics.success();
        },
      },
    );
  };

  return (
    <Card style={styles.cardStack}>
      <Text style={styles.cardTitle}>Rate this call</Text>
      <Text style={styles.body}>
        Ratings are available only once for connected calls. Feedback tags help
        the mock support flow later.
      </Text>
      <View accessibilityRole="summary" style={styles.starRow}>
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = index + 1;
          const selected = starValue <= selectedStars;

          return (
            <Pressable
              accessibilityLabel={`Rate ${String(starValue)} star${starValue === 1 ? '' : 's'}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={starValue}
              onPress={() => {
                setSelectedStars(starValue);
                haptics.selection();
                setErrorText(null);
              }}
              style={({ pressed }) => [
                styles.starButton,
                selected ? styles.starButtonSelected : null,
                pressed ? styles.pressed : null,
              ]}
              testID={`rating-star-${String(starValue)}`}
            >
              <Star
                color={
                  selected ? ui.color.accent.coral : ui.color.text.tertiary
                }
                fill={selected ? ui.color.accent.coral : 'transparent'}
                size={22}
              />
            </Pressable>
          );
        })}
      </View>
      {errorText === null ? null : <InlineError message={errorText} />}
      <View style={styles.tagWrap}>
        {ratingTags.map((tag) => {
          const selected = selectedTags.includes(tag);

          return (
            <TagChip
              key={tag}
              label={resolvePostCallRatingTagLabel(tag)}
              onPress={() => {
                haptics.selection();
                setSelectedTags((current) =>
                  current.includes(tag)
                    ? current.filter((item) => item !== tag)
                    : [...current, tag],
                );
              }}
              selected={selected}
              testID={`rating-tag-${tag}`}
            />
          );
        })}
      </View>
      <TextArea
        helperText="Optional comment"
        label="Comment"
        onChangeText={setComment}
        placeholder="Share anything support or product should know."
        testID="rating-comment"
        value={comment}
      />
      {mutation.isError ? (
        <InlineError message={normalizePostCallErrorMessage(mutation.error)} />
      ) : null}
      <View style={styles.inlineActionRow}>
        <Button
          loading={mutation.isPending}
          onPress={submit}
          testID="rating-submit"
          title="Submit rating"
        />
        <Button
          onPress={onReportInstead}
          testID="rating-report-instead"
          title="Report Instead"
          variant="secondary"
        />
        {showSkip && onSkip !== undefined ? (
          <Button
            onPress={onSkip}
            testID="rating-skip"
            title="Skip"
            variant="ghost"
          />
        ) : null}
      </View>
    </Card>
  );
}

const formatRecentTime = (dateTime: string) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateTime));

const formatRecentDate = (dateTime: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateTime));

function RecentsHeader({
  onOpenMenu,
  onlineOnly,
  onOnlineOnlyChange,
}: {
  onOpenMenu: () => void;
  onlineOnly: boolean;
  onOnlineOnlyChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.recentsTopRow}>
      <Text accessibilityRole="header" style={styles.recentsTitle}>
        Recents
      </Text>
      <View style={styles.recentsActions}>
        <Pressable
          accessibilityLabel="Show online hosts only"
          accessibilityRole="switch"
          accessibilityState={{ checked: onlineOnly }}
          hitSlop={ui.hitSlop}
          onPress={() => {
            onOnlineOnlyChange(!onlineOnly);
          }}
          style={({ pressed }) => [
            styles.recentsOnlineToggle,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.recentsOnlineLabel}>Online</Text>
          <Switch
            ios_backgroundColor="#d8d8dc"
            onValueChange={onOnlineOnlyChange}
            thumbColor="#4779f3"
            trackColor={{ false: '#d6d6d8', true: '#dbe7ff' }}
            value={onlineOnly}
          />
        </Pressable>
        <Pressable
          accessibilityLabel="More recent options"
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={onOpenMenu}
          style={({ pressed }) => [
            styles.recentsMenuButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <MoreVertical color="#090909" size={28} />
        </Pressable>
      </View>
    </View>
  );
}

function RecentsOverflowMenu({
  onDismiss,
  onDeleteCallLog,
  onOpenProfile,
  onRecharge,
  top,
  visible,
}: {
  onDismiss: () => void;
  onDeleteCallLog: () => void;
  onOpenProfile: () => void;
  onRecharge: () => void;
  top: number;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.recentsMenuModal}>
        <Pressable
          accessibilityLabel="Close recent options"
          accessibilityRole="button"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <GlassSurface
          shadow="floating"
          style={[styles.recentsOverflowMenu, { top }]}
          variant="modal"
        >
          <Pressable
            accessibilityLabel="My profile"
            accessibilityRole="button"
            onPress={onOpenProfile}
            style={({ pressed }) => [
              styles.recentsMenuItem,
              pressed ? styles.pressed : null,
            ]}
          >
            <User color="#4779f3" size={23} />
            <Text style={styles.recentsMenuText}>My profile</Text>
          </Pressable>
          <View style={styles.recentsMenuDivider} />
          <Pressable
            accessibilityLabel="Recharge"
            accessibilityRole="button"
            onPress={onRecharge}
            style={({ pressed }) => [
              styles.recentsMenuItem,
              pressed ? styles.pressed : null,
            ]}
          >
            <IndianRupee color="#4779f3" size={24} />
            <Text style={styles.recentsMenuText}>Recharge</Text>
          </Pressable>
          <View style={styles.recentsMenuDivider} />
          <Pressable
            accessibilityLabel="Delete call log"
            accessibilityRole="button"
            onPress={onDeleteCallLog}
            style={({ pressed }) => [
              styles.recentsMenuItem,
              pressed ? styles.pressed : null,
            ]}
          >
            <Trash2 color="#e33f52" size={24} />
            <Text style={styles.recentsMenuText}>Delete call log</Text>
          </Pressable>
        </GlassSurface>
      </View>
    </Modal>
  );
}

function CallHistoryRow({
  host,
  onCall,
  onPress,
  record,
}: {
  host?: HostSummary;
  onCall: () => void;
  onPress: () => void;
  record: PostCallRecord;
}) {
  const online = host?.availability === 'online';
  const avatarUri = record.hostAvatarUri ?? host?.profileImageUri;
  const metaLabel = `${formatPostCallDuration(record.connectedDurationSeconds)} \u2022 ${formatRecentTime(record.endedAtIso)}`;
  const callPulseStyle = usePulseStyle(online);
  const statusPulseStyle = usePulseStyle(online);

  return (
    <Card style={styles.recentCard} variant="standard">
      <Pressable
        accessibilityLabel={`Open recent call with ${record.hostName}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.recentOpenTarget,
          pressed ? styles.pressed : null,
        ]}
        testID={`call-row-${record.callId}`}
      >
        <View style={styles.recentAvatarColumn}>
          <View style={styles.recentAvatarFrame}>
            <Avatar
              label={record.hostName}
              size="md"
              {...(avatarUri === undefined
                ? {}
                : { source: { uri: avatarUri } })}
            />
            {online ? (
              <Animated.View
                style={[styles.recentStatusPulse, statusPulseStyle]}
              />
            ) : null}
            <View
              style={[
                styles.recentStatusDot,
                online ? styles.recentStatusOnline : styles.recentStatusOffline,
              ]}
            />
          </View>
        </View>
        <View style={styles.recentCopy}>
          <Text numberOfLines={1} style={styles.recentName}>
            {record.hostName}
          </Text>
          <Text numberOfLines={1} style={styles.recentMeta}>
            {metaLabel}
          </Text>
          <Text numberOfLines={1} style={styles.recentActivity}>
            {formatPostCallDateTime(record.endedAtIso)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={`Call ${record.hostName}`}
        accessibilityRole="button"
        hitSlop={ui.hitSlop}
        onPress={() => {
          onCall();
        }}
        style={({ pressed }) => [
          styles.recentCallButton,
          online ? null : styles.recentCallButtonOffline,
          pressed ? styles.pressed : null,
        ]}
      >
        <Animated.View
          style={[styles.recentCallPulse, online ? callPulseStyle : null]}
        />
        <LottieIllustration
          assetId="callNowPulse"
          fallback={
            <View
              style={[
                styles.recentCallFallback,
                online ? null : styles.recentCallFallbackOffline,
              ]}
            >
              <PhoneCall color="#ffffff" size={26} />
            </View>
          }
          fallbackLabel="Call animation"
          playing
          style={[
            styles.recentCallAnimation,
            online ? null : styles.recentCallAnimationOffline,
          ]}
          testID={`recent-call-animation-${record.callId}`}
        />
      </Pressable>
    </Card>
  );
}
function EvidenceCard({
  evidence,
  title,
}: {
  evidence: PostCallEvidenceMetadata | null;
  title: string;
}) {
  if (evidence === null) {
    return null;
  }

  return (
    <Card style={styles.cardStack}>
      <Text style={styles.cardTitle}>{title}</Text>
      <DetailLine label="File" value={evidence.fileName} />
      <DetailLine
        label="Size"
        value={`${String(evidence.width)} × ${String(evidence.height)}`}
      />
      <DetailLine
        label="Captured"
        value={formatPostCallDateTime(evidence.capturedAtIso)}
      />
    </Card>
  );
}

export function PostCallSummaryScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const params = useLocalSearchParams<{
    callId?: string;
    connectedDurationMs?: string;
    endedAtIso?: string;
    hostId?: string;
    hostName?: string;
    mediaMode?: string;
    reason?: string;
    remainingBalancePaise?: string;
    sessionId?: string;
    videoDurationMs?: string;
  }>();
  const summaryParams = useMemo(
    () => parseCallSummaryRouteParams(params),
    [params],
  );
  const seed = toSummarySeed(summaryParams);
  const query = usePostCallRecordQuery(seed?.callId ?? null, seed);
  const [blockingHost, setBlockingHost] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: 'error' | 'info' | 'success' | 'warning';
  } | null>(null);
  const finalizedNotifiedRef = useRef(false);

  useEffect(() => {
    if (query.data?.finalizationStatus !== 'processing') {
      return;
    }

    const timeout = setTimeout(() => {
      void query.refetch();
    }, summaryPollIntervalMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [query, query.data?.finalizationStatus]);

  useEffect(() => {
    if (
      query.data?.finalizationStatus === 'finalized' &&
      !finalizedNotifiedRef.current
    ) {
      finalizedNotifiedRef.current = true;
      haptics.success();
    }
  }, [haptics, query.data?.finalizationStatus]);

  return (
    <ScrollScreen testID="post-call-summary-screen">
      <QueryCardState
        emptyMessage="The summary did not include a persisted call identifier."
        emptyTitle="Summary unavailable"
        query={query}
        skeletonLines={6}
      >
        {(record) => (
          <>
            <View style={styles.summaryHeroWrap}>
              <LottieIllustration
                assetId="connectoPulse"
                fallbackLabel="Call ended"
                style={styles.summaryIllustration}
              />
              <CallHeroCard record={record} />
            </View>

            <StatusBannerForRecord record={record} />
            {notice === null ? null : (
              <Banner
                message={notice.message}
                title={notice.title}
                tone={notice.tone}
              />
            )}

            <CallBreakdownCard record={record} />
            <CallSupportCard record={record} />
            <RatingReadOnlyCard record={record} />
            <RatingComposer
              onReportInstead={() => {
                router.push(
                  routeWithReturnTo(
                    {
                      params: { callId: record.callId },
                      pathname: appRoutes.customerSupport.path,
                    },
                    callDetailReturnPath(record.callId),
                  ),
                );
              }}
              onSkip={() => {
                router.replace(appRoutes.customerHome.path);
              }}
              record={record}
              showSkip
            />

            <SectionHeader
              subtitle="Issue reporting and call details read from the same persisted mock adapter."
              title="Next actions"
            />
            <View style={styles.inlineActionRow}>
              <Button
                onPress={() => {
                  router.replace(appRoutes.customerHome.path);
                }}
                testID="post-call-home"
                title="Return Home"
              />
              <Button
                onPress={() => {
                  router.push({
                    params: {
                      callId: record.callId,
                      returnTo: appRoutes.customerCalls.path,
                    },
                    pathname: appRoutes.customerCallDetail.path,
                  });
                }}
                testID="post-call-details"
                title="View details"
                variant="secondary"
              />
              <Button
                icon={Flag}
                onPress={() => {
                  router.push(
                    routeWithReturnTo(
                      {
                        params: { callId: record.callId },
                        pathname: appRoutes.customerSupport.path,
                      },
                      callDetailReturnPath(record.callId),
                    ),
                  );
                }}
                testID="post-call-report"
                title="Report issue"
                variant="secondary"
              />
              <Button
                loading={blockingHost}
                onPress={() => {
                  setBlockingHost(true);
                  void blockHostAfterCall(record.hostId)
                    .then(() => {
                      setNotice({
                        message:
                          'This host is hidden from discovery on this device.',
                        title: 'Host blocked',
                        tone: 'warning',
                      });
                    })
                    .catch((error: unknown) => {
                      setNotice({
                        message: normalizeApiError(error).message,
                        title: 'Could not block host',
                        tone: 'error',
                      });
                    })
                    .finally(() => {
                      setBlockingHost(false);
                    });
                }}
                testID="post-call-block-host"
                title="Block host"
                variant="ghost"
              />
            </View>
          </>
        )}
      </QueryCardState>
    </ScrollScreen>
  );
}

export function PostCallHistoryScreen() {
  const router = useRouter();
  const query = usePostCallRecordsQuery();
  const hostsQuery = useHostsQuery();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsiveLayout();
  const [callLogDeleted, setCallLogDeleted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const recentRows = useMemo(
    () =>
      sortPostCallRecords(query.data ?? [])
        .slice(0, 3)
        .map((record) => ({
          host: hostsQuery.data?.find((item) => item.id === record.hostId),
          record,
        })),
    [hostsQuery.data, query.data],
  );
  const visibleRows = useMemo(
    () =>
      callLogDeleted
        ? []
        : onlineOnly
          ? recentRows.filter((row) => row.host?.availability === 'online')
          : recentRows,
    [callLogDeleted, onlineOnly, recentRows],
  );
  const dateLabel =
    visibleRows[0] === undefined
      ? null
      : formatRecentDate(visibleRows[0].record.endedAtIso);
  const tabContentInset = getFloatingTabBarContentInset(insets.bottom);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const openProfile = useCallback(() => {
    setMenuOpen(false);
    router.push(appRoutes.customerProfile.path);
  }, [router]);

  const recharge = useCallback(() => {
    setMenuOpen(false);
    router.push({
      params: { returnTo: appRoutes.customerCalls.path },
      pathname: appRoutes.customerAddMoney.path,
    });
  }, [router]);

  const deleteCallLog = useCallback(() => {
    setMenuOpen(false);
    setCallLogDeleted(true);
  }, []);

  const startRecentCall = useCallback(
    (record: PostCallRecord) => {
      const host = hostsQuery.data?.find((item) => item.id === record.hostId);

      if (host === undefined) {
        router.push({
          params: {
            callId: record.callId,
            returnTo: appRoutes.customerCalls.path,
          },
          pathname: appRoutes.customerCallDetail.path,
        });
        return;
      }

      router.push({
        params: outgoingCallRouteParamsForHost(host),
        pathname: appRoutes.callOutgoing.path,
      });
    },
    [hostsQuery.data, router],
  );

  const overflowMenu = (
    <RecentsOverflowMenu
      onDeleteCallLog={deleteCallLog}
      onDismiss={() => {
        setMenuOpen(false);
      }}
      onOpenProfile={openProfile}
      onRecharge={recharge}
      top={insets.top + 58}
      visible={menuOpen}
    />
  );

  if (query.isPending) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.recentsSafeArea}
      >
        <View
          style={[styles.recentsLoadingWrap, { paddingHorizontal: gutter }]}
        >
          <RecentsHeader
            onOpenMenu={() => {
              setMenuOpen((current) => !current);
            }}
            onlineOnly={onlineOnly}
            onOnlineOnlyChange={setOnlineOnly}
          />
          <Card>
            <Skeleton lines={8} />
          </Card>
        </View>
        {overflowMenu}
      </SafeAreaView>
    );
  }

  if (query.isError) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.recentsSafeArea}
      >
        <View
          style={[styles.recentsLoadingWrap, { paddingHorizontal: gutter }]}
        >
          <RecentsHeader
            onOpenMenu={() => {
              setMenuOpen((current) => !current);
            }}
            onlineOnly={onlineOnly}
            onOnlineOnlyChange={setOnlineOnly}
          />
          <ErrorState
            message={normalizeApiError(query.error).message}
            onRetry={() => {
              void query.refetch();
            }}
            title="Could not load recents"
          />
        </View>
        {overflowMenu}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={styles.recentsSafeArea}
    >
      <FlashList
        ListEmptyComponent={
          <EmptyState
            message="Recent calls will appear here after your first conversation."
            title="No recents yet"
          />
        }
        ListFooterComponent={<View style={{ height: ui.spacing[4] }} />}
        ListHeaderComponent={
          <View style={styles.recentsListHeader}>
            <RecentsHeader
              onOpenMenu={() => {
                setMenuOpen((current) => !current);
              }}
              onlineOnly={onlineOnly}
              onOnlineOnlyChange={setOnlineOnly}
            />
            {dateLabel === null ? null : (
              <Text style={styles.recentsDateLabel}>{dateLabel}</Text>
            )}
          </View>
        }
        contentContainerStyle={{
          paddingBottom: tabContentInset,
          paddingHorizontal: gutter,
          paddingTop: 0,
        }}
        data={visibleRows}
        keyExtractor={(item) => item.record.callId}
        maintainVisibleContentPosition={{ disabled: true }}
        onRefresh={() => {
          void refresh();
        }}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <CallHistoryRow
            {...(item.host === undefined ? {} : { host: item.host })}
            onCall={() => {
              startRecentCall(item.record);
            }}
            onPress={() => {
              router.push({
                params: {
                  callId: item.record.callId,
                  returnTo: appRoutes.customerCalls.path,
                },
                pathname: appRoutes.customerCallDetail.path,
              });
            }}
            record={item.record}
          />
        )}
        testID="post-call-history-list"
      />
      {overflowMenu}
    </SafeAreaView>
  );
}
export function PostCallDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    callId?: string | string[];
    returnTo?: string | string[];
  }>();
  const callId = readParam(params.callId) ?? null;
  const returnTo = readParam(params.returnTo);
  const query = usePostCallRecordQuery(callId);

  return (
    <ScrollScreen testID="post-call-detail-screen">
      <BackHeader
        onPress={() => {
          router.replace(returnTo ?? appRoutes.customerCalls.path);
        }}
        title="Call detail"
      />
      <QueryCardState
        emptyMessage="The selected call could not be found."
        emptyTitle="Call not found"
        query={query}
        skeletonLines={7}
      >
        {(record) => (
          <>
            <CallHeroCard record={record} />
            <StatusBannerForRecord record={record} />
            <CallBreakdownCard record={record} />
            <CallSupportCard record={record} />
            <Card style={styles.cardStack}>
              <Text style={styles.cardTitle}>Call context</Text>
              <DetailLine
                label="Voice duration"
                value={formatPostCallDuration(record.voiceDurationSeconds)}
              />
              <DetailLine
                label="Video duration"
                value={formatPostCallDuration(record.videoDurationSeconds)}
              />
              <DetailLine
                label="Host language"
                value={record.hostPrimaryLanguage}
              />
              <DetailLine label="Host age" value={String(record.hostAge)} />
            </Card>
            <RatingReadOnlyCard record={record} />
            <RatingComposer
              onReportInstead={() => {
                router.push(
                  routeWithReturnTo(
                    {
                      params: { callId: record.callId },
                      pathname: appRoutes.customerSupport.path,
                    },
                    callDetailReturnPath(record.callId),
                  ),
                );
              }}
              record={record}
              showSkip={false}
            />
            <View style={styles.inlineActionRow}>
              <Button
                icon={Flag}
                onPress={() => {
                  router.push(
                    routeWithReturnTo(
                      {
                        params: { callId: record.callId },
                        pathname: appRoutes.customerSupport.path,
                      },
                      callDetailReturnPath(record.callId),
                    ),
                  );
                }}
                title="Report issue"
                variant="secondary"
              />
            </View>
          </>
        )}
      </QueryCardState>
    </ScrollScreen>
  );
}

export function PostCallSupportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    callId?: string | string[];
    returnTo?: string | string[];
  }>();
  const selectedCallFromParams = readParam(params.callId) ?? null;
  const returnTo = readParam(params.returnTo);
  const recordsQuery = usePostCallRecordsQuery();
  const ticketsQuery = usePostCallSupportTicketsQuery();
  const evidenceMutation = useCreatePostCallEvidenceMetadata();
  const submitMutation = useSubmitPostCallSupportTicketMutation();
  const [category, setCategory] = useState<PostCallIssueCategory>('billing');
  const [comments, setComments] = useState('');
  const [evidence, setEvidence] = useState<PostCallEvidenceMetadata | null>(
    null,
  );
  const [selectedCallIdOverride, setSelectedCallIdOverride] = useState<
    string | null
  >(selectedCallFromParams);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedCallId = useMemo(
    () =>
      selectedCallIdOverride ??
      (recordsQuery.data === undefined
        ? null
        : (sortPostCallRecords(recordsQuery.data)[0]?.callId ?? null)),
    [recordsQuery.data, selectedCallIdOverride],
  );

  const selectedCall = useMemo(
    () =>
      recordsQuery.data?.find((record) => record.callId === selectedCallId) ??
      null,
    [recordsQuery.data, selectedCallId],
  );

  const submit = () => {
    if (comments.trim().length < 8) {
      setFormError('Add at least a short description so support has context.');
      return;
    }

    setFormError(null);
    submitMutation.mutate(
      {
        category,
        comments,
        evidence,
        linkedCallId: selectedCall?.callId ?? null,
        requesterId: mobileDataIds.customerId,
        subject:
          selectedCall === null
            ? resolvePostCallIssueCategoryLabel(category)
            : `${resolvePostCallIssueCategoryLabel(category)} for ${selectedCall.hostName}`,
      },
      {
        onSuccess: (ticket) => {
          router.replace({
            params: {
              returnTo: appRoutes.customerSupport.path,
              ticketId: ticket.id,
            },
            pathname: appRoutes.customerSupportTicket.path,
          });
        },
      },
    );
  };

  return (
    <KeyboardScreen
      bottomAction={
        <Button
          loading={submitMutation.isPending}
          onPress={submit}
          testID="support-submit"
          title="Submit issue"
        />
      }
      testID="post-call-support-screen"
    >
      <BackHeader
        onPress={() => {
          router.replace(returnTo ?? appRoutes.customerCalls.path);
        }}
        title="Support & issues"
      />
      <SectionHeader
        subtitle="Issues become typed support tickets with optional local evidence metadata."
        title="New issue"
      />
      {recordsQuery.data === undefined ||
      recordsQuery.data.length === 0 ? null : (
        <View style={styles.callChoiceWrap}>
          {sortPostCallRecords(recordsQuery.data)
            .slice(0, 4)
            .map((record) => (
              <TagChip
                key={record.callId}
                label={record.hostName}
                onPress={() => {
                  setSelectedCallIdOverride(record.callId);
                }}
                selected={record.callId === selectedCallId}
              />
            ))}
        </View>
      )}
      {selectedCall === null ? null : <CallHeroCard record={selectedCall} />}
      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Category</Text>
        <View style={styles.optionStack}>
          {issueCategories.map((option) => (
            <RadioCard
              description={option.description}
              key={option.category}
              label={resolvePostCallIssueCategoryLabel(option.category)}
              onPress={() => {
                setCategory(option.category);
              }}
              selected={category === option.category}
              testID={`support-category-${option.category}`}
            />
          ))}
        </View>
      </Card>
      <TextArea
        {...(formError === null ? {} : { errorText: formError })}
        helperText="Visible only in this local mock support flow."
        label="Describe the issue"
        onChangeText={setComments}
        placeholder="Explain what happened and when support should review it."
        testID="support-comments"
        value={comments}
      />
      {submitMutation.isError ? (
        <InlineError
          message={normalizePostCallErrorMessage(submitMutation.error)}
        />
      ) : null}
      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Evidence</Text>
        <Text style={styles.body}>
          Screenshot capture stays frontend-only. The current adapter stores
          file metadata, not media bytes.
        </Text>
        <Button
          icon={FileText}
          loading={evidenceMutation.isPending}
          onPress={() => {
            const evidenceInput =
              selectedCall?.callId === undefined
                ? {}
                : { callId: selectedCall.callId };

            evidenceMutation.mutate(evidenceInput, {
              onSuccess: (result) => {
                setEvidence(result);
              },
            });
          }}
          testID="support-attach-evidence"
          title={
            evidence === null
              ? 'Attach screenshot metadata'
              : 'Replace screenshot metadata'
          }
          variant="secondary"
        />
      </Card>
      <EvidenceCard evidence={evidence} title="Attached metadata" />
      <SectionHeader
        subtitle="Existing tickets stay accessible from wallet and call flows too."
        title="Existing tickets"
      />
      <QueryCardState
        emptyMessage="Submitted issues will appear here."
        emptyTitle="No support tickets"
        isEmpty={(tickets) => tickets.length === 0}
        query={ticketsQuery}
      >
        {(tickets) => (
          <View style={styles.stack}>
            {tickets.map((ticket) => (
              <Pressable
                accessibilityLabel={`Open support ticket ${ticket.ticketReference}`}
                accessibilityRole="button"
                key={ticket.id}
                onPress={() => {
                  router.push({
                    params: {
                      returnTo: appRoutes.customerSupport.path,
                      ticketId: ticket.id,
                    },
                    pathname: appRoutes.customerSupportTicket.path,
                  });
                }}
                style={({ pressed }) => [
                  styles.listRowCard,
                  pressed ? styles.pressed : null,
                ]}
                testID={`support-ticket-${ticket.id}`}
              >
                <View style={styles.listRowHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{ticket.issueSummary}</Text>
                    <Text style={styles.helper}>
                      {resolvePostCallIssueCategoryLabel(ticket.category)} •{' '}
                      {formatPostCallDateTime(ticket.updatedAtIso)}
                    </Text>
                  </View>
                  <StatusBadge label={ticket.status} tone="warning" />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </QueryCardState>
    </KeyboardScreen>
  );
}

export function PostCallSupportTicketDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
    ticketId?: string | string[];
  }>();
  const ticketId = readParam(params.ticketId) ?? null;
  const returnTo = readParam(params.returnTo);
  const ticketQuery = usePostCallSupportTicketQuery(ticketId);

  return (
    <ScrollScreen testID="post-call-support-ticket-screen">
      <BackHeader
        onPress={() => {
          router.replace(returnTo ?? appRoutes.customerSupport.path);
        }}
        title="Support ticket"
      />
      <QueryCardState
        emptyMessage="The selected ticket is not available."
        emptyTitle="Ticket not found"
        query={ticketQuery}
      >
        {(ticket) => (
          <>
            <Card style={styles.cardStack}>
              <View style={styles.listRowHeader}>
                <Text style={styles.cardTitle}>{ticket.issueSummary}</Text>
                <StatusBadge label={ticket.status} tone="warning" />
              </View>
              <DetailLine label="Reference" value={ticket.ticketReference} />
              <DetailLine
                label="Category"
                value={resolvePostCallIssueCategoryLabel(ticket.category)}
              />
              <DetailLine
                label="Created"
                value={formatPostCallDateTime(ticket.createdAtIso)}
              />
              <Text style={styles.body}>{ticket.comments}</Text>
            </Card>
            <EvidenceCard
              evidence={ticket.evidence}
              title="Evidence metadata"
            />
            <View style={styles.inlineActionRow}>
              {ticket.linkedCallId === null ? null : (
                <Button
                  icon={LifeBuoy}
                  onPress={() => {
                    router.push({
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

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  callChoiceWrap: {
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
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  detailLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    flex: 1,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  detailLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  detailValue: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'right',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
    justifyContent: 'flex-end',
  },
  flex: {
    flex: 1,
  },
  helper: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  heroCard: {
    gap: ui.spacing[4],
  },
  heroCopy: {
    flex: 1,
    gap: ui.spacing[2],
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  heroTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  historyHeaderCopy: {
    flex: 1,
    gap: ui.spacing[1],
    minWidth: 220,
  },
  historyHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  historyHeaderTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  inlineActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  listHeader: {
    gap: ui.spacing[4],
    paddingBottom: ui.spacing[4],
  },
  listRowCard: {
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderColor: ui.glass.border,
    borderRadius: ui.radii.xl,
    borderWidth: 1,
    gap: ui.spacing[3],
    marginBottom: ui.spacing[3],
    padding: ui.spacing[4],
  },
  listRowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  listRowLead: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  moneyValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.body.lineHeight,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  optionStack: {
    gap: ui.spacing[3],
  },
  pressed: {
    opacity: 0.82,
  },
  ratingHeadline: {
    color: ui.color.accent.coral,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  recentActivity: {
    color: '#6f6f73',
    fontFamily: ui.font.regular,
    fontSize: 14,
    lineHeight: 18,
  },
  recentAvatarColumn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    width: 70,
  },
  recentAvatarFrame: {
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderWidth: 1,
    borderRadius: 28,
    height: 56,
    overflow: 'visible',
    width: 56,
  },
  recentCallButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'visible',
    width: 52,
  },
  recentCallAnimation: {
    backgroundColor: 'transparent',
    borderRadius: 26,
    height: 52,
    minHeight: 52,
    minWidth: 52,
    width: 52,
    zIndex: 1,
  },
  recentCallAnimationOffline: {
    opacity: 0.82,
  },
  recentCallFallback: {
    alignItems: 'center',
    backgroundColor: 'rgba(62,111,217,0.92)',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  recentCallPulse: {
    backgroundColor: 'rgba(62,111,217,0.18)',
    borderColor: 'rgba(62,111,217,0.3)',
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    position: 'absolute',
    width: 52,
  },
  recentCallButtonOffline: {
    opacity: 0.9,
  },
  recentCallFallbackOffline: {
    backgroundColor: '#bfbfbf',
  },
  recentCard: {
    alignItems: 'center',
    borderRadius: 26,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    minHeight: 104,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  recentCopy: {
    backgroundColor: 'transparent',
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  recentMeta: {
    color: '#303034',
    fontFamily: ui.font.regular,
    fontSize: 14,
    lineHeight: 18,
  },
  recentName: {
    color: '#0b0b0d',
    fontFamily: ui.font.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  recentOpenTarget: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  recentStatusDot: {
    borderColor: ui.glass.borderStrong,
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    position: 'absolute',
    right: -2,
    top: -1,
    width: 16,
  },
  recentStatusOffline: {
    backgroundColor: '#bfbfbf',
  },
  recentStatusOnline: {
    backgroundColor: '#21cf45',
  },
  recentStatusPulse: {
    borderColor: '#21cf45',
    borderRadius: 11,
    height: 22,
    position: 'absolute',
    right: -5,
    top: -4,
    width: 22,
  },
  recentsActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  recentsDateLabel: {
    color: '#2a2a2e',
    fontFamily: ui.font.bold,
    fontSize: 19,
    lineHeight: 24,
    paddingLeft: 8,
  },
  recentsListHeader: {
    gap: 18,
    paddingBottom: 16,
    position: 'relative',
    zIndex: 10,
  },
  recentsLoadingWrap: {
    gap: 26,
    paddingTop: ui.spacing[4],
  },
  recentsMenuButton: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  recentsMenuDivider: {
    backgroundColor: '#2d2d2f',
    height: StyleSheet.hairlineWidth,
    opacity: 0.7,
  },
  recentsMenuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    minHeight: 54,
    paddingHorizontal: 20,
  },
  recentsMenuText: {
    color: '#111111',
    fontFamily: ui.font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  recentsOnlineLabel: {
    color: '#4779f3',
    fontFamily: ui.font.bold,
    fontSize: 18,
    lineHeight: 23,
  },
  recentsOnlineToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  recentsOverflowMenu: {
    borderRadius: 22,
    paddingVertical: 10,
    position: 'absolute',
    right: 20,
    width: 216,
  },
  recentsMenuModal: {
    backgroundColor: 'rgba(39,25,42,0.10)',
    flex: 1,
  },
  recentsSafeArea: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  recentsTitle: {
    color: '#000000',
    fontFamily: ui.font.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  recentsTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
  },
  rowTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  safeArea: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  stack: {
    gap: ui.spacing[3],
  },
  starButton: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.borderStrong,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: ui.minTouch,
    justifyContent: 'center',
    width: ui.minTouch,
  },
  starButtonSelected: {
    backgroundColor: ui.color.accent.coralSoft,
    borderColor: ui.color.accent.coral,
  },
  starRow: {
    flexDirection: 'row',
    gap: ui.spacing[2],
  },
  successText: {
    color: ui.color.status.success,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  summaryHeroWrap: {
    alignItems: 'center',
    gap: ui.spacing[4],
  },
  summaryIllustration: {
    width: 124,
  },
  summaryMetric: {
    backgroundColor: ui.glass.surfaceSoft,
    borderRadius: ui.radii.lg,
    flexGrow: 1,
    minWidth: 92,
    padding: ui.spacing[3],
  },
  summaryMetricLabel: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  summaryMetricValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.body.lineHeight,
    marginTop: ui.spacing[1],
  },
  tagChip: {
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    minHeight: ui.minTouch,
    justifyContent: 'center',
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[2],
  },
  tagChipSelected: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.brand.primary,
  },
  tagChipText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  tagChipTextSelected: {
    color: ui.color.brand.primary,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  trailingColumn: {
    alignItems: 'flex-end',
    gap: ui.spacing[2],
  },
});

export const prePersistPostCallRecord = (input: EnsurePostCallRecordInput) =>
  postCallAdapter.ensureCallRecord(input).then(() => undefined);
