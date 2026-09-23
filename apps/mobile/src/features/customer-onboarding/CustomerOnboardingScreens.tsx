import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Mic,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';

import { normalizeApiError, queryKeys, type Language } from '@connecto/domain';

import { KeyboardScreen } from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Banner, InlineError } from '@/components/ui/feedback';
import {
  Checkbox,
  RadioCard,
  SearchField,
  TextField,
} from '@/components/ui/fields';
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
  completeCustomerOnboardingNavigation,
  completeHostApplicationNavigation,
  resolveDefaultRoute,
} from '@/navigation/navigation-store';
import { appRoutes } from '@/navigation/routes';
import { useHaptics, useReducedMotionEnabled } from '@/motion/MotionProvider';
import { frontendServices } from '@/services/adapters';
import {
  getAuthSnapshot,
  updateCustomerOnboardingDraft,
  useAuthStore,
  type CustomerGender,
  type CustomerMatchTag,
  type CustomerOnboardingImageDraft,
  type CustomerOnboardingStep,
  type CustomerPermissionStatus,
} from '@/store/auth.store';

import { persistAuthSnapshot } from '../auth/auth.storage';
import { mobileDataIds } from '../data/mobileDataHooks';

import { customerOnboardingAdapter } from './customer-onboarding.adapters';
import {
  buildCustomerPreferredLanguages,
  buildHostVoiceVerificationSentence,
  customerGenderOptions,
  customerOnboardingMatchTagOptions,
  customerOnboardingStepsForDraft,
  dateOfBirthInputToIsoDate,
  filterCustomerOnboardingLanguages,
  formatDateOfBirthInput,
  isHostApplicantDraft,
  resolveCustomerOnboardingStep,
  validateCustomerOnboardingProfileDraft,
  type CustomerOnboardingDevicePermissionResult,
  type CustomerOnboardingLocationPermissionResult,
  type CustomerOnboardingNotificationPermissionResult,
  type LanguageOption,
  type MatchTagOption,
  type OnboardingPermissionKind,
  type OnboardingPermissionRequirement,
} from './customer-onboarding.models';

type AsyncLoadState<T> =
  | { kind: 'empty' }
  | { kind: 'error'; message: string; offline: boolean }
  | { kind: 'loading' }
  | { data: T; kind: 'success' };

type OnboardingDevicePermissionKind = Extract<
  OnboardingPermissionKind,
  'camera' | 'location' | 'microphone'
>;

const maxMatchTags = 4;

const estimateMatchTagTextWidth = (label: string) =>
  Math.ceil(label.length * ui.type.label.fontSize * 0.58);

const devicePermissionTitle = {
  camera: 'Camera',
  location: 'Location',
  microphone: 'Microphone',
} as const satisfies Record<OnboardingDevicePermissionKind, string>;

type ProfileErrors = {
  dateOfBirthInput: string | null;
  displayName: string | null;
  gender: string | null;
};

const stepTitles = {
  hostAgreement: 'Host agreement',
  hostApproval: 'Waiting for approval',
  language: 'Set your languages',
  matchTags: 'Choose match tags',
  permissions: 'Review permissions',
  profile: 'Complete your profile',
  voiceVerification: 'Voice verification',
} as const satisfies Record<CustomerOnboardingStep, string>;

const stepMetaForDraft = (
  step: CustomerOnboardingStep,
  draft: ReturnType<typeof useAuthStore.getState>['customerOnboarding'],
) => {
  const steps: readonly CustomerOnboardingStep[] =
    customerOnboardingStepsForDraft(draft);
  const index = Math.max(0, steps.indexOf(step));
  const total = steps.length;
  const current = index + 1;

  return {
    current,
    eyebrow: `Step ${String(current)} of ${String(total)}`,
    progress: current / total,
    title: stepTitles[step],
    total,
  };
};

const stepRoutePath = {
  hostAgreement: appRoutes.customerOnboardingHostAgreement.path,
  hostApproval: appRoutes.customerOnboardingHostApproval.path,
  language: appRoutes.customerOnboardingLanguage.path,
  matchTags: appRoutes.customerOnboardingMatchTags.path,
  permissions: appRoutes.customerOnboardingPermissions.path,
  profile: appRoutes.customerOnboardingProfile.path,
  voiceVerification: appRoutes.customerOnboardingVoiceVerification.path,
} as const satisfies Record<CustomerOnboardingStep, string>;

const permissionTone = {
  granted: 'success',
  'not-now': 'warning',
  unknown: 'info',
} as const;

const permissionLabel = {
  granted: 'Allowed',
  'not-now': 'Later',
  unknown: 'Not decided',
} as const;

const saveAuthSnapshot = () => persistAuthSnapshot(getAuthSnapshot());

const persistDraftPatch = async (
  patch: Parameters<typeof updateCustomerOnboardingDraft>[0],
) => {
  updateCustomerOnboardingDraft(patch);
  await saveAuthSnapshot();
};

