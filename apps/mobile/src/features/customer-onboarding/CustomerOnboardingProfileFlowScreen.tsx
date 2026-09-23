import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';

import { normalizeApiError } from '@connecto/domain';

import {
  defaultCustomerAvatarUriForGender,
  getCustomerAvatarOptionsForGender,
  normalizeCustomerAvatarUri,
  resolveCustomerAvatar,
} from '@/assets/avatars/customer-avatars';
import genderReferenceImage from '@/assets/reference-onboarding/gender-reference.jpeg';
import { KeyboardScreen, Screen } from '@/components/layout';
import { GlassSurface } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { appRoutes } from '@/navigation/routes';
import { useHaptics } from '@/motion/MotionProvider';
import {
  getAuthSnapshot,
  updateCustomerOnboardingDraft,
  useAuthStore,
  type CustomerGender,
  type CustomerOnboardingImageDraft,
} from '@/store/auth.store';

import { persistAuthSnapshot } from '../auth/auth.storage';

import { customerOnboardingAdapter } from './customer-onboarding.adapters';

type FlowStep = 'avatar' | 'birthYear' | 'gender' | 'name';

const yearItemHeight = 44;
const yearWheelVisibleItems = 5;
const yearWheelHeight = yearItemHeight * yearWheelVisibleItems;
const yearWheelCenterInset = (yearItemHeight * (yearWheelVisibleItems - 1)) / 2;
const yearOptions = Array.from(
  { length: new Date().getFullYear() - 1950 + 1 },
  (_, index) => 1950 + index,
);

const persistDraft = async (
  patch: Parameters<typeof updateCustomerOnboardingDraft>[0],
) => {
  updateCustomerOnboardingDraft(patch);
  await persistAuthSnapshot(getAuthSnapshot());
};

const initialStepForDraft = (
  draft: ReturnType<typeof useAuthStore.getState>['customerOnboarding'],
): FlowStep => {
  if (draft.gender === null) {
    return 'gender';
  }

  if (draft.displayName.trim().length === 0) {
    return 'name';
  }

  if (!/\d{4}$/.test(draft.dateOfBirthInput)) {
    return 'birthYear';
  }

  return 'avatar';
};

const birthYearFromInput = (value: string) => {
  const match = /(\d{4})$/.exec(value);
  return match === null ? 1989 : Number.parseInt(match[1] ?? '1989', 10);
};

const yearWheelIndexFromOffset = (offsetY: number) =>
  Math.max(
    0,
    Math.min(yearOptions.length - 1, Math.round(offsetY / yearItemHeight)),
  );

function ReferenceCropImage({
  borderRadius = 0,
  crop,
  height,
  source,
  sourceHeight = 1600,
  sourceWidth = 722,
  width,
}: {
  borderRadius?: number;
  crop: { height: number; width: number; x: number; y: number };
  height: number;
  source: ImageSourcePropType;
  sourceHeight?: number;
  sourceWidth?: number;
  width: number;
}) {
  const scale = width / crop.width;

  return (
    <View style={[styles.crop, { borderRadius, height, width }]}>
      <Image
        accessibilityIgnoresInvertColors
        source={source}
        style={{
          height: sourceHeight * scale,
          left: -crop.x * scale,
          position: 'absolute',
          top: -crop.y * scale,
          width: sourceWidth * scale,
        }}
      />
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      hitSlop={ui.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.backButton,
        pressed ? styles.pressed : null,
      ]}
    >
      <ChevronLeft color={ui.color.text.primary} size={30} strokeWidth={2.5} />
    </Pressable>
  );
}

function FlowButton({
  disabled = false,
  loading = false,
  onPress,
  title,
}: {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.flowButton, disabled ? styles.flowButtonDisabled : null]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={styles.flowButtonText}
      >
        {loading ? 'Saving...' : title}
      </Text>
    </Pressable>
  );
}

function Heading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={styles.heading}>
      {eyebrow === undefined ? null : (
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      )}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

export function CustomerOnboardingProfileFlowScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const onboarding = useAuthStore((state) => state.customerOnboarding);
  const initialGender =
    onboarding.gender === 'woman' || onboarding.gender === 'man'
      ? onboarding.gender
      : 'man';
  const [step, setStep] = useState<FlowStep>(() =>
    initialStepForDraft(onboarding),
  );
  const [gender, setGender] = useState<CustomerGender | null>(initialGender);
  const [displayName, setDisplayName] = useState(onboarding.displayName);
  const [birthYear, setBirthYear] = useState(
    birthYearFromInput(onboarding.dateOfBirthInput),
  );
  const [selectedAvatarUri, setSelectedAvatarUri] = useState(
    normalizeCustomerAvatarUri(
      onboarding.profileImage?.localUri,
      initialGender,
    ) ?? defaultCustomerAvatarUriForGender(initialGender),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const yearWheelRef = useRef<ScrollView>(null);
  const selectedYearIndex = useMemo(
    () => Math.max(0, yearOptions.indexOf(birthYear)),
    [birthYear],
  );
  const selectedYearWheelIndexRef = useRef(selectedYearIndex);

  const selectYearWheelIndex = useCallback(
    (nextIndex: number, withFeedback: boolean) => {
      const nextYear = yearOptions[nextIndex];

      if (
        nextYear === undefined ||
        nextIndex === selectedYearWheelIndexRef.current
      ) {
        return;
      }

      selectedYearWheelIndexRef.current = nextIndex;
      setBirthYear(nextYear);

      if (withFeedback) {
        haptics.selection();
      }
    },
    [haptics],
  );

  const updateBirthYearFromWheel = useCallback(
    (offsetY: number, withFeedback: boolean) => {
      selectYearWheelIndex(yearWheelIndexFromOffset(offsetY), withFeedback);
    },
    [selectYearWheelIndex],
  );

  const settleBirthYearWheel = useCallback(
    (offsetY: number) => {
      const nextIndex = yearWheelIndexFromOffset(offsetY);

      selectYearWheelIndex(nextIndex, false);
      yearWheelRef.current?.scrollTo({
        animated: true,
        y: nextIndex * yearItemHeight,
      });
    },
    [selectYearWheelIndex],
  );

  const selectBirthYearFromTap = useCallback(
    (year: number) => {
      const nextIndex = yearOptions.indexOf(year);

      if (nextIndex < 0) {
        return;
      }

      selectYearWheelIndex(nextIndex, true);
      yearWheelRef.current?.scrollTo({
        animated: false,
        y: nextIndex * yearItemHeight,
      });
    },
    [selectYearWheelIndex],
  );

  const goBack = () => {
    setError(null);

    if (step === 'name') {
      setStep('gender');
    } else if (step === 'birthYear') {
      setStep('name');
    } else if (step === 'avatar') {
      setStep('birthYear');
    } else {
      router.replace(appRoutes.customerOnboardingLanguage.path);
    }
  };

  const continueFromGender = async () => {
    if (gender === null) {
      return;
    }

    await persistDraft({ currentStep: 'profile', gender });
    setStep('name');
  };

  const selectGender = (
    nextGender: Extract<CustomerGender, 'man' | 'woman'>,
  ) => {
    setGender(nextGender);
    setSelectedAvatarUri(defaultCustomerAvatarUriForGender(nextGender));
  };

  const continueFromName = async () => {
    const normalizedName = displayName.trim();

    if (normalizedName.length < 2) {
      setError('Enter your nickname.');
      return;
    }

    await persistDraft({
      currentStep: 'profile',
      displayName: normalizedName,
    });
    setError(null);
    setStep('birthYear');
  };

  const continueFromBirthYear = async () => {
    await persistDraft({
      currentStep: 'profile',
      dateOfBirthInput: `01/01/${String(birthYear)}`,
    });
    setStep('avatar');
  };

  const finishProfile = async () => {
    const selectedAvatar = resolveCustomerAvatar(selectedAvatarUri, gender);

    if (gender === null || selectedAvatar === undefined) {
      setError('Select an avatar.');
      return;
    }

    const profileImage: CustomerOnboardingImageDraft = {
      cropLabel: selectedAvatar.label,
      localUri: selectedAvatar.uri,
      previewUri: selectedAvatar.uri,
      sourceName: selectedAvatar.id,
    };

    setError(null);

    try {
      const dateOfBirthInput = `01/01/${String(birthYear)}`;
      const normalizedName = displayName.trim();

      setSaving(true);
      await persistDraft({
        currentStep: 'language',
        dateOfBirthInput,
        displayName: normalizedName,
        gender,
        profileImage,
      });
      router.replace(appRoutes.customerOnboardingLanguage.path);

      void customerOnboardingAdapter
        .saveProfile({
          dateOfBirthInput,
          displayName: normalizedName,
          gender,
          profileImage,
        })
        .then((result) =>
          persistDraft({
            currentStep: 'language',
            dateOfBirthInput: result.dateOfBirthInput,
            displayName: result.displayName,
            gender: result.gender,
            profileImage: result.profileImage,
          }),
        )
        .catch(() => undefined);
    } catch (caught: unknown) {
      setError(normalizeApiError(caught).message);
      setSaving(false);
    }
  };

  if (step === 'gender') {
    return (
      <Screen contentStyle={styles.genderScreen}>
        <Heading eyebrow="Your" title="Gender" />
        <View style={styles.genderStack}>
          <GlassSurface
            borderColor={gender === 'man' ? ui.color.brand.primary : undefined}
            contentStyle={styles.genderGlassContent}
            overlayColor={
              gender === 'man' ? 'rgba(201,54,116,0.12)' : undefined
            }
            radius={18}
            shadow="soft"
            style={styles.genderOptionSurface}
            variant="standard"
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: gender === 'man' }}
              onPress={() => {
                selectGender('man');
              }}
              style={styles.genderCard}
            >
              {gender === 'man' ? (
                <View style={styles.checkBubble}>
                  <Check color={ui.color.text.inverse} size={20} />
                </View>
              ) : null}
              <ReferenceCropImage
                borderRadius={130}
                crop={{ height: 320, width: 320, x: 202, y: 371 }}
                height={124}
                source={genderReferenceImage}
                width={124}
              />
              <Text style={styles.genderLabel}>Male</Text>
            </Pressable>
          </GlassSurface>
          <GlassSurface
            borderColor={
              gender === 'woman' ? ui.color.brand.primary : undefined
            }
            contentStyle={styles.genderGlassContent}
            overlayColor={
              gender === 'woman' ? 'rgba(201,54,116,0.12)' : undefined
            }
            radius={18}
            shadow="soft"
            style={styles.genderOptionSurface}
            variant="standard"
          >
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: gender === 'woman' }}
              onPress={() => {
                selectGender('woman');
              }}
              style={styles.genderCard}
            >
              {gender === 'woman' ? (
                <View style={styles.checkBubble}>
                  <Check color={ui.color.text.inverse} size={20} />
                </View>
              ) : null}
              <ReferenceCropImage
                borderRadius={130}
                crop={{ height: 320, width: 320, x: 202, y: 829 }}
                height={124}
                source={genderReferenceImage}
                width={124}
              />
              <Text style={styles.genderLabel}>Female</Text>
              <Text style={styles.genderHint}>(Audio verification needed)</Text>
            </Pressable>
          </GlassSurface>
        </View>
        <Text style={styles.genderFootnote}>
          Gender cannot be changed later.
        </Text>
        <View style={styles.genderAction}>
          <GlassSurface style={styles.actionSurface} variant="floating">
            <FlowButton
              disabled={gender === null}
              onPress={() => {
                void continueFromGender();
              }}
              title="Proceed"
            />
          </GlassSurface>
        </View>
      </Screen>
    );
  }

  if (step === 'name') {
    return (
      <KeyboardScreen
        bottomAction={
          <FlowButton
            disabled={displayName.trim().length < 2}
            onPress={() => {
              void continueFromName();
            }}
            title="Next"
          />
        }
        contentStyle={styles.stepScreen}
      >
        <BackButton onPress={goBack} />
        <Heading eyebrow="What is your" title="Nickname?" />
        <GlassSurface
          borderColor={
            error === null ? 'rgba(201,54,116,0.48)' : ui.color.status.error
          }
          contentStyle={styles.inputGlassContent}
          overlayColor="rgba(255,255,255,0.9)"
          radius={10}
          shadow="soft"
          variant="strong"
        >
          <TextInput
            accessibilityLabel="Enter your Nickname"
            autoCapitalize="words"
            onChangeText={(value) => {
              setDisplayName(value);
              setError(null);
            }}
            placeholder="Enter your Nickname"
            placeholderTextColor="#8b7d86"
            style={styles.textInput}
            value={displayName}
          />
        </GlassSurface>
        <View style={styles.errorReserve}>
          {error === null ? null : (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>
      </KeyboardScreen>
    );
  }

  if (step === 'birthYear') {
    return (
      <KeyboardScreen
        bottomAction={
          <FlowButton
            onPress={() => {
              void continueFromBirthYear();
            }}
            title="Next"
          />
        }
        contentStyle={styles.stepScreen}
      >
        <BackButton onPress={goBack} />
        <Heading eyebrow="When is your" title="Birth Year?" />
        <GlassSurface
          contentStyle={styles.yearPicker}
          radius={10}
          shadow="soft"
          variant="strong"
        >
          <View pointerEvents="none" style={styles.yearSelectionBand} />
          <ScrollView
            contentContainerStyle={styles.yearWheelContent}
            contentOffset={{ x: 0, y: selectedYearIndex * yearItemHeight }}
            decelerationRate="fast"
            nestedScrollEnabled
            onMomentumScrollEnd={(event) => {
              settleBirthYearWheel(event.nativeEvent.contentOffset.y);
            }}
            onScroll={(event) => {
              updateBirthYearFromWheel(event.nativeEvent.contentOffset.y, true);
            }}
            onScrollEndDrag={(event) => {
              if (event.nativeEvent.velocity?.y === 0) {
                settleBirthYearWheel(event.nativeEvent.contentOffset.y);
              }
            }}
            ref={yearWheelRef}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={yearItemHeight}
            style={styles.yearWheel}
          >
            {yearOptions.map((year) => (
              <Pressable
                accessibilityRole="button"
                key={year}
                onPress={() => {
                  selectBirthYearFromTap(year);
                }}
                style={styles.yearItem}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[
                    styles.yearText,
                    year === birthYear ? styles.yearTextSelected : null,
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </GlassSurface>
      </KeyboardScreen>
    );
  }

  return (
    <Screen contentStyle={styles.avatarScreen}>
      <BackButton onPress={goBack} />
      <View style={styles.avatarHeader}>
        <Text style={styles.avatarTitle}>Select your Avatar</Text>
        <Text style={styles.avatarSubtitle}>
          This will be displayed as your profile during calls.
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.avatarGrid}
        showsVerticalScrollIndicator={false}
        style={styles.avatarGridScroll}
      >
        {getCustomerAvatarOptionsForGender(gender).map((option) => {
          const selected = selectedAvatarUri === option.uri;

          return (
            <Pressable
              accessibilityLabel={`Use ${option.label} avatar`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.uri}
              onPress={() => {
                setSelectedAvatarUri(option.uri);
                setError(null);
              }}
              style={styles.avatarOption}
              testID={`onboarding-avatar-${option.gender}-${option.id}`}
            >
              <Image
                accessibilityIgnoresInvertColors
                source={option.source}
                style={styles.avatarOptionImage}
              />
              {selected ? (
                <View style={styles.avatarSelectedRing}>
                  <Check color={ui.color.text.inverse} size={20} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {error === null ? null : <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.avatarAction}>
        <GlassSurface style={styles.actionSurface} variant="floating">
          <FlowButton
            disabled={
              resolveCustomerAvatar(selectedAvatarUri, gender) === undefined
            }
            loading={saving}
            onPress={() => {
              void finishProfile();
            }}
            title="Proceed"
          />
        </GlassSurface>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionSurface: {
    padding: 10,
  },
  avatarAction: {
    marginTop: 'auto',
    paddingBottom: 8,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingBottom: 18,
    rowGap: 24,
  },
  avatarHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  avatarGridScroll: {
    flex: 1,
  },
  avatarOption: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 116,
    width: '33.33%',
  },
  avatarOptionImage: {
    borderRadius: 58,
    height: 116,
    width: 116,
  },
  avatarScreen: {
    flex: 1,
    gap: 0,
    paddingTop: 18,
  },
  avatarSelectedRing: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primary,
    borderColor: ui.color.background.surface,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: -4,
    width: 36,
  },
  avatarSubtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  avatarTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 23,
    lineHeight: 30,
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 48,
    justifyContent: 'center',
    marginBottom: 16,
    width: 48,
  },
  checkBubble: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primary,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 14,
    width: 36,
    zIndex: 2,
  },
  crop: {
    overflow: 'hidden',
  },
  errorText: {
    color: ui.color.status.error,
    fontFamily: ui.font.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  errorReserve: {
    minHeight: 20,
  },
  eyebrow: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: 20,
    lineHeight: 28,
  },
  flowButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: ui.color.brand.primary,
    borderRadius: 30,
    height: 62,
    justifyContent: 'center',
    width: '100%',
  },
  flowButtonDisabled: {
    backgroundColor: 'rgba(201,54,116,0.24)',
  },
  flowButtonText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 21,
    includeFontPadding: false,
    lineHeight: 28,
    paddingHorizontal: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    width: '100%',
  },
  genderAction: {
    marginTop: 'auto',
    paddingBottom: 8,
  },
  genderCard: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    minHeight: 190,
    padding: 12,
    position: 'relative',
    width: '100%',
  },
  genderGlassContent: {
    flex: 1,
    padding: 0,
  },
  genderOptionSurface: {
    alignSelf: 'stretch',
    minHeight: 190,
  },
  genderFootnote: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 18,
    textAlign: 'center',
  },
  genderHint: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'center',
  },
  genderLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.regular,
    fontSize: 20,
    lineHeight: 26,
    marginTop: 8,
    textAlign: 'center',
  },
  genderScreen: {
    flex: 1,
    gap: 0,
    paddingBottom: 18,
    paddingTop: 40,
  },
  genderStack: {
    gap: 10,
    marginTop: 14,
  },
  heading: {
    gap: 4,
  },
  pressed: {
    opacity: ui.opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  stepScreen: {
    gap: 24,
    paddingTop: 38,
  },
  textInput: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 0,
    color: ui.color.text.primary,
    fontFamily: ui.font.regular,
    fontSize: 18,
    height: 62,
    paddingHorizontal: 18,
  },
  title: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 36,
    lineHeight: 44,
  },
  yearPicker: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 10,
    height: yearWheelHeight,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    padding: 0,
  },
  inputGlassContent: {
    padding: 0,
  },
  yearItem: {
    alignItems: 'center',
    height: yearItemHeight,
    justifyContent: 'center',
    width: '100%',
  },
  yearSelectionBand: {
    backgroundColor: 'rgba(201,54,116,0.04)',
    borderBottomColor: 'rgba(209, 20, 60, 0.16)',
    borderBottomWidth: 1,
    borderTopColor: 'rgba(209, 20, 60, 0.16)',
    borderTopWidth: 1,
    height: yearItemHeight,
    left: 14,
    position: 'absolute',
    right: 14,
    top: yearWheelCenterInset,
  },
  yearText: {
    color: '#b8b8b8',
    fontFamily: ui.font.regular,
    fontSize: 21,
    includeFontPadding: false,
    lineHeight: 28,
    minWidth: 96,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  yearTextSelected: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 26,
    lineHeight: 34,
  },
  yearWheel: {
    height: yearWheelHeight,
    width: '100%',
  },
  yearWheelContent: {
    paddingVertical: yearWheelCenterInset,
  },
});
