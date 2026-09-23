import {
  Clock3,
  Copy,
  Gift,
  Link2,
  Share2,
  UserPlus,
  Wallet,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { normalizeApiError } from '@connecto/domain';

import { LottieIllustration } from '@/components/animations/LottieIllustration';
import { ScrollScreen } from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Snackbar, Banner } from '@/components/ui/feedback';
import { useReducedMotion } from '@/components/ui/interaction';
import {
  AppHeader,
  BackHeader,
  SectionHeader,
} from '@/components/ui/navigation';
import {
  Card,
  EmptyState,
  ErrorState,
  GlassSurface,
  Skeleton,
  StatusBadge,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import {
  mobileDataIds,
  useCustomerProfileQuery,
} from '@/features/data/mobileDataHooks';
import { useHaptics } from '@/motion/MotionProvider';
import { appRoutes } from '@/navigation/routes';
import { useAuthStore } from '@/store/auth.store';

import {
  referralFeatureAdapter,
  normalizeReferralFeatureError,
} from './referral.adapters';
import {
  useCopyReferralLinkMutation,
  useReferralDetailQuery,
  useReferralOverviewQuery,
  useReferralUiStateQuery,
  useShareReferralMutation,
} from './referral.hooks';
import {
  buildOwnReferralCode,
  formatReferralCurrency,
  formatReferralDateTime,
  getReferralCelebrationEligible,
  normalizeReferralCode,
  getReferralProgress,
  resolveReferralPerspectiveLabel,
  resolveReferralStatusLabel,
  resolveReferralStatusTone,
  resolveRetroactiveReferralMessage,
  type ReferralHistoryRecord,
} from './referral.models';
import { resolveReferralLinkDestination } from './referral.navigation';

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

const referralDetailReturnPath = (referralId: string | null) =>
  referralId === null
    ? appRoutes.customerReferrals.path
    : `${appRoutes.customerReferrals.path}/${encodeURIComponent(referralId)}`;

function ScreenStack({ children }: PropsWithChildren) {
  return <View style={styles.screenStack}>{children}</View>;
}

function ReferralSkeletonScreen({ title }: { title: string }) {
  return (
    <ScrollScreen testID={`${title}-loading`}>
      <AppHeader
        subtitle="Rewards only release after qualification and verification."
        title={title}
      />
      <Card>
        <Skeleton lines={7} />
      </Card>
      <Card>
        <Skeleton lines={5} />
      </Card>
    </ScrollScreen>
  );
}

function AnimatedProgressBar({ progress }: { progress: number }) {
  const reducedMotionEnabled = useReducedMotion();
  const [animatedValue] = useState(() => new Animated.Value(progress));

  useEffect(() => {
    Animated.timing(animatedValue, {
      duration: reducedMotionEnabled ? 0 : 220,
      toValue: progress,
      useNativeDriver: false,
    }).start();
  }, [animatedValue, progress, reducedMotionEnabled]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

function RewardCopyCard({
  body,
  label,
  reward,
}: {
  body: string;
  label: string;
  reward: string;
}) {
  return (
    <Card style={styles.rewardCopyCard}>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={styles.rewardAmount}>{reward}</Text>
      <Text style={styles.body}>{body}</Text>
    </Card>
  );
}

function TimelineCard({
  record,
  transactionCta,
}: {
  record: ReferralHistoryRecord;
  transactionCta?: React.ReactNode;
}) {
  return (
    <Card style={styles.cardStack}>
      <View style={styles.timelineHeader}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{record.headline}</Text>
          <Text style={styles.body}>{record.statusMessage}</Text>
        </View>
        <StatusBadge
          label={resolveReferralStatusLabel(record.status)}
          tone={resolveReferralStatusTone(record.status)}
        />
      </View>
      <AnimatedProgressBar progress={getReferralProgress(record)} />
      <View style={styles.timelineStack}>
        {record.timeline.map((step) => (
          <View key={step.key} style={styles.timelineRow}>
            <View
              style={[
                styles.timelineDot,
                step.state === 'complete'
                  ? styles.timelineDotComplete
                  : step.state === 'current'
                    ? styles.timelineDotCurrent
                    : step.state === 'rejected'
                      ? styles.timelineDotRejected
                      : step.state === 'expired'
                        ? styles.timelineDotExpired
                        : null,
              ]}
            />
            <View style={styles.flex}>
              <View style={styles.timelineLabelRow}>
                <Text style={styles.timelineLabel}>{step.label}</Text>
                <Text style={styles.timelineState}>
                  {step.state === 'complete'
                    ? 'Done'
                    : step.state === 'current'
                      ? 'In progress'
                      : step.state === 'rejected'
                        ? 'Closed'
                        : step.state === 'expired'
                          ? 'Expired'
                          : 'Waiting'}
                </Text>
              </View>
              <Text style={styles.helper}>{step.helperText}</Text>
              {step.completedAtIso === null ? null : (
                <Text style={styles.meta}>
                  {formatReferralDateTime(step.completedAtIso)}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
      {transactionCta}
    </Card>
  );
}

function ReferralHistoryRow({
  onPress,
  record,
}: {
  onPress: () => void;
  record: ReferralHistoryRecord;
}) {
  return (
    <GlassSurface
      contentStyle={styles.historyGlassContent}
      radius={ui.radii.xl}
      shadow="soft"
      variant="standard"
    >
      <Pressable
        accessibilityLabel={`Open referral ${record.subjectLabel}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.historyRow,
          pressed ? styles.pressed : null,
        ]}
        testID={`referral-row-${record.id}`}
      >
        <View style={styles.historyIcon}>
          {record.perspective === 'new-customer' ? (
            <Gift color={ui.color.brand.primary} size={20} />
          ) : (
            <UserPlus color={ui.color.brand.primary} size={20} />
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{record.subjectLabel}</Text>
          <Text style={styles.helper}>{record.headline}</Text>
          <Text style={styles.meta}>
            {formatReferralDateTime(record.updatedAtIso)}
          </Text>
        </View>
        <View style={styles.historyTrailing}>
          <Text style={styles.amountMeta}>
            {formatReferralCurrency(record.rewardAmount)}
          </Text>
          <StatusBadge
            label={resolveReferralStatusLabel(record.status)}
            tone={resolveReferralStatusTone(record.status)}
          />
        </View>
      </Pressable>
    </GlassSurface>
  );
}

function JoinedRewardSummary({
  appliedReferralCode,
  record,
}: {
  appliedReferralCode: string | null;
  record: ReferralHistoryRecord | null;
}) {
  if (record === null) {
    return (
      <Card style={styles.cardStack}>
        <Text style={styles.cardTitle}>Referral code entry</Text>
        <Text style={styles.body}>
          {appliedReferralCode === null
            ? 'This account is already active, so a referral code cannot be added retroactively.'
            : `Code ${appliedReferralCode} was saved, but the reward history is still syncing.`}
        </Text>
        <Banner
          message="Referral codes lock before the first verified login and never after an existing account is already active."
          title="Signup-only rule"
          tone="warning"
        />
      </Card>
    );
  }

  return <TimelineCard record={record} />;
}

export function CustomerReferralOverviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ incomingCode?: string | string[] }>();
  const incomingCode =
    readParam(params.incomingCode)?.trim().toUpperCase() ?? '';
  const haptics = useHaptics();
  const reducedMotionEnabled = useReducedMotion();
  const profileQuery = useCustomerProfileQuery();
  const [snackbarNotice, setSnackbarNotice] = useState<string | null>(null);
  const [copyScale] = useState(() => new Animated.Value(1));

  const ownReferralCode = useMemo(() => {
    if (profileQuery.data === undefined) {
      return '';
    }

    return buildOwnReferralCode(
      profileQuery.data.displayName,
      profileQuery.data.id,
    );
  }, [profileQuery.data]);

  const overviewQuery = useReferralOverviewQuery(
    profileQuery.data?.id ?? mobileDataIds.customerId,
    ownReferralCode,
  );
  const shareMutation = useShareReferralMutation();
  const copyMutation = useCopyReferralLinkMutation();

  useEffect(() => {
    if (snackbarNotice === null) {
      return;
    }

    const timeout = setTimeout(() => {
      setSnackbarNotice(null);
    }, 1800);

    return () => {
      clearTimeout(timeout);
    };
  }, [snackbarNotice]);

  const triggerCopyMicroInteraction = () => {
    if (reducedMotionEnabled) {
      return;
    }

    copyScale.setValue(0.98);
    Animated.sequence([
      Animated.timing(copyScale, {
        duration: 120,
        toValue: 1.04,
        useNativeDriver: true,
      }),
      Animated.timing(copyScale, {
        duration: 120,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  if (profileQuery.isPending || overviewQuery.isPending) {
    return <ReferralSkeletonScreen title="Refer & Earn" />;
  }

  if (profileQuery.isError || overviewQuery.isError) {
    const error = normalizeApiError(
      profileQuery.isError ? profileQuery.error : overviewQuery.error,
    );

    return (
      <ScrollScreen testID="referral-overview-error">
        <AppHeader
          subtitle="Rewards only release after qualification and verification."
          title="Refer & Earn"
        />
        <ErrorState
          message={error.message}
          onRetry={() => {
            void profileQuery.refetch();
            void overviewQuery.refetch();
          }}
          title={error.code === 'offline' ? 'Offline' : 'Could not load'}
        />
      </ScrollScreen>
    );
  }

  const overview = overviewQuery.data;
  const joinedRewardRecord =
    overview.history.find((record) => record.perspective === 'new-customer') ??
    null;
  const shareInput = {
    code: overview.ownReferralCode,
    link: overview.shareLink,
    message: overview.shareMessage,
  };

  return (
    <ScrollScreen testID="referral-overview-screen">
      <ScreenStack>
        <AppHeader
          subtitle="Rewards release only after add money, paid call qualification, and verification."
          title="Refer & Earn"
        />
        {incomingCode.length === 0 ? null : (
          <Banner
            message={resolveRetroactiveReferralMessage(incomingCode)}
            title="Code locked to signup"
            tone="warning"
          />
        )}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Your referral code</Text>
              <Animated.View
                style={[
                  styles.codePill,
                  {
                    transform: [{ scale: copyScale }],
                  },
                ]}
              >
                <Text style={styles.codeValue}>{overview.ownReferralCode}</Text>
              </Animated.View>
              <Text style={styles.body}>
                Share your code or deep link. Rewards never move instantly on a
                signup alone.
              </Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Gift color={ui.color.brand.primary} size={24} />
            </View>
          </View>
          <View style={styles.linkShell}>
            <Link2 color={ui.color.text.secondary} size={18} />
            <Text numberOfLines={2} style={styles.linkValue}>
              {overview.shareLink}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Button
              icon={Share2}
              loading={shareMutation.isPending}
              onPress={() => {
                shareMutation.mutate(shareInput, {
                  onSuccess: (result) => {
                    if (result.kind === 'shared') {
                      haptics.success();
                    }
                    setSnackbarNotice(result.notice);
                  },
                });
              }}
              testID="referral-share"
              title="Share link"
            />
            <Button
              icon={Copy}
              loading={copyMutation.isPending}
              onPress={() => {
                copyMutation.mutate(shareInput, {
                  onSuccess: (result) => {
                    triggerCopyMicroInteraction();
                    haptics.selection();
                    setSnackbarNotice(result.notice);
                  },
                });
              }}
              testID="referral-copy"
              title="Copy link"
              variant="secondary"
            />
          </View>
          {shareMutation.isError ? (
            <Banner
              message={
                normalizeReferralFeatureError(shareMutation.error).message
              }
              title="Could not share"
              tone="error"
            />
          ) : null}
          {copyMutation.isError ? (
            <Banner
              message={
                normalizeReferralFeatureError(copyMutation.error).message
              }
              title="Could not copy"
              tone="error"
            />
          ) : null}
        </Card>

        <View style={styles.rewardCards}>
          <RewardCopyCard
            body="New customers earn this only after the first qualified add money, paid call, and verification."
            label="New-customer reward"
            reward={formatReferralCurrency(overview.rewardAmounts.newCustomer)}
          />
          <RewardCopyCard
            body="You earn this only after your invitee completes the same milestones and clears verification."
            label="Referrer reward"
            reward={formatReferralCurrency(overview.rewardAmounts.referrer)}
          />
        </View>

        <SectionHeader
          subtitle="If you joined with a code, the same milestone logic applies to your own reward."
          title="Your reward progress"
        />
        <JoinedRewardSummary
          appliedReferralCode={profileQuery.data.referralCode ?? null}
          record={joinedRewardRecord}
        />

        <SectionHeader
          subtitle="This timeline is the exact order used by the mock adapter before any reward can release."
          title="Referral rules"
        />
        <Card style={styles.cardStack}>
          {overview.rules.map((rule) => (
            <View key={rule.id} style={styles.ruleRow}>
              <Clock3 color={ui.color.brand.primary} size={18} />
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{rule.title}</Text>
                <Text style={styles.body}>{rule.body}</Text>
              </View>
            </View>
          ))}
          <Banner
            message="Anti-abuse reviews can delay or withhold rewards. The app explains the state, but it does not pretend to make or reverse fraud decisions on its own."
            title="Verification and policy checks"
            tone="info"
          />
        </Card>

        <SectionHeader
          subtitle="Pending, qualified, rewarded, rejected, and expired entries remain readable in one history."
          title="Referral history"
        />
        {overview.history.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            message="Share your referral link to start tracking milestones here."
            title="No referrals yet"
          />
        ) : (
          <View style={styles.historyStack}>
            {overview.history.map((record) => (
              <ReferralHistoryRow
                key={record.id}
                onPress={() => {
                  router.push({
                    params: {
                      referralId: record.id,
                      returnTo: appRoutes.customerReferrals.path,
                    },
                    pathname: appRoutes.customerReferralDetail.path,
                  });
                }}
                record={record}
              />
            ))}
          </View>
        )}
      </ScreenStack>
      {snackbarNotice === null ? null : <Snackbar message={snackbarNotice} />}
    </ScrollScreen>
  );
}

export function ReferralDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    referralId?: string | string[];
    returnTo?: string | string[];
  }>();
  const referralId = readParam(params.referralId) ?? null;
  const returnTo = readParam(params.returnTo);
  const profileQuery = useCustomerProfileQuery();
  const uiStateQuery = useReferralUiStateQuery();
  const haptics = useHaptics();
  const ownReferralCode = useMemo(() => {
    if (profileQuery.data === undefined) {
      return '';
    }

    return buildOwnReferralCode(
      profileQuery.data.displayName,
      profileQuery.data.id,
    );
  }, [profileQuery.data]);

  const detailQuery = useReferralDetailQuery(
    profileQuery.data?.id ?? mobileDataIds.customerId,
    ownReferralCode,
    referralId,
  );
  const [dismissedCelebrationId, setDismissedCelebrationId] = useState<
    string | null
  >(null);
  const celebrationReady =
    detailQuery.data !== undefined &&
    uiStateQuery.data !== undefined &&
    getReferralCelebrationEligible(
      detailQuery.data,
      uiStateQuery.data.celebratedRewardIds,
    );
  const celebrationVisible =
    celebrationReady && dismissedCelebrationId !== detailQuery.data.id;

  useEffect(() => {
    if (!celebrationVisible) {
      return;
    }

    haptics.success();
    void referralFeatureAdapter.markRewardCelebrationSeen(detailQuery.data.id);

    const timeout = setTimeout(() => {
      setDismissedCelebrationId(detailQuery.data.id);
    }, 1800);

    return () => {
      clearTimeout(timeout);
    };
  }, [celebrationVisible, detailQuery.data, haptics]);

  if (
    profileQuery.isPending ||
    detailQuery.isPending ||
    uiStateQuery.isPending
  ) {
    return <ReferralSkeletonScreen title="Referral detail" />;
  }

  if (profileQuery.isError || detailQuery.isError || uiStateQuery.isError) {
    const error = normalizeApiError(
      profileQuery.isError
        ? profileQuery.error
        : detailQuery.isError
          ? detailQuery.error
          : uiStateQuery.error,
    );

    return (
      <ScrollScreen testID="referral-detail-error">
        <BackHeader
          onPress={() => {
            router.replace(returnTo ?? appRoutes.customerReferrals.path);
          }}
          title="Referral detail"
        />
        <ErrorState
          message={error.message}
          onRetry={() => {
            void profileQuery.refetch();
            void detailQuery.refetch();
            void uiStateQuery.refetch();
          }}
          title={error.code === 'offline' ? 'Offline' : 'Could not load'}
        />
      </ScrollScreen>
    );
  }

  const record = detailQuery.data;

  return (
    <ScrollScreen testID="referral-detail-screen">
      <ScreenStack>
        <BackHeader
          onPress={() => {
            router.replace(returnTo ?? appRoutes.customerReferrals.path);
          }}
          title="Referral detail"
        />
        {celebrationVisible ? (
          <Card style={styles.celebrationCard}>
            <LottieIllustration
              assetId="connectoPulse"
              fallbackLabel="Reward released"
              loop={false}
              playing={celebrationVisible}
              style={styles.celebrationIllustration}
            />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Reward released</Text>
              <Text style={styles.body}>
                This celebration only appears once after the wallet reward is
                first seen on this device.
              </Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.cardStack}>
          <View style={styles.timelineHeader}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>
                {resolveReferralPerspectiveLabel(record.perspective)}
              </Text>
              <Text style={styles.cardTitle}>{record.subjectLabel}</Text>
              <Text style={styles.body}>{record.statusMessage}</Text>
            </View>
            <StatusBadge
              label={resolveReferralStatusLabel(record.status)}
              tone={resolveReferralStatusTone(record.status)}
            />
          </View>
          <View style={styles.detailMetaRow}>
            <Text style={styles.meta}>Code {record.code}</Text>
            <Text style={styles.meta}>
              Updated {formatReferralDateTime(record.updatedAtIso)}
            </Text>
          </View>
          <Text style={styles.rewardAmount}>
            {formatReferralCurrency(record.rewardAmount)}
          </Text>
          {record.antiAbuseMessage === null ? null : (
            <Banner
              message={record.antiAbuseMessage}
              title="Review notice"
              tone="warning"
            />
          )}
        </Card>

        <TimelineCard
          record={record}
          transactionCta={
            record.rewardTransactionId === null ? null : (
              <Button
                icon={Wallet}
                onPress={() => {
                  router.push(
                    routeWithReturnTo(
                      {
                        params: {
                          transactionId: record.rewardTransactionId ?? '',
                        },
                        pathname: appRoutes.customerTransactionDetail.path,
                      },
                      referralDetailReturnPath(referralId),
                    ),
                  );
                }}
                testID="referral-open-transaction"
                title="Open wallet transaction"
                variant="secondary"
              />
            )
          }
        />
      </ScreenStack>
    </ScrollScreen>
  );
}

export function ReferralLinkCaptureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = normalizeReferralCode(readParam(params.code));
  const accountStatus = useAuthStore((state) => state.accountStatus);
  const role = useAuthStore((state) => state.role);
  const sessionId = useAuthStore((state) => state.sessionId);
  const [retryCount, setRetryCount] = useState(0);
  const [linkState, setLinkState] = useState<
    { kind: 'error'; message: string; title: string } | { kind: 'loading' }
  >({
    kind: 'loading',
  });

  useEffect(() => {
    let active = true;

    if (code.length === 0) {
      router.replace(appRoutes.invalidLink.path);
      return () => {
        active = false;
      };
    }

    referralFeatureAdapter
      .resolveInviteAttribution({ code })
      .then((resolution) => {
        if (!active) {
          return;
        }

        if (resolution.attributionStatus !== 'resolved') {
          router.replace(appRoutes.invalidLink.path);
          return;
        }

        router.replace(
          resolveReferralLinkDestination(resolution.code, {
            accountStatus,
            role,
            sessionId,
          }),
        );
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        const normalized = normalizeReferralFeatureError(error);
        setLinkState({
          kind: 'error',
          message: normalized.message,
          title: normalized.code === 'offline' ? 'Offline' : 'Could not open',
        });
      });

    return () => {
      active = false;
    };
  }, [accountStatus, code, retryCount, role, router, sessionId]);

  if (linkState.kind === 'error') {
    return (
      <ScrollScreen testID="referral-link-capture-error">
        <Card style={styles.captureCard}>
          <Text style={styles.cardTitle}>Opening referral link</Text>
          <ErrorState
            message={linkState.message}
            onRetry={() => {
              setLinkState({ kind: 'loading' });
              setRetryCount((current) => current + 1);
            }}
            title={linkState.title}
          />
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen testID="referral-link-capture-screen">
      <Card style={styles.captureCard}>
        <Text style={styles.cardTitle}>Opening referral link</Text>
        <Text style={styles.body}>
          We are resolving referral ownership and invite attribution for code{' '}
          {code || '...'}.
        </Text>
        <Skeleton lines={3} />
      </Card>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  amountMeta: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.label.lineHeight,
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  captureCard: {
    gap: ui.spacing[4],
  },
  cardStack: {
    gap: ui.spacing[4],
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  celebrationCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  celebrationIllustration: {
    minHeight: 92,
    minWidth: 92,
    width: 92,
  },
  codePill: {
    alignSelf: 'flex-start',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[2],
  },
  codeValue: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    letterSpacing: 0.8,
  },
  detailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  eyebrow: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    textTransform: 'uppercase',
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  heroIconWrap: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  historyIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  historyGlassContent: {
    padding: 0,
  },
  historyRow: {
    alignItems: 'center',
    borderRadius: ui.radii.xl,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 76,
    padding: ui.spacing[4],
  },
  historyStack: {
    gap: ui.spacing[3],
  },
  historyTrailing: {
    alignItems: 'flex-end',
    gap: ui.spacing[2],
  },
  linkShell: {
    alignItems: 'flex-start',
    backgroundColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.lg,
    flexDirection: 'row',
    gap: ui.spacing[2],
    padding: ui.spacing[3],
  },
  linkValue: {
    color: ui.color.text.secondary,
    flex: 1,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  meta: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  pressed: {
    opacity: ui.opacity.pressed,
  },
  progressFill: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    height: 8,
    overflow: 'hidden',
  },
  rewardAmount: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    fontVariant: ['tabular-nums'],
    lineHeight: ui.type.headline.lineHeight,
  },
  rewardCards: {
    gap: ui.spacing[4],
  },
  rewardCopyCard: {
    gap: ui.spacing[2],
  },
  rowTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  screenStack: {
    gap: ui.spacing[6],
  },
  timelineDot: {
    backgroundColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  timelineDotComplete: {
    backgroundColor: ui.color.status.success,
  },
  timelineDotCurrent: {
    backgroundColor: ui.color.brand.primary,
  },
  timelineDotExpired: {
    backgroundColor: ui.color.status.warning,
  },
  timelineDotRejected: {
    backgroundColor: ui.color.status.error,
  },
  timelineHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  timelineLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  timelineLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  timelineStack: {
    gap: ui.spacing[4],
  },
  timelineState: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
});