const useEntranceAnimation = () => {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const [header] = useState(
    () => new Animated.Value(reducedMotionEnabled ? 1 : 0),
  );
  const [card] = useState(
    () => new Animated.Value(reducedMotionEnabled ? 1 : 0),
  );

  useEffect(() => {
    if (reducedMotionEnabled) {
      return;
    }

    Animated.parallel([
      Animated.timing(header, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(card, {
        delay: 40,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [card, header, reducedMotionEnabled]);

  return {
    cardStyle: {
      opacity: card,
      transform: [
        {
          translateY: card.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          }),
        },
      ],
    },
    headerStyle: {
      opacity: header,
      transform: [
        {
          translateY: header.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        },
      ],
    },
  };
};

const ensureOnboardingStep = (
  router: ReturnType<typeof useRouter>,
  requestedStep: CustomerOnboardingStep,
) => {
  const snapshot = getAuthSnapshot();

  if (
    snapshot.role !== 'customer' ||
    snapshot.customerRouteTarget !== 'onboarding'
  ) {
    router.replace(resolveDefaultRoute(snapshot));
    return false;
  }

  const resolvedStep = resolveCustomerOnboardingStep(
    snapshot.customerOnboarding,
  );
  const steps: readonly CustomerOnboardingStep[] =
    customerOnboardingStepsForDraft(snapshot.customerOnboarding);
  const requestedIndex = steps.indexOf(requestedStep);
  const resolvedIndex = steps.indexOf(resolvedStep);

  if (requestedIndex === -1 || resolvedIndex === -1) {
    router.replace(stepRoutePath[resolvedStep]);
    return false;
  }

  if (requestedIndex > resolvedIndex) {
    router.replace(stepRoutePath[resolvedStep]);
    return false;
  }

  if (
    requestedStep === 'voiceVerification' ||
    requestedStep === 'hostApproval' ||
    requestedStep === 'hostAgreement'
  ) {
    if (requestedStep !== resolvedStep) {
      router.replace(stepRoutePath[resolvedStep]);
      return false;
    }
  }

  return true;
};

function ProgressIndicator({ step }: { step: CustomerOnboardingStep }) {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const meta = stepMetaForDraft(step, onboarding);
  const [progress] = useState(() => new Animated.Value(meta.progress));

  useEffect(() => {
    if (reducedMotionEnabled) {
      progress.setValue(meta.progress);
      return;
    }

    Animated.timing(progress, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: meta.progress,
      useNativeDriver: true,
    }).start();
  }, [meta.progress, progress, reducedMotionEnabled]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: meta.total,
        min: 0,
        now: meta.current,
      }}
      style={styles.progressTrack}
    >
      <Animated.View
        style={[
          styles.progressFill,
          {
            transform: [{ scaleX: progress }],
          },
        ]}
      />
    </View>
  );
}

function OnboardingScaffold({
  bottomAction,
  children,
  compact = false,
  contentStyle,
  reserveBottomActionSpace = true,
  scrollEnabled = true,
  step,
}: {
  bottomAction: ReactNode;
  children: ReactNode;
  compact?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  reserveBottomActionSpace?: boolean;
  scrollEnabled?: boolean;
  step: CustomerOnboardingStep;
}) {
  const { cardStyle, headerStyle } = useEntranceAnimation();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const meta = stepMetaForDraft(step, onboarding);

  return (
    <KeyboardScreen
      bottomAction={bottomAction}
      contentStyle={[
        styles.screenContent,
        compact ? styles.screenContentCompact : null,
        contentStyle,
      ]}
      reserveBottomActionSpace={reserveBottomActionSpace}
      scrollEnabled={scrollEnabled}
    >
      <Animated.View
        style={[
          styles.headerBlock,
          compact ? styles.headerBlockCompact : null,
          headerStyle,
        ]}
      >
        <View
          style={[styles.brandChip, compact ? styles.brandChipCompact : null]}
        >
          <View style={styles.brandIcon}>
            <Sparkles color={ui.color.brand.primary} size={18} />
          </View>
          <Text style={styles.brandText}>Connecto</Text>
        </View>
        <Text style={styles.stepEyebrow}>{meta.eyebrow}</Text>
        <Text
          accessibilityRole="header"
          style={[
            styles.screenTitle,
            compact ? styles.screenTitleCompact : null,
          ]}
        >
          {meta.title}
        </Text>
        <ProgressIndicator step={step} />
      </Animated.View>
      <Animated.View
        style={[
          styles.contentCard,
          compact ? styles.contentCardCompact : null,
          cardStyle,
        ]}
      >
        {children}
      </Animated.View>
    </KeyboardScreen>
  );
}

function StepSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
  const haptics = useHaptics();
  const reducedMotionEnabled = useReducedMotionEnabled();
  const [selectedProgress] = useState(
    () => new Animated.Value(selected ? 1 : 0),
  );

  useEffect(() => {
    if (reducedMotionEnabled) {
      selectedProgress.setValue(selected ? 1 : 0);
      return;
    }

    Animated.timing(selectedProgress, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [reducedMotionEnabled, selected, selectedProgress]);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={ui.hitSlop}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.languageChip,
        selected ? styles.languageChipSelected : null,
        pressed ? styles.languageChipPressed : null,
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.languageChipAnimated,
          selected ? styles.languageChipAnimatedSelected : null,
          {
            transform: [
              {
                scale: selectedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.03],
                }),
              },
            ],
          },
        ]}
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
      </Animated.View>
    </Pressable>
  );
}

function MatchTagCard({
  onPress,
  option,
  selected,
}: {
  onPress: () => void;
  option: MatchTagOption;
  selected: boolean;
}) {
  const haptics = useHaptics();
  const textWidth = estimateMatchTagTextWidth(option.label);

  return (
    <Pressable
      accessibilityLabel={`Select ${option.label}`}
      accessibilityHint={option.description}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      hitSlop={ui.hitSlop}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.matchTagChip,
        selected ? styles.matchTagChipSelected : null,
        pressed ? styles.matchTagChipPressed : null,
      ]}
      testID={`onboarding-match-tag-${option.value}`}
    >
      <Text
        maxFontSizeMultiplier={1}
        numberOfLines={1}
        style={[
          styles.matchTagChipText,
          { width: textWidth },
          selected ? styles.matchTagChipTextSelected : null,
        ]}
      >
        {option.label}
      </Text>
      {selected ? (
        <View style={styles.matchTagChipIcon}>
          <CheckCircle2 color={ui.color.text.inverse} size={13} />
        </View>
      ) : null}
    </Pressable>
  );
}

function PermissionCard({
  action,
  icon: Icon,
  requirement,
  status,
}: {
  action?: ReactNode;
  icon: LucideIcon;
  requirement: OnboardingPermissionRequirement;
  status: keyof typeof permissionLabel;
}) {
  return (
    <Card style={styles.permissionCard} variant="strong">
      <View style={styles.permissionHeader}>
        <View style={styles.permissionIcon}>
          <Icon color={ui.color.brand.primary} size={20} />
        </View>
        <Text style={styles.permissionTitle}>{requirement.title}</Text>
        <StatusBadge
          label={permissionLabel[status]}
          tone={permissionTone[status]}
        />
      </View>
      <Text style={styles.permissionBody}>{requirement.body}</Text>
      <Text style={styles.permissionCallout}>{requirement.callout}</Text>
      {action}
    </Card>
  );
}

