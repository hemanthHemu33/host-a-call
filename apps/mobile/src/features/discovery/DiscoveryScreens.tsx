import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Svg,
  SvgXml,
} from 'react-native-svg';
import {
  CirclePlus,
  MapPin,
  Mic2,
  Pause,
  PhoneCall,
  Play,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { normalizeApiError, type HostSummary } from '@connecto/domain';

import { resolveCustomerAvatarSource } from '@/assets/avatars/customer-avatars';
import { LottieIllustration } from '@/components/animations/LottieIllustration';

import demoHostVoiceIntro from '../../assets/audio/host-intro-demo.wav';
import { BackHeader } from '@/components/ui/navigation';
import { Screen, ScrollScreen, useResponsiveLayout } from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Banner } from '@/components/ui/feedback';
import { RadioCard, SwitchRow } from '@/components/ui/fields';
import { getFloatingTabBarContentInset } from '@/components/ui/FloatingTabBar';
import {
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import {
  outgoingCallRouteParamsForHost,
  outgoingCallRouteParamsForRandomHosts,
} from '@/features/calls/call.preconnect';
import { usePulseStyle } from '@/motion/reanimated';
import { appRoutes } from '@/navigation/routes';

import {
  applyDiscoveryFilters,
  defaultDiscoveryFilters,
  defaultDiscoveryPreferences,
  formatFilterCountLabel,
  hasPreferredLanguageOnlineHosts,
  sortDiscoveryHosts,
  type DiscoveryFilters,
  type DiscoveryLanguageFilter,
  type DiscoveryPreferences,
  type DiscoveryRankFilter,
} from './discovery.models';
import {
  loadDiscoveryPreferences,
  persistDiscoveryPreferences,
} from './discovery.storage';
import {
  formatMoney,
  useCustomerProfileQuery,
  useHostsQuery,
  useWalletQuery,
} from '../data/mobileDataHooks';

type DiscoveryBanner = null | {
  message: string;
  title: string;
  tone: 'error' | 'info' | 'success' | 'warning';
};

type DiscoveryPreferencesState =
  { kind: 'loading' } | { data: DiscoveryPreferences; kind: 'ready' };

const decodeSvgDataUri = (uri: string | undefined) => {
  const prefix = 'data:image/svg+xml;utf8,';

  if (uri === undefined || !uri.startsWith(prefix)) {
    return null;
  }

  try {
    return decodeURIComponent(uri.slice(prefix.length));
  } catch {
    return null;
  }
};

const languageFilterOptions = [
  {
    description: 'Show every supported host language.',
    label: 'All languages',
    value: 'all',
  },
  {
    description: 'Prioritise English-first conversations.',
    label: 'English',
    value: 'English',
  },
  {
    description: 'Prioritise Hindi-speaking hosts.',
    label: 'Hindi',
    value: 'Hindi',
  },
  {
    description: 'Prioritise Telugu-speaking hosts.',
    label: 'Telugu',
    value: 'Telugu',
  },
  {
    description: 'Prioritise Tamil-speaking hosts.',
    label: 'Tamil',
    value: 'Tamil',
  },
  {
    description: 'Prioritise Kannada-speaking hosts.',
    label: 'Kannada',
    value: 'Kannada',
  },
  {
    description: 'Prioritise Malayalam-speaking hosts.',
    label: 'Malayalam',
    value: 'Malayalam',
  },
] as const satisfies readonly {
  description: string;
  label: string;
  value: DiscoveryLanguageFilter;
}[];

const rankFilterOptions = [
  {
    description: 'Show every host rank.',
    label: 'All ranks',
    value: 'all',
  },
  {
    description: 'Highest ranked hosts first.',
    label: 'Diamond',
    value: 'diamond',
  },
  {
    description: 'Experienced premium hosts.',
    label: 'Platinum',
    value: 'platinum',
  },
  {
    description: 'Strongly rated regular hosts.',
    label: 'Gold',
    value: 'gold',
  },
  {
    description: 'Emerging highly active hosts.',
    label: 'Silver',
    value: 'silver',
  },
  {
    description: 'Include early-rank hosts.',
    label: 'Bronze',
    value: 'bronze',
  },
] as const satisfies readonly {
  description: string;
  label: string;
  value: DiscoveryRankFilter;
}[];

const discoveryPalette = {
  categoryBorder: 'rgba(201,54,116,0.54)',
  online: ui.color.status.success,
  trustBlue: ui.color.status.info,
} as const;

const formatVoicePreviewTime = (seconds: number) => {
  const roundedSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(roundedSeconds / 60))}:${String(
    roundedSeconds % 60,
  ).padStart(2, '0')}`;
};

function RankDiamondIcon({ size }: { size: number }) {
  return (
    <Svg height={size} viewBox="0 0 16 16" width={size}>
      <Defs>
        <SvgLinearGradient
          id="host-rank-diamond-fill"
          x1="2"
          x2="14"
          y1="3"
          y2="13"
        >
          <Stop offset="0" stopColor="#FFF4FB" />
          <Stop offset="0.42" stopColor="#FFC7DB" />
          <Stop offset="1" stopColor="#FF7895" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M3.1 5.3L6.1 2.4H9.9L12.9 5.3L8 13.4L3.1 5.3Z"
        fill="url(#host-rank-diamond-fill)"
        stroke="#F05B82"
        strokeLinejoin="round"
        strokeWidth="0.95"
      />
      <Path
        d="M3.1 5.3H12.9M6.1 2.4L8 5.3L9.9 2.4M6.1 5.3L8 13.4L9.9 5.3"
        opacity="0.72"
        stroke="#FFF8FC"
        strokeLinejoin="round"
        strokeWidth="0.75"
      />
    </Svg>
  );
}

function useDiscoveryPreferencesState() {
  const [state, setState] = useState<DiscoveryPreferencesState>({
    kind: 'loading',
  });

  const reload = useCallback(async () => {
    setState({ kind: 'loading' });
    await loadDiscoveryPreferences()
      .then((preferences) => {
        setState({
          data: preferences,
          kind: 'ready',
        });
      })
      .catch(() => {
        setState({
          data: {
            blockedHostIds: [],
            filters: defaultDiscoveryFilters,
          },
          kind: 'ready',
        });
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadDiscoveryPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setState({
            data: preferences,
            kind: 'ready',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            data: defaultDiscoveryPreferences,
            kind: 'ready',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (preferences: DiscoveryPreferences) => {
    const persisted = await persistDiscoveryPreferences(preferences);
    setState({
      data: persisted,
      kind: 'ready',
    });
    return persisted;
  }, []);

  return {
    reload,
    save,
    state,
  };
}

function DiscoveryHeader({
  balanceLabel,
  onOpenAddMoney,
}: {
  balanceLabel: string;
  onOpenAddMoney: () => void;
}) {
  const { readableContentWidth } = useResponsiveLayout();
  const compact = readableContentWidth <= 430;

  return (
    <View style={styles.homeHeader}>
      <Text
        numberOfLines={1}
        style={[styles.homeLogo, compact ? styles.homeLogoCompact : null]}
      >
        Connecto
      </Text>
      <View style={styles.homeHeaderActions}>
        <Pressable
          accessibilityLabel="Add money"
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={onOpenAddMoney}
          style={({ pressed }) => [
            styles.homeWalletPill,
            compact ? styles.homeWalletPillCompact : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text
            style={[
              styles.homeWalletText,
              compact ? styles.homeWalletTextCompact : null,
            ]}
          >
            {balanceLabel}
          </Text>
          <View style={styles.homeWalletPlus}>
            <CirclePlus
              color={discoveryPalette.trustBlue}
              size={compact ? 26 : 34}
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function RandomCallButton({ onPress }: { onPress: () => void }) {
  const { readableContentWidth } = useResponsiveLayout();
  const compact = readableContentWidth <= 430;
  const iconPulseStyle = usePulseStyle(true);

  return (
    <Pressable
      accessibilityLabel="Start Walkie-Talkie call"
      accessibilityRole="button"
      hitSlop={ui.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.randomCallButton,
        compact ? styles.randomCallButtonCompact : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.randomCallText,
          compact ? styles.randomCallTextCompact : null,
        ]}
      >
        Walkie-Talkie
      </Text>
      <Animated.View style={[styles.randomCallIconWrap, iconPulseStyle]}>
        <Mic2 color="#ffffff" size={compact ? 15 : 18} />
      </Animated.View>
    </Pressable>
  );
}

const expertCategories = [
  'All',
  'Star',
  'Relationship',
  'Marriage',
  'Confidence',
] as const;

function ExpertCategoryStrip() {
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.categoryStrip}
      showsHorizontalScrollIndicator={false}
    >
      {expertCategories.map((category, index) => {
        const selected = index === 0;

        return (
          <Pressable
            accessibilityLabel={`Filter ${category}`}
            accessibilityRole="button"
            key={category}
            style={[
              styles.categoryChip,
              selected ? styles.categoryChipSelected : null,
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                selected ? styles.categoryTextSelected : null,
              ]}
            >
              {category}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const DiscoveryHostCard = memo(function DiscoveryHostCard({
  animationsEnabled,
  host,
  loading,
  onToggleVoicePreview,
  onVoiceCall,
  voicePreviewActive,
  voicePreviewElapsedSeconds,
  voicePreviewPlaying,
}: {
  animationsEnabled: boolean;
  host: HostSummary;
  loading: boolean;
  onToggleVoicePreview: (host: HostSummary) => void;
  onVoiceCall: (host: HostSummary) => void;
  voicePreviewActive: boolean;
  voicePreviewElapsedSeconds: number;
  voicePreviewPlaying: boolean;
}) {
  const { readableContentWidth } = useResponsiveLayout();
  const compact = readableContentWidth <= 430;
  const online = host.availability === 'online';
  const statusPulseStyle = usePulseStyle(online && animationsEnabled);
  const callPulseStyle = usePulseStyle(online && animationsEnabled && !loading);
  const avatarSource = resolveCustomerAvatarSource(host.profileImageUri);
  const profileSvgMarkup =
    avatarSource === undefined ? decodeSvgDataUri(host.profileImageUri) : null;
  const usingDemoVoiceIntro = host.voiceIntro?.recordingUri === undefined;
  const voicePreviewDurationSeconds = usingDemoVoiceIntro
    ? 7
    : (host.voiceIntro?.durationSeconds ?? 14);
  const showVoicePreviewTime = voicePreviewActive && voicePreviewPlaying;

  return (
    <View>
      <Card
        style={[styles.hostCard, compact ? styles.hostCardCompact : null]}
        variant="standard"
      >
        <View
          style={[
            styles.profileMediaColumn,
            compact ? styles.profileMediaColumnCompact : null,
          ]}
        >
          <View
            style={[
              styles.profileAvatarWrap,
              compact ? styles.profileAvatarWrapCompact : null,
            ]}
          >
            <View
              style={[
                styles.profilePhotoFrame,
                compact ? styles.profilePhotoFrameCompact : null,
              ]}
            >
              {avatarSource !== undefined ? (
                <Image
                  accessibilityIgnoresInvertColors
                  source={avatarSource}
                  style={styles.profilePhoto}
                />
              ) : host.profileImageUri === undefined ? (
                <Text style={styles.profileInitial}>
                  {host.displayName.slice(0, 1).toUpperCase()}
                </Text>
              ) : profileSvgMarkup !== null ? (
                <SvgXml height="100%" width="100%" xml={profileSvgMarkup} />
              ) : (
                <Image
                  accessibilityIgnoresInvertColors
                  source={{ uri: host.profileImageUri }}
                  style={styles.profilePhoto}
                />
              )}
            </View>
            {online ? (
              <Animated.View
                style={[
                  styles.profileStatusPulse,
                  compact ? styles.profileStatusPulseCompact : null,
                  statusPulseStyle,
                ]}
              />
            ) : null}
            <View
              style={[
                styles.profileStatusDot,
                compact ? styles.profileStatusDotCompact : null,
                online ? styles.profileStatusOnline : styles.profileStatusBusy,
              ]}
            />
          </View>
          <Pressable
            accessibilityHint={
              usingDemoVoiceIntro
                ? 'Plays the bundled demonstration host introduction.'
                : 'Plays the host voice recording submitted for verification.'
            }
            accessibilityLabel={`${
              voicePreviewPlaying ? 'Pause' : 'Play'
            } ${host.displayName}'s voice intro`}
            accessibilityRole="button"
            accessibilityState={{ selected: voicePreviewPlaying }}
            hitSlop={ui.hitSlop}
            onPress={() => {
              onToggleVoicePreview(host);
            }}
            style={({ pressed }) => [
              styles.profileVoicePreviewTrigger,
              compact ? styles.profileVoicePreviewTriggerCompact : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View
              style={[
                styles.profileVoicePreviewButton,
                voicePreviewPlaying
                  ? styles.profileVoicePreviewButtonPlaying
                  : null,
              ]}
            >
              {voicePreviewPlaying ? (
                <Pause
                  color={ui.color.text.inverse}
                  fill={ui.color.text.inverse}
                  size={14}
                />
              ) : (
                <Play
                  color={ui.color.text.inverse}
                  fill={ui.color.text.inverse}
                  size={14}
                />
              )}
            </View>
          </Pressable>
          <View
            style={[
              styles.profileVoicePlaybackWrap,
              compact ? styles.profileVoicePlaybackWrapCompact : null,
            ]}
          >
            {showVoicePreviewTime ? (
              <Text
                accessibilityLabel={`Voice preview ${formatVoicePreviewTime(
                  voicePreviewElapsedSeconds,
                )} of ${formatVoicePreviewTime(voicePreviewDurationSeconds)}`}
                numberOfLines={1}
                style={[
                  styles.profileVoicePlayback,
                  compact ? styles.profileVoicePlaybackCompact : null,
                ]}
              >
                {formatVoicePreviewTime(voicePreviewElapsedSeconds)} /{' '}
                {formatVoicePreviewTime(voicePreviewDurationSeconds)}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.profileInfoColumn,
            compact ? styles.profileInfoColumnCompact : null,
          ]}
        >
          <View
            style={[
              styles.profileHeaderRow,
              compact ? styles.profileHeaderRowCompact : null,
            ]}
          >
            <View style={styles.profileNameRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.profileName,
                  compact ? styles.profileNameCompact : null,
                ]}
              >
                {host.displayName}
              </Text>
              <Text
                style={[
                  styles.profileSeparator,
                  compact ? styles.profileSeparatorCompact : null,
                ]}
              >
                {'\u2022'}
              </Text>
              <Text
                style={[
                  styles.profileAge,
                  compact ? styles.profileAgeCompact : null,
                ]}
              >
                {String(host.age)} Y
              </Text>
            </View>
          </View>
          {host.location !== undefined ? (
            <View style={styles.profileLocationRow}>
              <MapPin
                color={discoveryPalette.trustBlue}
                size={compact ? 13 : 14}
                strokeWidth={2.15}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.profileLocation,
                  compact ? styles.profileLocationCompact : null,
                ]}
              >
                {host.location}
              </Text>
            </View>
          ) : null}
          {host.isNewHost ? (
            <Text
              numberOfLines={1}
              style={[
                styles.profileCategory,
                compact ? styles.profileCategoryCompact : null,
              ]}
            >
              New host
            </Text>
          ) : (
            <View
              style={[
                styles.profileRankBadge,
                compact ? styles.profileRankBadgeCompact : null,
              ]}
            >
              <RankDiamondIcon size={compact ? 14 : 15} />
              <Text
                numberOfLines={1}
                style={[
                  styles.profileRankBadgeText,
                  compact ? styles.profileRankBadgeTextCompact : null,
                ]}
              >
                {host.rank}
              </Text>
            </View>
          )}
          <Text
            numberOfLines={1}
            style={[
              styles.profileRate,
              compact ? styles.profileRateCompact : null,
            ]}
          >
            {formatMoney(host.voiceRate)}/min
          </Text>
        </View>

        <View
          style={[
            styles.profileRightColumn,
            compact ? styles.profileRightColumnCompact : null,
          ]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.profileLanguage,
              compact ? styles.profileLanguageCompact : null,
            ]}
          >
            {host.language}
          </Text>
          <Pressable
            accessibilityLabel={`Start voice call with ${host.displayName}`}
            accessibilityRole="button"
            accessibilityState={{ busy: loading }}
            disabled={loading}
            hitSlop={ui.hitSlop}
            onPress={() => {
              onVoiceCall(host);
            }}
            style={({ pressed }) => [
              styles.profileCallButton,
              compact ? styles.profileCallButtonCompact : null,
              pressed ? styles.pressed : null,
              loading ? styles.hostCallPillDisabled : null,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Animated.View
                  style={[
                    styles.profileCallPulse,
                    compact ? styles.profileCallPulseCompact : null,
                    callPulseStyle,
                  ]}
                />
                <LottieIllustration
                  assetId="callNowPulse"
                  fallback={
                    <View
                      style={[
                        styles.profileCallFallback,
                        compact ? styles.profileCallFallbackCompact : null,
                      ]}
                    >
                      <PhoneCall color="#ffffff" size={compact ? 22 : 26} />
                    </View>
                  }
                  fallbackLabel="Call animation"
                  playing={online && animationsEnabled}
                  style={[
                    styles.profileCallAnimation,
                    compact ? styles.profileCallAnimationCompact : null,
                    online ? null : styles.profileCallAnimationBusy,
                  ]}
                  testID={`call-now-animation-${host.id}`}
                />
              </>
            )}
          </Pressable>
        </View>
      </Card>
    </View>
  );
});