export function CustomerOnboardingProfileScreen() {
  const router = useRouter();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const [displayName, setDisplayName] = useState(onboarding.displayName);
  const [dateOfBirthInput, setDateOfBirthInput] = useState(
    onboarding.dateOfBirthInput,
  );
  const [gender, setGender] = useState<CustomerGender | null>(
    onboarding.gender,
  );
  const [profileImage, setProfileImage] =
    useState<CustomerOnboardingImageDraft | null>(onboarding.profileImage);
  const [errors, setErrors] = useState<ProfileErrors>({
    dateOfBirthInput: null,
    displayName: null,
    gender: null,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mediaAction, setMediaAction] = useState<'crop' | 'select' | null>(
    null,
  );

  useEffect(() => {
    if (!ensureOnboardingStep(router, 'profile')) {
      return;
    }

    queueMicrotask(() => {
      void persistDraftPatch({ currentStep: 'profile' }).catch(() => undefined);
    });
  }, [router]);

  const chooseImage = async () => {
    setMediaAction('select');
    setSubmitError(null);

    try {
      const image = await customerOnboardingAdapter.selectProfileImage();

      if (image === null) {
        return;
      }

      setProfileImage(image);
      await persistDraftPatch({ profileImage: image });
      setSubmitSuccess('Profile image saved on this device.');
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setMediaAction(null);
    }
  };

  const recropImage = async () => {
    if (profileImage === null) {
      return;
    }

    setMediaAction('crop');
    setSubmitError(null);

    try {
      const image = await customerOnboardingAdapter.updateProfileImageCrop({
        image: profileImage,
      });

      if (image === null) {
        return;
      }

      setProfileImage(image);
      await persistDraftPatch({ profileImage: image });
      setSubmitSuccess('Photo crop updated.');
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setMediaAction(null);
    }
  };

  const continueToLanguage = async () => {
    const nextErrors = validateCustomerOnboardingProfileDraft({
      dateOfBirthInput,
      displayName,
      gender,
    });
    setErrors(nextErrors);

    if (
      Object.values(nextErrors).some((value) => value !== null) ||
      gender === null
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await customerOnboardingAdapter.saveProfile({
        dateOfBirthInput,
        displayName,
        gender,
        profileImage,
      });
      await persistDraftPatch({
        currentStep: 'language',
        dateOfBirthInput: result.dateOfBirthInput,
        displayName: result.displayName,
        gender: result.gender,
        profileImage: result.profileImage,
      });
      router.replace(stepRoutePath.language);
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      bottomAction={
        <View style={styles.bottomActions}>
          <Button
            loading={submitting}
            onPress={() => {
              void continueToLanguage();
            }}
            title="Continue"
          />
        </View>
      }
      step="profile"
    >
      <Text style={styles.bodyText}>
        Your name, date of birth, and optional photo help us keep customer
        records consistent without collecting more than this stage needs.
      </Text>
      {submitSuccess === null ? null : (
        <Banner message={submitSuccess} title="Saved" tone="success" />
      )}
      {submitError === null ? null : (
        <Banner
          message={submitError}
          title="Could not update profile"
          tone="error"
        />
      )}
      <StepSection title="Basic details">
        <TextField
          autoCapitalize="words"
          autoComplete="name"
          {...(errors.displayName === null
            ? {}
            : { errorText: errors.displayName })}
          label="Display name"
          onChangeText={(value) => {
            setDisplayName(value);
            setErrors((current) => ({ ...current, displayName: null }));
            setSubmitError(null);
            setSubmitSuccess(null);
            updateCustomerOnboardingDraft({ displayName: value });
            void saveAuthSnapshot().catch(() => undefined);
          }}
          placeholder="Your name"
          testID="onboarding-display-name"
          value={displayName}
        />
        <TextField
          {...(errors.dateOfBirthInput === null
            ? {}
            : { errorText: errors.dateOfBirthInput })}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Date of birth"
          maxLength={10}
          onChangeText={(value) => {
            const formatted = formatDateOfBirthInput(value);
            setDateOfBirthInput(formatted);
            setErrors((current) => ({ ...current, dateOfBirthInput: null }));
            setSubmitError(null);
            setSubmitSuccess(null);
            updateCustomerOnboardingDraft({ dateOfBirthInput: formatted });
            void saveAuthSnapshot().catch(() => undefined);
          }}
          placeholder="DD/MM/YYYY"
          testID="onboarding-date-of-birth"
          value={dateOfBirthInput}
        />
      </StepSection>
      <StepSection title="Gender">
        <View accessibilityRole="radiogroup" style={styles.optionStack}>
          {customerGenderOptions.map((option) => (
            <RadioCard
              description={option.description}
              key={option.value}
              label={option.label}
              onPress={() => {
                setGender(option.value);
                setErrors((current) => ({ ...current, gender: null }));
                setSubmitError(null);
                setSubmitSuccess(null);
                updateCustomerOnboardingDraft({ gender: option.value });
                void saveAuthSnapshot().catch(() => undefined);
              }}
              selected={gender === option.value}
              testID={`onboarding-gender-${option.value}`}
            />
          ))}
        </View>
        {errors.gender === null ? null : (
          <InlineError message={errors.gender} />
        )}
      </StepSection>
      <StepSection title="Profile image (Optional)">
        {profileImage === null ? (
          <Card style={styles.imageEmptyCard}>
            <View style={styles.imageEmptyIcon}>
              <UserRound color={ui.color.brand.primary} size={22} />
            </View>
            <View style={styles.imageCopy}>
              <Text style={styles.sectionBody}>
                Add a photo now or continue without one. The image stays on this
                device in mock mode until a remote media service is wired.
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.imagePreviewCard}>
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: profileImage.previewUri }}
              style={styles.imagePreview}
            />
            <View style={styles.imageCopy}>
              <Text style={styles.permissionTitle}>
                {profileImage.sourceName}
              </Text>
              <Text style={styles.sectionBody}>{profileImage.cropLabel}</Text>
            </View>
          </Card>
        )}
        <View style={styles.inlineActions}>
          <Button
            compact
            loading={mediaAction === 'select'}
            onPress={() => {
              void chooseImage();
            }}
            title={profileImage === null ? 'Choose photo' : 'Replace photo'}
          />
          <Button
            compact
            disabled={profileImage === null}
            loading={mediaAction === 'crop'}
            onPress={() => {
              void recropImage();
            }}
            title="Change crop"
            variant="secondary"
          />
          <Button
            compact
            disabled={profileImage === null || mediaAction !== null}
            onPress={() => {
              setProfileImage(null);
              updateCustomerOnboardingDraft({ profileImage: null });
              void saveAuthSnapshot().catch(() => undefined);
              setSubmitSuccess('Profile image removed from your profile.');
            }}
            title="Remove"
            variant="ghost"
          />
        </View>
      </StepSection>
    </OnboardingScaffold>
  );
}

export function CustomerOnboardingLanguageScreen() {
  const router = useRouter();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const [languageState, setLanguageState] = useState<
    AsyncLoadState<LanguageOption[]>
  >({
    kind: 'loading',
  });
  const [query, setQuery] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState<Language | null>(
    onboarding.primaryLanguage,
  );
  const [secondaryLanguage, setSecondaryLanguage] = useState<Language | null>(
    onboarding.secondaryLanguage,
  );
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadLanguages = useCallback(() => {
    setLanguageState({ kind: 'loading' });

    customerOnboardingAdapter
      .listLanguages()
      .then((languages) => {
        if (languages.length === 0) {
          setLanguageState({ kind: 'empty' });
          return;
        }

        setLanguageState({ data: languages, kind: 'success' });
      })
      .catch((error: unknown) => {
        const normalized = normalizeApiError(error);
        setLanguageState({
          kind: 'error',
          message: normalized.message,
          offline: normalized.code === 'offline',
        });
      });
  }, []);

  useEffect(() => {
    if (!ensureOnboardingStep(router, 'language')) {
      return;
    }

    queueMicrotask(() => {
      void persistDraftPatch({ currentStep: 'language' }).catch(
        () => undefined,
      );
      loadLanguages();
    });
  }, [loadLanguages, router]);

  const filteredLanguages = useMemo(() => {
    if (languageState.kind !== 'success') {
      return [];
    }

    return filterCustomerOnboardingLanguages(languageState.data, query);
  }, [languageState, query]);

  const continueToMatchTags = async () => {
    if (primaryLanguage === null) {
      setSelectionError('Choose your primary language before continuing.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await customerOnboardingAdapter.saveLanguages({
        primaryLanguage,
        secondaryLanguage,
      });
      await persistDraftPatch({
        currentStep: 'matchTags',
        primaryLanguage: result.primaryLanguage,
        secondaryLanguage: result.secondaryLanguage,
      });
      router.replace(stepRoutePath.matchTags);
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  let content: ReactNode = null;

  if (languageState.kind === 'loading') {
    content = (
      <Card>
        <Skeleton lines={7} />
      </Card>
    );
  } else if (languageState.kind === 'error') {
    content = (
      <ErrorState
        message={languageState.message}
        onRetry={loadLanguages}
        retryLabel="Retry"
        title={languageState.offline ? 'Offline' : 'Could not load languages'}
      />
    );
  } else if (languageState.kind === 'empty') {
    content = (
      <EmptyState
        actionLabel="Retry"
        message="No language options are available in this build yet."
        onAction={loadLanguages}
        title="No languages configured"
      />
    );
  } else {
    content = (
      <View style={styles.section}>
        <SearchField
          onChangeText={(value) => {
            setQuery(value);
          }}
          placeholder="Search languages"
          testID="onboarding-language-search"
          value={query}
        />
        <Card style={styles.selectedSummaryCard}>
          <Text style={styles.previewLabel}>Selected</Text>
          <View style={styles.selectedSummaryRow}>
            <StatusBadge
              label={
                primaryLanguage === null
                  ? 'Primary not selected'
                  : `Primary: ${primaryLanguage}`
              }
              tone={primaryLanguage === null ? 'warning' : 'success'}
            />
            <StatusBadge
              label={
                secondaryLanguage === null
                  ? 'Secondary optional'
                  : `Secondary: ${secondaryLanguage}`
              }
              tone={secondaryLanguage === null ? 'info' : 'success'}
            />
          </View>
        </Card>
        {filteredLanguages.length === 0 ? (
          <EmptyState
            message="Try a broader search term."
            title="No language matches"
          />
        ) : (
          <>
            <StepSection title="Primary language">
              <View accessibilityRole="radiogroup" style={styles.optionStack}>
                {filteredLanguages.map((option) => (
                  <RadioCard
                    description={option.description}
                    key={option.language}
                    label={option.label}
                    onPress={() => {
                      setPrimaryLanguage(option.language);
                      if (secondaryLanguage === option.language) {
                        setSecondaryLanguage(null);
                        updateCustomerOnboardingDraft({
                          primaryLanguage: option.language,
                          secondaryLanguage: null,
                        });
                      } else {
                        updateCustomerOnboardingDraft({
                          primaryLanguage: option.language,
                        });
                      }
                      void saveAuthSnapshot().catch(() => undefined);
                      setSelectionError(null);
                      setSubmitError(null);
                    }}
                    selected={primaryLanguage === option.language}
                    testID={`onboarding-primary-language-${option.language}`}
                  />
                ))}
              </View>
            </StepSection>
            <StepSection title="Secondary language (Optional)">
              <Text style={styles.sectionBody}>
                Pick one optional backup language. This helps if your primary
                language has fewer available hosts.
              </Text>
              <View style={styles.languageChipWrap}>
                {filteredLanguages
                  .filter((option) => option.language !== primaryLanguage)
                  .map((option) => (
                    <LanguageChip
                      key={`secondary-${option.language}`}
                      label={option.label}
                      onPress={() => {
                        const nextValue =
                          secondaryLanguage === option.language
                            ? null
                            : option.language;
                        setSecondaryLanguage(nextValue);
                        updateCustomerOnboardingDraft({
                          secondaryLanguage: nextValue,
                        });
                        void saveAuthSnapshot().catch(() => undefined);
                        setSubmitError(null);
                      }}
                      selected={secondaryLanguage === option.language}
                      testID={`onboarding-secondary-language-${option.language}`}
                    />
                  ))}
              </View>
            </StepSection>
          </>
        )}
        {selectionError === null ? null : (
          <InlineError message={selectionError} />
        )}
      </View>
    );
  }

  return (
    <OnboardingScaffold
      bottomAction={
        <View style={styles.bottomActions}>
          <Button
            disabled={languageState.kind !== 'success'}
            loading={submitting}
            onPress={() => {
              void continueToMatchTags();
            }}
            title="Continue"
          />
        </View>
      }
      step="language"
    >
      <GlassSurface
        borderColor="rgba(255,255,255,0.96)"
        overlayColor="rgba(255,255,255,0.84)"
        style={styles.introCard}
        variant="strong"
      >
        <Text style={styles.bodyText}>
          Choose one main language and, if useful, one fallback. Search works
          across labels and aliases so long names remain easy to find.
        </Text>
      </GlassSurface>
      {submitError === null ? null : (
        <Banner
          message={submitError}
          title="Could not save languages"
          tone="error"
        />
      )}
      {content}
    </OnboardingScaffold>
  );
}

export function CustomerOnboardingMatchTagsScreen() {
  const router = useRouter();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const [selectedTags, setSelectedTags] = useState<CustomerMatchTag[]>([
    ...onboarding.matchTags,
  ]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hostApplicant = isHostApplicantDraft(onboarding);
  const selectedOptions = useMemo(
    () =>
      customerOnboardingMatchTagOptions.filter((option) =>
        selectedTags.includes(option.value),
      ),
    [selectedTags],
  );

  useEffect(() => {
    if (!ensureOnboardingStep(router, 'matchTags')) {
      return;
    }

    queueMicrotask(() => {
      void persistDraftPatch({ currentStep: 'matchTags' }).catch(
        () => undefined,
      );
    });
  }, [router]);

  const persistSelectedTags = (nextTags: CustomerMatchTag[]) => {
    setSelectedTags(nextTags);
    updateCustomerOnboardingDraft({ matchTags: nextTags });
    void saveAuthSnapshot().catch(() => undefined);
  };

  const toggleTag = (tag: CustomerMatchTag) => {
    setSelectionError(null);

    if (selectedTags.includes(tag)) {
      persistSelectedTags(selectedTags.filter((item) => item !== tag));
      return;
    }

    if (selectedTags.length >= maxMatchTags) {
      setSelectionError(`Choose up to ${String(maxMatchTags)} tags.`);
      return;
    }

    persistSelectedTags([...selectedTags, tag]);
  };

  const continueToPermissions = async () => {
    if (selectedTags.length === 0) {
      setSelectionError('Choose at least one tag before continuing.');
      return;
    }

    setSubmitting(true);
    setSelectionError(null);

    try {
      await persistDraftPatch({
        currentStep: 'permissions',
        matchTags: selectedTags,
      });
      router.replace(stepRoutePath.permissions);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      bottomAction={
        <View style={styles.bottomActions}>
          <Button
            loading={submitting}
            onPress={() => {
              void continueToPermissions();
            }}
            title="Continue"
          />
        </View>
      }
      compact
      contentStyle={styles.matchTagScreenContent}
      reserveBottomActionSpace={false}
      scrollEnabled={false}
      step="matchTags"
    >
      <GlassSurface
        borderColor="rgba(255,255,255,0.96)"
        overlayColor="rgba(255,255,255,0.84)"
        style={[styles.introCard, styles.matchTagsIntroCard]}
        variant="strong"
      >
        <Text style={[styles.bodyText, styles.matchTagsIntroText]}>
          {hostApplicant
            ? 'Pick up to four tags you can host. We use them for matching.'
            : 'Pick up to four tags you want most. We use them for matching.'}
        </Text>
      </GlassSurface>
      <Card style={[styles.selectedSummaryCard, styles.matchTagSummaryCard]}>
        <View style={styles.matchTagSummaryHeader}>
          <Text
            maxFontSizeMultiplier={1}
            style={[styles.previewLabel, styles.matchTagSummaryLabel]}
          >
            Selected tags
          </Text>
          <View
            style={[
              styles.matchTagCountBadge,
              selectedTags.length === 0
                ? styles.matchTagCountBadgeEmpty
                : styles.matchTagCountBadgeSelected,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1}
              numberOfLines={1}
              style={[
                styles.matchTagCountText,
                selectedTags.length === 0
                  ? styles.matchTagCountTextEmpty
                  : styles.matchTagCountTextSelected,
              ]}
            >
              {`${String(selectedTags.length)}/${String(maxMatchTags)}`}
            </Text>
          </View>
        </View>
        {selectedOptions.length === 0 ? (
          <Text style={[styles.sectionBody, styles.matchTagEmptySummaryText]}>
            Select at least one tag. You can choose up to four.
          </Text>
        ) : (
          <View style={styles.selectedSummaryRow}>
            {selectedOptions.map((option) => (
              <View
                key={`selected-${option.value}`}
                style={styles.selectedMatchTagChip}
              >
                <Text
                  maxFontSizeMultiplier={1}
                  numberOfLines={1}
                  style={[
                    styles.selectedMatchTagChipText,
                    { width: estimateMatchTagTextWidth(option.label) },
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
      <View style={styles.matchTagSection}>
        <Text style={[styles.sectionTitle, styles.matchTagSectionTitle]}>
          Conversation tags
        </Text>
        <View style={styles.matchTagGrid}>
          {customerOnboardingMatchTagOptions.map((option) => (
            <MatchTagCard
              key={option.value}
              onPress={() => {
                toggleTag(option.value);
              }}
              option={option}
              selected={selectedTags.includes(option.value)}
            />
          ))}
        </View>
        {selectionError === null ? null : (
          <InlineError message={selectionError} />
        )}
      </View>
    </OnboardingScaffold>
  );
}

export function CustomerOnboardingPermissionsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const [requirementsState, setRequirementsState] = useState<
    AsyncLoadState<OnboardingPermissionRequirement[]>
  >({
    kind: 'loading',
  });
  const [pendingNotificationAction, setPendingNotificationAction] = useState<
    'not-now' | 'request' | null
  >(null);
  const [pendingDevicePermissionKind, setPendingDevicePermissionKind] =
    useState<OnboardingDevicePermissionKind | null>(null);
  const [devicePermissionStatus, setDevicePermissionStatus] = useState<
    Record<OnboardingDevicePermissionKind, CustomerPermissionStatus>
  >({
    camera: 'unknown',
    location: onboarding.location.status,
    microphone: 'unknown',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const loadPermissionRequirements = useCallback(() => {
    setRequirementsState({ kind: 'loading' });

    customerOnboardingAdapter
      .listPermissionRequirements()
      .then((requirements) => {
        if (requirements.length === 0) {
          setRequirementsState({ kind: 'empty' });
          return;
        }

        setRequirementsState({
          data: requirements,
          kind: 'success',
        });
      })
      .catch((error: unknown) => {
        const normalized = normalizeApiError(error);
        setRequirementsState({
          kind: 'error',
          message: normalized.message,
          offline: normalized.code === 'offline',
        });
      });
  }, []);

  useEffect(() => {
    if (!ensureOnboardingStep(router, 'permissions')) {
      return;
    }

    queueMicrotask(() => {
      void persistDraftPatch({
        cameraEducationSeen: true,
        currentStep: 'permissions',
        microphoneEducationSeen: true,
      }).catch(() => undefined);
      loadPermissionRequirements();
    });
  }, [loadPermissionRequirements, router]);

  const setNotificationLater = async () => {
    setPendingNotificationAction('not-now');
    setSubmitError(null);

    try {
      await persistDraftPatch({
        notificationRequestedAtIso: new Date().toISOString(),
        notificationsPermission: 'not-now',
      });
      setSubmitSuccess(
        'Notifications can wait. You can still finish onboarding.',
      );
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setPendingNotificationAction(null);
    }
  };

  const persistNotificationPermissionResult = async (
    result: CustomerOnboardingNotificationPermissionResult,
  ) => {
    await persistDraftPatch({
      notificationRequestedAtIso: result.requestedAtIso,
      notificationsPermission: result.status,
    });
    setSubmitSuccess(
      result.status === 'granted'
        ? 'Notifications allowed for this device.'
        : 'Notification permission was declined, but onboarding can continue.',
    );
  };

  const requestNotificationPermission = async () => {
    setPendingNotificationAction('request');
    setSubmitError(null);

    try {
      const result =
        await customerOnboardingAdapter.requestNotificationPermission();
      await persistNotificationPermissionResult(result);
      return result;
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
      return null;
    } finally {
      setPendingNotificationAction(null);
    }
  };

  const persistDevicePermissionResult = (
    kind: OnboardingDevicePermissionKind,
    result:
      | CustomerOnboardingDevicePermissionResult
      | CustomerOnboardingLocationPermissionResult,
  ) => {
    setDevicePermissionStatus((current) => ({
      ...current,
      [kind]: result.status,
    }));

    if (
      kind === 'location' &&
      result.status === 'granted' &&
      'placeLabel' in result &&
      result.placeLabel !== null
    ) {
      setSubmitSuccess(`Location detected as ${result.placeLabel}.`);
      return;
    }

    setSubmitSuccess(
      result.status === 'granted'
        ? `${devicePermissionTitle[kind]} permission allowed for this device.`
        : `${devicePermissionTitle[kind]} permission was declined, but onboarding can continue.`,
    );
  };

  const persistLocationPermissionResult = async (
    result: CustomerOnboardingLocationPermissionResult,
  ) => {
    persistDevicePermissionResult('location', result);
    await persistDraftPatch({
      location: {
        accuracyMeters: result.accuracyMeters,
        latitude: result.latitude,
        longitude: result.longitude,
        placeLabel: result.placeLabel,
        requestedAtIso: result.requestedAtIso,
        status: result.status,
      },
    });
  };

  const requestDevicePermission = async (
    kind: OnboardingDevicePermissionKind,
  ) => {
    setPendingDevicePermissionKind(kind);
    setSubmitError(null);

    try {
      if (kind === 'location') {
        const result =
          await customerOnboardingAdapter.requestLocationPermission();
        await persistLocationPermissionResult(result);
        return result;
      }

      const result =
        kind === 'camera'
          ? await customerOnboardingAdapter.requestCameraPermission()
          : await customerOnboardingAdapter.requestMicrophonePermission();
      persistDevicePermissionResult(kind, result);
      return result;
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
      return null;
    } finally {
      setPendingDevicePermissionKind(null);
    }
  };

  const requestMissingLocationPermission = async () => {
    if (devicePermissionStatus.location === 'granted') {
      return;
    }

    setPendingDevicePermissionKind('location');

    try {
      const result =
        await customerOnboardingAdapter.requestLocationPermission();
      await persistLocationPermissionResult(result);
    } finally {
      setPendingDevicePermissionKind(null);
    }
  };

  const finishOnboarding = async () => {
    if (
      requirementsState.kind === 'loading' ||
      requirementsState.kind === 'error'
    ) {
      return;
    }

    const dateOfBirthIso = dateOfBirthInputToIsoDate(
      onboarding.dateOfBirthInput,
    );

    if (
      dateOfBirthIso === null ||
      onboarding.gender === null ||
      onboarding.primaryLanguage === null ||
      onboarding.matchTags.length === 0
    ) {
      setSubmitError(
        'Complete the required profile, language, and match tag steps before finishing setup.',
      );
      return;
    }

    setFinishing(true);
    setSubmitError(null);

    try {
      let notificationPermission = onboarding.notificationsPermission;

      await requestMissingLocationPermission();

      if (notificationPermission === 'unknown') {
        setPendingNotificationAction('request');
        const result =
          await customerOnboardingAdapter.requestNotificationPermission();
        await persistNotificationPermissionResult(result);
        notificationPermission = result.status;
        setPendingNotificationAction(null);
      }

      const completedAtIso = new Date().toISOString();
      const customer = await frontendServices.customer.updateProfile({
        customerId: mobileDataIds.customerId,
        profile: {
          ageConfirmed: true,
          dateOfBirthIso,
          displayName: onboarding.displayName.trim(),
          gender: onboarding.gender,
          notificationPermission,
          onboardingCompletedAtIso: completedAtIso,
          preferredLanguages: buildCustomerPreferredLanguages(
            onboarding.primaryLanguage,
            onboarding.secondaryLanguage,
          ),
          profileImageUri: onboarding.profileImage?.localUri ?? null,
        },
      });
      queryClient.setQueryData(
        queryKeys.customer.profile(mobileDataIds.customerId),
        customer,
      );

      if (isHostApplicantDraft(onboarding)) {
        await persistDraftPatch({
          currentStep: 'voiceVerification',
          notificationsPermission: notificationPermission,
        });
        router.replace(stepRoutePath.voiceVerification);
        return;
      }

      const route = completeCustomerOnboardingNavigation({
        completedAtIso,
        matchTags: onboarding.matchTags,
        notificationsPermission: notificationPermission,
      });
      await saveAuthSnapshot();
      router.replace(route);
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setPendingDevicePermissionKind(null);
      setPendingNotificationAction(null);
      setFinishing(false);
    }
  };

  let content: ReactNode = null;

  if (requirementsState.kind === 'loading') {
    content = (
      <Card>
        <Skeleton lines={7} />
      </Card>
    );
  } else if (requirementsState.kind === 'error') {
    content = (
      <ErrorState
        message={requirementsState.message}
        onRetry={loadPermissionRequirements}
        retryLabel="Retry"
        title={
          requirementsState.offline ? 'Offline' : 'Could not load permissions'
        }
      />
    );
  } else if (requirementsState.kind === 'empty') {
    content = (
      <EmptyState
        actionLabel="Reload"
        message="This build has no onboarding permission requirements configured."
        onAction={loadPermissionRequirements}
        title="No permission content"
      />
    );
  } else {
    content = (
      <View style={styles.optionStack}>
        {requirementsState.data.map((requirement) => {
          if (requirement.kind === 'notifications') {
            const notificationAction =
              onboarding.notificationsPermission === 'granted' ? null : (
                <View style={styles.inlineActions}>
                  <Button
                    compact
                    loading={pendingNotificationAction === 'request'}
                    onPress={() => {
                      void requestNotificationPermission();
                    }}
                    testID="onboarding-notification-request"
                    title="Request now"
                  />
                  <Button
                    compact
                    loading={pendingNotificationAction === 'not-now'}
                    onPress={() => {
                      void setNotificationLater();
                    }}
                    testID="onboarding-notification-not-now"
                    title="Not now"
                    variant="secondary"
                  />
                </View>
              );

            return (
              <PermissionCard
                action={notificationAction}
                icon={Bell}
                key={requirement.kind}
                requirement={requirement}
                status={onboarding.notificationsPermission}
              />
            );
          }

          const permissionKind =
            requirement.kind satisfies OnboardingDevicePermissionKind;
          const permissionStatus = devicePermissionStatus[permissionKind];
          const permissionAction =
            permissionStatus === 'granted' ? null : (
              <Button
                compact
                loading={pendingDevicePermissionKind === permissionKind}
                onPress={() => {
                  void requestDevicePermission(permissionKind);
                }}
                testID={`onboarding-${permissionKind}-request`}
                title="Request now"
              />
            );

          return (
            <PermissionCard
              action={permissionAction}
              icon={
                requirement.kind === 'camera'
                  ? Camera
                  : requirement.kind === 'location'
                    ? MapPin
                    : Mic
              }
              key={requirement.kind}
              requirement={requirement}
              status={permissionStatus}
            />
          );
        })}
      </View>
    );
  }

  return (
    <OnboardingScaffold
      bottomAction={
        <View style={styles.bottomActions}>
          <Button
            disabled={
              requirementsState.kind === 'loading' ||
              requirementsState.kind === 'error' ||
              pendingDevicePermissionKind !== null ||
              pendingNotificationAction !== null
            }
            loading={finishing}
            onPress={() => {
              void finishOnboarding();
            }}
            testID="onboarding-finish"
            title="Finish setup"
          />
        </View>
      }
      step="permissions"
    >
      <GlassSurface
        borderColor="rgba(255,255,255,0.96)"
        overlayColor="rgba(255,255,255,0.84)"
        style={styles.introCard}
        variant="strong"
      >
        <Text style={styles.bodyText}>
          Review each permission here. Continue will detect location if it is
          still missing. You can grant microphone, camera, and notifications
          now, or allow them later from the feature that needs them.
        </Text>
      </GlassSurface>
      {submitSuccess === null ? null : (
        <Banner message={submitSuccess} title="Saved" tone="success" />
      )}
      {submitError === null ? null : (
        <Banner
          message={submitError}
          title="Could not update permissions"
          tone="error"
        />
      )}
      {content}
      <Banner
        message="Denying permissions does not block onboarding. Voice, video, location, and notifications will ask again when the feature needs access."
        title="Permissions stay optional"
        tone="info"
      />
    </OnboardingScaffold>
  );
}

const recordingAudioMode = {
  allowsRecording: true,
  interruptionMode: 'doNotMix',
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} as const;

const playbackAudioMode = {
  allowsRecording: false,
  interruptionMode: 'mixWithOthers',
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} as const;

const formatRecordingDuration = (durationMillis: number) =>
  `${String(Math.max(0, Math.ceil(durationMillis / 1000)))}s`;

export function CustomerOnboardingVoiceVerificationScreen() {
  const router = useRouter();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [recordingUri, setRecordingUri] = useState<string | null>(
    onboarding.hostVoiceVerificationRecordingUri,
  );
  const [recording, setRecording] = useState(false);
  const [recordingDurationMillis, setRecordingDurationMillis] = useState(0);
  const [recordingStartedAtMs, setRecordingStartedAtMs] = useState<
    number | null
  >(null);
  const [action, setAction] = useState<
    'recording' | 'stopping' | 'submitting' | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!ensureOnboardingStep(router, 'voiceVerification')) {
      return;
    }

    queueMicrotask(() => {
      void persistDraftPatch({
        currentStep: 'voiceVerification',
      }).catch(() => undefined);
    });
  }, [router]);

  useEffect(
    () => () => {
      // `useAudioRecorder` can release the native recorder before this cleanup
      // runs, so rely on React state instead of reading recorder properties here.
      if (recording) {
        try {
          void recorder.stop().catch(() => undefined);
        } catch {
          // Ignore recorder teardown races during route transitions.
        }
      }

      void setAudioModeAsync(playbackAudioMode).catch(() => undefined);
    },
    [recording, recorder],
  );

  useEffect(() => {
    if (!recording || recordingStartedAtMs === null) {
      return;
    }

    const interval = setInterval(() => {
      setRecordingDurationMillis(Date.now() - recordingStartedAtMs);
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [recording, recordingStartedAtMs]);

  const voiceVerificationSentence = useMemo(
    () => buildHostVoiceVerificationSentence(onboarding),
    [onboarding],
  );

  const startRecording = async () => {
    setAction('recording');
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const permission =
        await customerOnboardingAdapter.requestMicrophonePermission();

      if (permission.status !== 'granted') {
        setSubmitError(
          'Allow microphone access to record the verification sentence.',
        );
        return;
      }

      await setAudioModeAsync(recordingAudioMode);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecordingDurationMillis(0);
      setRecordingStartedAtMs(Date.now());
      setRecordingUri(null);
      await persistDraftPatch({
        hostVoiceVerificationRecordingUri: null,
        hostVoiceVerificationStatus: 'not-started',
        hostVoiceVerificationSubmittedAtIso: null,
      });
    } catch (error: unknown) {
      setRecording(false);
      setSubmitError(normalizeApiError(error).message);
      void setAudioModeAsync(playbackAudioMode).catch(() => undefined);
    } finally {
      setAction(null);
    }
  };

  const stopRecording = async () => {
    setAction('stopping');
    setSubmitError(null);

    try {
      await recorder.stop();
      const nextUri = recorder.uri ?? recorder.getStatus().url;

      if (nextUri === null) {
        setSubmitError('Recording could not be saved. Please try again.');
        return;
      }

      setRecording(false);
      setRecordingStartedAtMs(null);
      setRecordingUri(nextUri);
      await persistDraftPatch({
        hostVoiceVerificationRecordingUri: nextUri,
      });
      setSubmitSuccess('Recording saved. Submit it for verification.');
    } catch (error: unknown) {
      setRecording(false);
      setRecordingStartedAtMs(null);
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setAction(null);
      void setAudioModeAsync(playbackAudioMode).catch(() => undefined);
    }
  };

  const submitVerification = async () => {
    if (recordingUri === null) {
      setSubmitError('Record the sentence before submitting.');
      return;
    }

    setAction('submitting');
    setSubmitError(null);

    try {
      const result =
        await customerOnboardingAdapter.submitHostVoiceVerification({
          recordingUri,
          sentence: voiceVerificationSentence,
        });
      await persistDraftPatch({
        currentStep: 'hostApproval',
        hostVoiceVerificationRecordingUri: result.recordingUri,
        hostVoiceVerificationStatus: result.status,
        hostVoiceVerificationSubmittedAtIso: result.submittedAtIso,
      });
      router.replace(stepRoutePath.hostApproval);
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setAction(null);
    }
  };

  const durationLabel = formatRecordingDuration(recordingDurationMillis);
  const recordButtonTitle = recording ? 'Stop recording' : 'Record sentence';

  return (
    <OnboardingScaffold
      bottomAction={
        <View style={styles.bottomActions}>
          <Button
            disabled={recording || recordingUri === null}
            loading={action === 'submitting'}
            onPress={() => {
              void submitVerification();
            }}
            testID="onboarding-submit-voice-verification"
            title="Submit verification"
          />
        </View>
      }
      step="voiceVerification"
    >
      <GlassSurface
        borderColor="rgba(255,255,255,0.96)"
        overlayColor="rgba(255,255,255,0.84)"
        style={[styles.introCard, styles.voiceIntroCard]}
        variant="strong"
      >
        <Text style={styles.bodyText}>
          Read the sentence aloud in a clear voice. The recording is sent for
          backend verification before the application can continue.
        </Text>
      </GlassSurface>
      {submitSuccess === null ? null : (
        <Banner
          message={submitSuccess}
          title="Recording ready"
          tone="success"
        />
      )}
      {submitError === null ? null : (
        <Banner
          message={submitError}
          title="Could not verify voice"
          tone="error"
        />
      )}
      <Card style={styles.voiceSentenceCard} variant="strong">
        <Text style={styles.previewLabel}>Verification script</Text>
        <Text style={styles.voiceSentence}>{voiceVerificationSentence}</Text>
      </Card>
      <View style={styles.voiceRecorderBlock}>
        <Pressable
          accessibilityLabel={recordButtonTitle}
          accessibilityRole="button"
          accessibilityState={{
            busy: action === 'recording' || action === 'stopping',
            selected: recording,
          }}
          disabled={
            action === 'recording' ||
            action === 'stopping' ||
            action === 'submitting'
          }
          onPress={() => {
            if (recording) {
              void stopRecording();
            } else {
              void startRecording();
            }
          }}
          style={({ pressed }) => [
            styles.voiceRecordButton,
            recording ? styles.voiceRecordButtonActive : null,
            pressed ? styles.voiceRecordButtonPressed : null,
          ]}
          testID="onboarding-record-voice"
        >
          <Mic color={ui.color.text.inverse} size={56} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.voiceRecordTitle}>{recordButtonTitle}</Text>
        <Text style={styles.voiceRecordHelper}>
          {recording
            ? `Recording ${durationLabel}`
            : recordingUri === null
              ? 'Tap the microphone and read the script above.'
              : 'Recording saved. Submit or record again.'}
        </Text>
      </View>
    </OnboardingScaffold>
  );
}

export function CustomerOnboardingHostApprovalScreen() {
  const router = useRouter();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const submittedAtIso = onboarding.hostVoiceVerificationSubmittedAtIso;
  const [checking, setChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const checkApproval = useCallback(
    async (silent = false) => {
      if (submittedAtIso === null) {
        setSubmitError('Submit voice verification before checking approval.');
        router.replace(stepRoutePath.voiceVerification);
        return;
      }

      if (!silent) {
        setChecking(true);
      }

      try {
        const result =
          await customerOnboardingAdapter.getHostVoiceVerificationApproval({
            submittedAtIso,
          });

        await persistDraftPatch({
          currentStep:
            result.status === 'verified' ? 'hostAgreement' : 'hostApproval',
          hostVoiceVerificationStatus: result.status,
        });

        if (result.status === 'verified') {
          router.replace(stepRoutePath.hostAgreement);
        }
      } catch (error: unknown) {
        if (!silent) {
          setSubmitError(normalizeApiError(error).message);
        }
      } finally {
        if (!silent) {
          setChecking(false);
        }
      }
    },
    [router, submittedAtIso],
  );

  useEffect(() => {
    if (!ensureOnboardingStep(router, 'hostApproval')) {
      return;
    }

    queueMicrotask(() => {
      void persistDraftPatch({
        currentStep: 'hostApproval',
      }).catch(() => undefined);
    });
  }, [router]);

  useEffect(() => {
    const firstCheck = setTimeout(() => {
      void checkApproval(true);
    }, 900);
    const interval = setInterval(() => {
      void checkApproval(true);
    }, 1_800);

    return () => {
      clearTimeout(firstCheck);
      clearInterval(interval);
    };
  }, [checkApproval]);

  return (
    <OnboardingScaffold
      bottomAction={
        <View style={styles.bottomActions}>
          <Button
            loading={checking}
            onPress={() => {
              void checkApproval();
            }}
            testID="onboarding-check-host-approval"
            title="Check approval status"
          />
        </View>
      }
      step="hostApproval"
    >
      <Card style={styles.approvalCard} variant="strong">
        <View style={styles.approvalIcon}>
          <Clock color={ui.color.brand.primary} size={34} />
        </View>
        <Text style={styles.approvalTitle}>Voice verification submitted</Text>
        <Text style={styles.approvalBody}>
          Backend review is in progress. The Host Agreement unlocks
          automatically after the verification is approved.
        </Text>
        <StatusBadge label="Under review" tone="warning" />
      </Card>
      {submitError === null ? null : (
        <Banner
          message={submitError}
          title="Could not check status"
          tone="error"
        />
      )}
      <Card style={styles.reviewStepsCard}>
        <StepSection title="Review progress">
          <View style={styles.reviewStep}>
            <CheckCircle2 color={ui.color.status.success} size={22} />
            <Text style={styles.sectionBody}>Recording received</Text>
          </View>
          <View style={styles.reviewStep}>
            <Clock color={ui.color.status.warning} size={22} />
            <Text style={styles.sectionBody}>Backend approval pending</Text>
          </View>
          <View style={styles.reviewStep}>
            <FileText color={ui.color.text.tertiary} size={22} />
            <Text style={styles.sectionBody}>Host Agreement locked</Text>
          </View>
        </StepSection>
      </Card>
    </OnboardingScaffold>
  );
}

function AgreementPoint({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.agreementPoint}>
      <View style={styles.agreementPointIcon}>
        <ShieldCheck color={ui.color.brand.primary} size={18} />
      </View>
      <View style={styles.imageCopy}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.sectionBody}>{body}</Text>
      </View>
    </View>
  );
}

export function CustomerOnboardingHostAgreementScreen() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!ensureOnboardingStep(router, 'hostAgreement')) {
      return;
    }

    queueMicrotask(() => {
      void persistDraftPatch({
        currentStep: 'hostAgreement',
      }).catch(() => undefined);
    });
  }, [router]);

  const submitAgreement = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await customerOnboardingAdapter.submitHostAgreement({
        accepted,
      });
      const route = completeHostApplicationNavigation({
        currentStep: 'hostAgreement',
        hostAgreementAcceptedAtIso: result.acceptedAtIso,
        hostApplicationSubmittedAtIso: result.submittedAtIso,
      });
      await saveAuthSnapshot();
      router.replace(route);
    } catch (error: unknown) {
      setSubmitError(normalizeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      bottomAction={
        <View style={styles.agreementBottomActions}>
          <Checkbox
            checked={accepted}
            label="I have read and accept the Host Agreement."
            onPress={() => {
              setAccepted((current) => !current);
              setSubmitError(null);
            }}
            testID="onboarding-host-agreement-checkbox"
          />
          <Button
            disabled={!accepted}
            loading={submitting}
            onPress={() => {
              void submitAgreement();
            }}
            testID="onboarding-submit-host-agreement"
            title="Accept & Submit Application"
          />
        </View>
      }
      step="hostAgreement"
    >
      <GlassSurface
        borderColor="rgba(255,255,255,0.96)"
        overlayColor="rgba(255,255,255,0.84)"
        style={styles.introCard}
        variant="strong"
      >
        <Text style={styles.bodyText}>
          Review these commitments before submitting the host application.
        </Text>
      </GlassSurface>
      {submitError === null ? null : (
        <Banner
          message={submitError}
          title="Could not submit agreement"
          tone="error"
        />
      )}
      <Card style={styles.agreementCard} variant="strong">
        <View style={styles.agreementHeader}>
          <View style={styles.permissionIcon}>
            <FileText color={ui.color.brand.primary} size={22} />
          </View>
          <Text style={styles.agreementTitle}>Host Agreement</Text>
        </View>
        <AgreementPoint
          body="Keep conversations respectful, legal, and within Connecto safety rules."
          title="Community conduct"
        />
        <AgreementPoint
          body="Use your own verified voice and do not share account access with another person."
          title="Verified identity"
        />
        <AgreementPoint
          body="Follow moderation, support, and payout review decisions from the backend team."
          title="Platform review"
        />
        <AgreementPoint
          body="Protect customer privacy and report unsafe behavior through the app."
          title="Privacy and safety"
        />
      </Card>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  agreementBottomActions: {
    gap: ui.spacing[3],
  },
  agreementCard: {
    gap: ui.spacing[4],
  },
  agreementHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  agreementPoint: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  agreementPointIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  agreementTitle: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  approvalBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  approvalCard: {
    alignItems: 'center',
    gap: ui.spacing[4],
  },
  approvalIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  approvalTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  bodyText: {
    color: ui.color.text.secondary,
    flexShrink: 1,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    width: '100%',
  },
  bottomActions: {
    gap: ui.spacing[3],
  },
  brandChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ui.color.background.surface,
    borderColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: ui.spacing[2],
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[2],
  },
  brandChipCompact: {
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[2],
  },
  brandIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  brandText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    minWidth: 68,
  },
  contentCard: {
    gap: ui.spacing[6],
  },
  contentCardCompact: {
    gap: ui.spacing[4],
  },
  headerBlock: {
    gap: ui.spacing[3],
  },
  headerBlockCompact: {
    gap: ui.spacing[3],
  },
  imageCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  imageEmptyCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  imageEmptyIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  imagePreview: {
    backgroundColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.lg,
    height: 88,
    width: 88,
  },
  imagePreviewCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  introCard: {
    gap: ui.spacing[2],
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  languageChip: {
    alignSelf: 'flex-start',
    borderRadius: ui.radii.full,
    minHeight: ui.minTouch,
  },
  languageChipAnimated: {
    alignItems: 'center',
    backgroundColor: ui.color.background.surface,
    borderColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: ui.minTouch,
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[3],
  },
  languageChipAnimatedSelected: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.brand.primary,
  },
  languageChipPressed: {
    opacity: ui.opacity.pressed,
  },
  languageChipSelected: {},
  languageChipText: {
    color: ui.color.text.primary,
    flexShrink: 1,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  languageChipTextSelected: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
  },
  languageChipWrap: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  matchTagChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ui.glass.surfaceFloating,
    borderColor: ui.glass.borderSubtle,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    flexGrow: 0,
    flexDirection: 'row',
    flexShrink: 0,
    gap: ui.spacing[1],
    maxWidth: '100%',
    minHeight: 40,
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[1],
  },
  matchTagChipIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  matchTagChipPressed: {
    opacity: ui.opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  matchTagChipSelected: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.brand.primary,
  },
  matchTagChipText: {
    color: ui.color.text.primary,
    flexShrink: 0,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    textAlign: 'center',
  },
  matchTagChipTextSelected: {
    color: ui.color.brand.primary,
  },
  matchTagGrid: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: ui.spacing[2],
    rowGap: ui.spacing[2],
  },
  matchTagEmptySummaryText: {
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  matchTagsIntroCard: {
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[4],
  },
  matchTagsIntroText: {
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  matchTagScreenContent: {
    paddingTop: ui.spacing[4],
  },
  matchTagSection: {
    gap: ui.spacing[2],
  },
  matchTagSectionTitle: {
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  matchTagSummaryCard: {
    gap: ui.spacing[3],
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[4],
  },
  matchTagSummaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[2],
    justifyContent: 'space-between',
  },
  matchTagSummaryLabel: {
    flex: 1,
  },
  matchTagCountBadge: {
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: ui.radii.full,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 70,
    paddingHorizontal: ui.spacing[2],
  },
  matchTagCountBadgeEmpty: {
    backgroundColor: ui.color.status.warningSoft,
  },
  matchTagCountBadgeSelected: {
    backgroundColor: ui.color.status.successSoft,
  },
  matchTagCountText: {
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    minWidth: 32,
    textAlign: 'center',
  },
  matchTagCountTextEmpty: {
    color: ui.color.status.warning,
  },
  matchTagCountTextSelected: {
    color: ui.color.status.success,
  },
  optionStack: {
    gap: ui.spacing[3],
  },
  permissionBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  permissionCallout: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  permissionCard: {
    gap: ui.spacing[4],
  },
  permissionCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  permissionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  permissionIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  permissionTitle: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  previewLabel: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'uppercase',
  },
  progressFill: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transformOrigin: 'left',
  },
  progressTrack: {
    backgroundColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  reviewStep: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  reviewStepsCard: {
    gap: ui.spacing[4],
  },
  screenContent: {
    gap: ui.spacing[6],
    justifyContent: 'center',
    paddingBottom: ui.spacing[8],
  },
  screenContentCompact: {
    gap: ui.spacing[4],
    justifyContent: 'flex-start',
    paddingBottom: ui.spacing[2],
  },
  screenTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  screenTitleCompact: {
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
  },
  section: {
    gap: ui.spacing[3],
  },
  sectionBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  sectionTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  selectedSummaryCard: {
    gap: ui.spacing[3],
  },
  selectedSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  selectedMatchTagChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ui.color.status.infoSoft,
    borderRadius: ui.radii.full,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[1],
  },
  selectedMatchTagChipText: {
    color: ui.color.status.info,
    flexShrink: 0,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    textAlign: 'center',
  },
  stepEyebrow: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'uppercase',
  },
  voiceIntroCard: {
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[3],
  },
  voiceRecorderBlock: {
    alignItems: 'center',
    gap: ui.spacing[3],
    justifyContent: 'center',
    paddingVertical: ui.spacing[4],
  },
  voiceRecordButton: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primary,
    borderColor: 'rgba(255,255,255,0.74)',
    borderRadius: ui.radii.full,
    borderWidth: 3,
    height: 128,
    justifyContent: 'center',
    width: 128,
    ...ui.shadow.button,
  },
  voiceRecordButtonActive: {
    backgroundColor: ui.color.status.error,
  },
  voiceRecordButtonPressed: {
    opacity: ui.opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  voiceRecordHelper: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
  voiceRecordTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
  voiceSentence: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'left',
  },
  voiceSentenceCard: {
    gap: ui.spacing[3],
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[4],
  },
});