function DiscoverySkeletonList() {
  return (
    <View style={styles.listStack}>
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} style={styles.skeletonCard}>
          <Skeleton lines={5} />
        </Card>
      ))}
    </View>
  );
}

function DiscoveryFilterEditor({
  appliedFilters,
  draftFilters,
  hostCountLabel,
  onApply,
  onChange,
  onReset,
}: {
  appliedFilters: DiscoveryFilters;
  draftFilters: DiscoveryFilters;
  hostCountLabel: string;
  onApply: () => void;
  onChange: (filters: DiscoveryFilters) => void;
  onReset: () => void;
}) {
  const dirty = JSON.stringify(appliedFilters) !== JSON.stringify(draftFilters);

  return (
    <View style={styles.filterContent}>
      <View style={styles.filterHeading}>
        <Text accessibilityRole="header" style={styles.filterTitle}>
          Filters
        </Text>
        <Text style={styles.headerHelper}>{hostCountLabel}</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterSectionTitle}>Language</Text>
        <View style={styles.optionStack}>
          {languageFilterOptions.map((option) => (
            <RadioCard
              description={option.description}
              key={option.value}
              label={option.label}
              onPress={() => {
                onChange({
                  ...draftFilters,
                  language: option.value,
                });
              }}
              selected={draftFilters.language === option.value}
              testID={`discovery-filter-language-${option.value}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterSectionTitle}>Availability and quality</Text>
        <View style={styles.optionStack}>
          <SwitchRow
            label="Online only"
            onValueChange={(value) => {
              onChange({
                ...draftFilters,
                onlineOnly: value,
              });
            }}
            testID="discovery-filter-online-only"
            value={draftFilters.onlineOnly}
          />
          <SwitchRow
            label="Top rated"
            onValueChange={(value) => {
              onChange({
                ...draftFilters,
                topRated: value,
              });
            }}
            testID="discovery-filter-top-rated"
            value={draftFilters.topRated}
          />
          <SwitchRow
            label="New hosts"
            onValueChange={(value) => {
              onChange({
                ...draftFilters,
                newHostsOnly: value,
              });
            }}
            testID="discovery-filter-new-hosts"
            value={draftFilters.newHostsOnly}
          />
        </View>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterSectionTitle}>Rank</Text>
        <View style={styles.optionStack}>
          {rankFilterOptions.map((option) => (
            <RadioCard
              description={option.description}
              key={option.value}
              label={option.label}
              onPress={() => {
                onChange({
                  ...draftFilters,
                  rank: option.value,
                });
              }}
              selected={draftFilters.rank === option.value}
              testID={`discovery-filter-rank-${option.value}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.filterActions}>
        <Button
          compact
          disabled={!dirty}
          onPress={onReset}
          title="Reset"
          variant="secondary"
        />
        <Button compact onPress={onApply} title="Apply filters" />
      </View>
    </View>
  );
}

function useDiscoveryViewModel() {
  const hostsQuery = useHostsQuery();
  const walletQuery = useWalletQuery();
  const profileQuery = useCustomerProfileQuery();
  const { save, state, reload } = useDiscoveryPreferencesState();
  const [draftFiltersOverride, setDraftFiltersOverride] =
    useState<DiscoveryFilters | null>(null);
  const [banner, setBanner] = useState<DiscoveryBanner>(null);
  const [callingHostId, setCallingHostId] = useState<string | null>(null);
  const [, setSavingPreferences] = useState(false);
  const router = useRouter();
  const randomCallCursorRef = useRef(0);

  const preferences = useMemo<DiscoveryPreferences>(
    () => (state.kind === 'ready' ? state.data : defaultDiscoveryPreferences),
    [state],
  );
  const draftFilters = draftFiltersOverride ?? preferences.filters;
  const setDraftFilters = useCallback((filters: DiscoveryFilters) => {
    setDraftFiltersOverride(filters);
  }, []);
  const allHosts = useMemo(() => hostsQuery.data ?? [], [hostsQuery.data]);
  const preferredLanguages = useMemo(
    () => profileQuery.data?.preferredLanguages ?? [],
    [profileQuery.data?.preferredLanguages],
  );
  const filteredHosts = useMemo(
    () =>
      applyDiscoveryFilters(
        allHosts,
        preferences.filters,
        preferences.blockedHostIds,
      ),
    [allHosts, preferences.blockedHostIds, preferences.filters],
  );
  const sortedHosts = useMemo(
    () => sortDiscoveryHosts(filteredHosts, preferredLanguages),
    [filteredHosts, preferredLanguages],
  );
  const visibleHosts = sortedHosts;
  const randomCallHosts = useMemo(
    () =>
      visibleHosts.filter(
        (host) =>
          host.availability === 'online' &&
          !preferences.blockedHostIds.includes(host.id),
      ),
    [preferences.blockedHostIds, visibleHosts],
  );

  const previewCount = useMemo(
    () =>
      applyDiscoveryFilters(allHosts, draftFilters, preferences.blockedHostIds)
        .length,
    [allHosts, draftFilters, preferences.blockedHostIds],
  );

  const fallbackLanguage =
    preferredLanguages.length > 0 &&
    filteredHosts.length > 0 &&
    !hasPreferredLanguageOnlineHosts(filteredHosts, preferredLanguages);

  const refreshAll = useCallback(async () => {
    setBanner(null);
    await Promise.all([
      hostsQuery.refetch(),
      walletQuery.refetch(),
      profileQuery.refetch(),
      reload(),
    ]);
  }, [hostsQuery, profileQuery, reload, walletQuery]);

  const savePreferences = useCallback(
    async (nextPreferences: DiscoveryPreferences) => {
      setSavingPreferences(true);

      try {
        await save(nextPreferences);
      } finally {
        setSavingPreferences(false);
      }
    },
    [save],
  );

  const openAddMoney = useCallback(() => {
    router.push({
      params: { returnTo: appRoutes.customerHome.path },
      pathname: appRoutes.customerAddMoney.path,
    });
  }, [router]);

  const startVoiceCall = useCallback(
    (host: HostSummary) => {
      setCallingHostId(host.id);
      setBanner(null);

      try {
        router.push({
          params: outgoingCallRouteParamsForHost(host),
          pathname: appRoutes.callOutgoing.path,
        });
      } catch (error: unknown) {
        setBanner({
          message: normalizeApiError(error).message,
          title: 'Call preflight failed',
          tone: 'error',
        });
      } finally {
        setCallingHostId(null);
      }
    },
    [router],
  );

  const startRandomVoiceCall = useCallback(() => {
    setBanner(null);

    if (randomCallHosts.length === 0) {
      setBanner({
        message:
          'No online hosts are available for random calling right now. Try again after a refresh.',
        title: 'No online hosts',
        tone: 'info',
      });
      return;
    }

    const startIndex = randomCallCursorRef.current % randomCallHosts.length;
    randomCallCursorRef.current = (startIndex + 1) % randomCallHosts.length;

    const candidateHosts = [
      ...randomCallHosts.slice(startIndex),
      ...randomCallHosts.slice(0, startIndex),
    ].slice(0, 8);
    const [selectedHost] = candidateHosts;

    if (selectedHost !== undefined) {
      setCallingHostId(selectedHost.id);
    }

    try {
      router.push({
        params: outgoingCallRouteParamsForRandomHosts(candidateHosts),
        pathname: appRoutes.callOutgoing.path,
      });
    } catch (error: unknown) {
      setBanner({
        message: normalizeApiError(error).message,
        title: 'Random call failed',
        tone: 'error',
      });
    } finally {
      setCallingHostId(null);
    }
  }, [randomCallHosts, router]);

  return {
    banner,
    blockedHostIds: preferences.blockedHostIds,
    callingHostId,
    draftFilters,
    fallbackLanguage,
    filteredHosts,
    hostsQuery,
    openAddMoney,
    preferredLanguages,
    preferences,
    preferencesState: state,
    previewCount,
    profileQuery,
    refreshAll,
    savePreferences,
    setBanner,
    setDraftFilters,
    sortedHosts,
    startRandomVoiceCall,
    startVoiceCall,
    visibleHosts,
    walletQuery,
  };
}

function DiscoveryScreenBody({
  viewModel,
}: {
  viewModel: ReturnType<typeof useDiscoveryViewModel>;
}) {
  const insets = useSafeAreaInsets();
  const [listInteracting, setListInteracting] = useState(false);
  const [voicePreviewHostId, setVoicePreviewHostId] = useState<string | null>(
    null,
  );
  const voicePreviewPlayer = useAudioPlayer(undefined, {
    updateInterval: 200,
  });
  const voicePreviewStatus = useAudioPlayerStatus(voicePreviewPlayer);
  const tabContentInset = getFloatingTabBarContentInset(insets.bottom);
  const loading =
    viewModel.preferencesState.kind === 'loading' ||
    viewModel.hostsQuery.isPending ||
    viewModel.walletQuery.isPending ||
    viewModel.profileQuery.isPending;

  const blockingError =
    viewModel.hostsQuery.isError ||
    viewModel.walletQuery.isError ||
    viewModel.profileQuery.isError;

  const error = blockingError
    ? normalizeApiError(
        viewModel.hostsQuery.error ??
          viewModel.walletQuery.error ??
          viewModel.profileQuery.error,
      )
    : null;

  const activeVoicePreviewHostId = voicePreviewHostId;

  const toggleVoicePreview = useCallback(
    (host: HostSummary) => {
      const recordingUri = host.voiceIntro?.recordingUri ?? demoHostVoiceIntro;

      if (voicePreviewHostId === host.id) {
        if (voicePreviewStatus.playing) {
          voicePreviewPlayer.pause();
        } else if (voicePreviewStatus.didJustFinish) {
          void voicePreviewPlayer
            .seekTo(0)
            .then(() => {
              voicePreviewPlayer.play();
            })
            .catch(() => undefined);
        } else {
          voicePreviewPlayer.play();
        }
        return;
      }

      voicePreviewPlayer.replace(recordingUri);
      voicePreviewPlayer.play();
      setVoicePreviewHostId(host.id);
    },
    [
      voicePreviewHostId,
      voicePreviewPlayer,
      voicePreviewStatus.didJustFinish,
      voicePreviewStatus.playing,
    ],
  );

  if (loading) {
    return (
      <Screen
        contentStyle={styles.discoveryScreen}
        edges={['top', 'right', 'left']}
        style={styles.homeScreenRoot}
        testID="discovery-home-screen"
      >
        <View style={styles.screenStack}>
          <Card>
            <Skeleton lines={4} />
          </Card>
          <Card>
            <Skeleton lines={2} />
          </Card>
          <DiscoverySkeletonList />
        </View>
      </Screen>
    );
  }

  if (error !== null) {
    return (
      <Screen
        contentStyle={styles.discoveryScreen}
        edges={['top', 'right', 'left']}
        style={styles.homeScreenRoot}
        testID="discovery-home-screen"
      >
        <View style={styles.screenStack}>
          <ErrorState
            message={error.message}
            onRetry={() => {
              void viewModel.refreshAll();
            }}
            title={
              error.code === 'offline' ? 'Offline' : 'Could not load hosts'
            }
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      contentStyle={styles.discoveryScreen}
      edges={['top', 'right', 'left']}
      style={styles.homeScreenRoot}
      testID="discovery-home-screen"
    >
      <View style={styles.homeFixedHeader}>
        <DiscoveryHeader
          balanceLabel={
            viewModel.walletQuery.data === undefined
              ? '-'
              : formatMoney(viewModel.walletQuery.data.balance)
          }
          onOpenAddMoney={viewModel.openAddMoney}
        />
      </View>
      <FlashList
        contentContainerStyle={{
          paddingBottom: tabContentInset,
          paddingTop: 8,
        }}
        data={viewModel.visibleHosts}
        drawDistance={420}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState
            actionLabel="Reset filters"
            message="Try broadening your filters or unblocking hosts from this device."
            onAction={() => {
              void viewModel.savePreferences({
                blockedHostIds: viewModel.blockedHostIds,
                filters: defaultDiscoveryFilters,
              });
            }}
            title="No hosts available"
          />
        }
        ListFooterComponent={<View style={styles.listFooter} />}
        ListHeaderComponent={
          <View style={styles.screenStack}>
            {viewModel.banner === null ? null : (
              <Banner
                message={viewModel.banner.message}
                title={viewModel.banner.title}
                tone={viewModel.banner.tone}
              />
            )}
            {viewModel.fallbackLanguage ? (
              <Banner
                message={`No online hosts currently match ${viewModel.preferredLanguages.join(', ')}. Other online hosts are shown first so voice calling stays available.`}
                title="Fallback language results"
                tone="info"
              />
            ) : null}
            <View style={styles.featuredHeader}>
              <View style={styles.featuredTitleRow}>
                <Text style={styles.featuredTitle}>Featured Experts</Text>
                <RandomCallButton onPress={viewModel.startRandomVoiceCall} />
              </View>
              <ExpertCategoryStrip />
            </View>
          </View>
        }
        maintainVisibleContentPosition={{ disabled: true }}
        onMomentumScrollBegin={() => {
          setListInteracting(true);
        }}
        onMomentumScrollEnd={() => {
          setListInteracting(false);
        }}
        onRefresh={() => {
          void viewModel.refreshAll();
        }}
        onScrollBeginDrag={() => {
          setListInteracting(true);
        }}
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.1) {
            setListInteracting(false);
          }
        }}
        overScrollMode="never"
        refreshing={viewModel.hostsQuery.isRefetching}
        renderItem={({ item }) => (
          <View style={styles.listItemWrap}>
            <DiscoveryHostCard
              animationsEnabled={!listInteracting}
              host={item}
              loading={viewModel.callingHostId === item.id}
              onToggleVoicePreview={toggleVoicePreview}
              onVoiceCall={viewModel.startVoiceCall}
              voicePreviewActive={activeVoicePreviewHostId === item.id}
              voicePreviewElapsedSeconds={
                activeVoicePreviewHostId === item.id
                  ? voicePreviewStatus.currentTime
                  : 0
              }
              voicePreviewPlaying={
                activeVoicePreviewHostId === item.id &&
                voicePreviewStatus.playing
              }
            />
          </View>
        )}
        style={styles.homeList}
      />
    </Screen>
  );
}

export function DiscoveryHomeScreen() {
  const viewModel = useDiscoveryViewModel();

  useEffect(() => {
    const timer = setTimeout(() => {
      void Promise.all([
        import('@/features/customer/CustomerAccountScreens'),
        import('@/features/finance/FinanceScreens'),
      ]).catch(() => undefined);
    }, 900);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return <DiscoveryScreenBody viewModel={viewModel} />;
}

export function DiscoveryFiltersScreen() {
  const router = useRouter();
  const viewModel = useDiscoveryViewModel();

  if (
    viewModel.preferencesState.kind === 'loading' ||
    viewModel.hostsQuery.isPending
  ) {
    return (
      <ScrollScreen testID="discovery-filters-screen">
        <BackHeader
          onPress={() => {
            router.replace(appRoutes.customerHome.path);
          }}
          title="Filters"
        />
        <Card>
          <Skeleton lines={10} />
        </Card>
      </ScrollScreen>
    );
  }

  if (viewModel.hostsQuery.isError) {
    const error = normalizeApiError(viewModel.hostsQuery.error);

    return (
      <Screen testID="discovery-filters-screen">
        <View style={styles.screenStack}>
          <BackHeader
            onPress={() => {
              router.replace(appRoutes.customerHome.path);
            }}
            title="Filters"
          />
          <ErrorState
            message={error.message}
            onRetry={() => {
              void viewModel.refreshAll();
            }}
            title={
              error.code === 'offline' ? 'Offline' : 'Could not load filters'
            }
          />
        </View>
      </Screen>
    );
  }

  return (
    <ScrollScreen testID="discovery-filters-screen">
      <BackHeader
        onPress={() => {
          router.replace(appRoutes.customerHome.path);
        }}
        title="Filters"
      />
      {viewModel.banner === null ? null : (
        <Banner
          message={viewModel.banner.message}
          title={viewModel.banner.title}
          tone={viewModel.banner.tone}
        />
      )}
      <DiscoveryFilterEditor
        appliedFilters={viewModel.preferences.filters}
        draftFilters={viewModel.draftFilters}
        hostCountLabel={formatFilterCountLabel(viewModel.previewCount)}
        onApply={() => {
          void viewModel
            .savePreferences({
              blockedHostIds: viewModel.blockedHostIds,
              filters: viewModel.draftFilters,
            })
            .then(() => {
              router.replace(appRoutes.customerHome.path);
            });
        }}
        onChange={viewModel.setDraftFilters}
        onReset={() => {
          viewModel.setDraftFilters(defaultDiscoveryFilters);
        }}
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  brandCopy: {
    gap: ui.spacing[1],
    minWidth: 0,
  },
  brandIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brandRow: {
    alignItems: 'center',
    flexShrink: 1,
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  brandTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  discoveryScreen: {
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderColor: discoveryPalette.categoryBorder,
    borderRadius: 22,
    borderWidth: 1.2,
    justifyContent: 'center',
    minHeight: 31,
    paddingHorizontal: 13,
  },
  categoryChipSelected: {
    ...ui.shadow.button,
    backgroundColor: ui.color.brand.primary,
    borderColor: ui.glass.borderStrong,
  },
  categoryStrip: {
    gap: 10,
    paddingRight: ui.spacing[4],
  },
  categoryText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  categoryTextSelected: {
    color: ui.color.text.inverse,
  },
  featuredHeader: {
    gap: 10,
    paddingBottom: 14,
  },
  featuredTitle: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: 18,
    lineHeight: 23,
  },
  featuredTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  filterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  filterContent: {
    gap: ui.spacing[5],
  },
  filterHeading: {
    gap: ui.spacing[1],
  },
  filterSection: {
    gap: ui.spacing[3],
  },
  filterSectionTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  filterTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  headerCard: {
    gap: ui.spacing[4],
  },
  headerHelper: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  headerTopRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  homeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 64,
  },
  homeFixedHeader: {
    flexShrink: 0,
    position: 'relative',
    zIndex: 20,
  },
  homeHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 10,
  },
  homeLogo: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: 'cursive',
    fontSize: 29,
    lineHeight: 36,
  },
  homeLogoCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  homeList: {
    flex: 1,
  },
  homeScreenRoot: {
    backgroundColor: 'transparent',
  },
  homeWalletPill: {
    alignItems: 'center',
    ...ui.shadow.button,
    backgroundColor: 'rgba(62,111,217,0.58)',
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: 26,
    flexDirection: 'row',
    gap: 7,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 6,
  },
  homeWalletPillCompact: {
    minHeight: 48,
    paddingLeft: 13,
  },
  homeWalletPlus: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  homeWalletText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  homeWalletTextCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  hostCard: {
    alignItems: 'flex-start',
    ...ui.shadow.card,
    borderRadius: 28,
    flexDirection: 'row',
    gap: 16,
    minHeight: 134,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hostCardCompact: {
    borderRadius: 26,
    gap: 13,
    minHeight: 132,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hostCallPillDisabled: {
    opacity: ui.opacity.disabled,
  },
  profileActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  profileActionRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 6,
    marginTop: 2,
  },
  profileAge: {
    color: ui.color.text.tertiary,
    flexShrink: 0,
    fontFamily: ui.font.regular,
    fontSize: 15,
    lineHeight: 19,
  },
  profileAgeCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  profileCallButton: {
    alignItems: 'center',
    ...ui.shadow.button,
    backgroundColor: 'rgba(62,111,217,0.14)',
    borderColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderRadius: 28,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 56,
    minWidth: 56,
    overflow: 'visible',
  },
  profileCallButtonCompact: {
    borderRadius: 26,
    marginTop: 18,
    minHeight: 52,
    minWidth: 52,
  },
  profileCallAnimation: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    height: 56,
    minHeight: 56,
    minWidth: 56,
    padding: 0,
    width: 56,
    zIndex: 1,
  },
  profileCallAnimationBusy: {
    opacity: 0.76,
  },
  profileCallAnimationCompact: {
    borderRadius: 26,
    height: 52,
    minHeight: 52,
    minWidth: 52,
    width: 52,
  },
  profileCallFallback: {
    alignItems: 'center',
    backgroundColor: ui.color.status.info,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  profileCallFallbackCompact: {
    borderRadius: 26,
    height: 52,
    width: 52,
  },
  profileCallPulse: {
    backgroundColor: 'rgba(62,111,217,0.2)',
    borderColor: 'rgba(62,111,217,0.32)',
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    position: 'absolute',
    width: 56,
  },
  profileCallPulseCompact: {
    borderRadius: 26,
    height: 52,
    width: 52,
  },
  profileCategory: {
    color: ui.color.accent.coral,
    fontFamily: ui.font.regular,
    fontSize: 15,
    lineHeight: 19,
    textTransform: 'capitalize',
  },
  profileCategoryCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  profileRankBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,114,119,0.12)',
    borderColor: 'rgba(255,114,119,0.24)',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  profileRankBadgeCompact: {
    borderRadius: 9,
    minHeight: 21,
    paddingHorizontal: 6,
  },
  profileRankBadgeText: {
    color: ui.color.accent.coral,
    fontFamily: ui.font.bold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'capitalize',
  },
  profileRankBadgeTextCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  profileHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  profileHeaderRowCompact: {
    flexDirection: 'column',
    gap: 0,
  },
  profileInfoColumn: {
    alignSelf: 'stretch',
    flex: 1,
    gap: 5,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  profileInfoColumnCompact: {
    gap: 4,
    paddingTop: 1,
  },
  profileInitial: {
    color: discoveryPalette.trustBlue,
    fontFamily: ui.font.bold,
    fontSize: 40,
    lineHeight: 48,
  },
  profileInitialCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  profileLanguage: {
    color: ui.color.text.secondary,
    flexShrink: 0,
    fontFamily: ui.font.regular,
    fontSize: 15,
    lineHeight: 19,
    textAlign: 'right',
  },
  profileLanguageCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  profileLocation: {
    color: ui.color.text.secondary,
    flexShrink: 1,
    fontFamily: ui.font.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  profileLocationCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  profileLocationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  profileMediaColumn: {
    alignItems: 'center',
    width: 70,
  },
  profileMediaColumnCompact: {
    width: 62,
  },
  profileName: {
    color: ui.color.text.primary,
    flexShrink: 1,
    fontFamily: ui.font.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  profileNameCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  profileNameRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  profileAvatarWrap: {
    height: 70,
    width: 70,
  },
  profilePhoto: {
    height: '100%',
    width: '100%',
  },
  profilePhotoFrame: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  profilePhotoFrameCompact: {
    borderRadius: 29,
    height: 58,
    width: 58,
  },
  profileAvatarWrapCompact: {
    height: 64,
    width: 64,
  },
  profileRate: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 21,
    lineHeight: 26,
    marginTop: 1,
  },
  profileRateCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  profileSeparator: {
    color: ui.color.text.tertiary,
    flexShrink: 0,
    fontFamily: ui.font.bold,
    fontSize: 15,
    lineHeight: 19,
  },
  profileSeparatorCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  profileStatusBusy: {
    backgroundColor: ui.color.text.tertiary,
  },
  profileStatusDot: {
    borderColor: ui.glass.borderStrong,
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    position: 'absolute',
    right: 3,
    top: 0,
    width: 20,
  },
  profileStatusDotCompact: {
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    right: 4,
    top: 0,
    width: 18,
  },
  profileStatusOnline: {
    backgroundColor: discoveryPalette.online,
  },
  profileStatusPulse: {
    borderColor: discoveryPalette.online,
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    opacity: 0.38,
    position: 'absolute',
    right: -1,
    top: -4,
    width: 28,
  },
  profileStatusPulseCompact: {
    borderRadius: 13,
    height: 26,
    right: 0,
    top: -4,
    width: 26,
  },
  profileVoicePreviewButton: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primary,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  profileVoicePreviewButtonPlaying: {
    backgroundColor: ui.color.status.info,
  },
  profileVoicePreviewTrigger: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 28,
    minWidth: 28,
  },
  profileVoicePreviewTriggerCompact: {
    marginTop: 7,
  },
  profileVoicePlayback: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  profileVoicePlaybackCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  profileVoicePlaybackWrap: {
    alignItems: 'center',
    marginTop: 3,
    minHeight: 14,
  },
  profileVoicePlaybackWrapCompact: {
    minHeight: 13,
  },
  profileRightColumn: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'flex-start',
    paddingTop: 2,
    width: 92,
  },
  profileRightColumnCompact: {
    paddingTop: 3,
    width: 84,
  },
  randomCallButton: {
    alignItems: 'center',
    alignSelf: 'center',
    ...ui.shadow.button,
    backgroundColor: 'rgba(201,54,116,0.62)',
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 13,
  },
  randomCallButtonCompact: {
    minHeight: 38,
    paddingHorizontal: 11,
  },
  randomCallIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  randomCallText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  randomCallTextCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  listItemWrap: {
    paddingBottom: 14,
  },
  listStack: {
    gap: ui.spacing[3],
  },
  optionStack: {
    gap: ui.spacing[3],
  },
  priceChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: ui.spacing[2],
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[2],
  },
  priceChipText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  priceStrip: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
    justifyContent: 'space-between',
  },
  priceStripCompact: {
    alignItems: 'stretch',
  },
  priceStripMain: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
    minWidth: 220,
  },
  priceStripMainCompact: {
    minWidth: 0,
  },
  pressed: {
    opacity: ui.opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  screenStack: {
    gap: 12,
    paddingTop: 0,
  },
  skeletonCard: {
    minHeight: 180,
  },
  walletBalance: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  walletAction: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.border,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: ui.spacing[2],
    minHeight: ui.minTouch,
    paddingHorizontal: ui.spacing[3],
  },
  walletActionCompact: {
    justifyContent: 'center',
  },
  walletActionIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  walletCopy: {
    gap: ui.spacing[1],
  },
});
