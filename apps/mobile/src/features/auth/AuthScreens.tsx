import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gift, ShieldAlert, Sparkles } from 'lucide-react-native';
import * as Linking from 'expo-linking';

import { normalizeApiError } from '@connecto/domain';

import loginReferenceImage from '@/assets/reference-onboarding/login-reference.jpeg';
import { KeyboardScreen, Screen } from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Banner, InlineError } from '@/components/ui/feedback';
import { OTPInput, TextField } from '@/components/ui/fields';
import { BackHeader } from '@/components/ui/navigation';
import { Card, ErrorState, GlassSurface } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { mobileRuntimeConfig } from '@/config/runtime';
import {
  clearNavigationSession,
  completeAccountStatus,
  completeAuthSession,
  hydrateNavigationAuth,
  resolveDefaultRoute,
} from '@/navigation/navigation-store';
import { appRoutes } from '@/navigation/routes';
import { useHaptics, useReducedMotionEnabled } from '@/motion/MotionProvider';
import {
  getAuthSnapshot,
  hydrateAuthStore,
  resetAuthStore,
} from '@/store/auth.store';

import {
  buildPhoneNumberFromDraft,
  customerAuthAdapter,
  isSamvadAuthEnabled,
  restoreSamvadAuthSession,
} from './auth.adapters';
import { useAuthFlowStore } from './auth-flow.store';
import {
  getNextInvalidAttemptCount,
  getOtpResendRemainingSeconds,
  normalizePhoneDigits,
  otpMaxInvalidAttempts,
  parseAuthRuntimeConfig,
} from './auth.models';
import {
  clearPersistedAuthSnapshot,
  loadPersistedAuthSnapshot,
  persistAuthSnapshot,
} from './auth.storage';
import { clearSamvadTokens, saveSamvadTokens } from './samvad-session.storage';
import { requestGooglePhoneNumberHint } from './phone-number-hint';

const authRuntimeConfig = parseAuthRuntimeConfig(process.env);
const loginHeroWidth = 320;
const readCurrentTimeMs = () => Date.now();
const formatGooglePhoneHintError = (message: string) =>
  /no phone number|28438/i.test(message)
    ? 'No Google phone number is available on this device. Enter your number manually.'
    : message;
const loginHeroSlides = [
  {
    caption: 'Your Avatar is your identity',
    crop: { height: 350, width: 590, x: 65, y: 526 },
    id: 'avatar-identity',
    source: loginReferenceImage,
  },
  {
    caption: 'Find your best conversation match',
    crop: { height: 350, width: 590, x: 65, y: 526 },
    id: 'avatar-identity-alt',
    source: loginReferenceImage,
  },
].slice(0, 2);

const authCopy = {
  blocked: {
    body: 'Access to this account has been restricted. Support can review the block status from your last sign-in attempt.',
    cta: 'Go to login',
    title: 'Account blocked',
  },
  suspended: {
    body: 'Your account is suspended while we review recent activity. Support can help you understand what happens next.',
    cta: 'Go to login',
    title: 'Account suspended',
  },
  underage: {
    body: 'You must be at least 18 years old to use Connecto. If this is incorrect, contact support before trying again.',
    cta: 'Back to start',
    title: '18+ required',
  },
} as const;

const routeFromSnapshot = (snapshot: ReturnType<typeof getAuthSnapshot>) => {
  hydrateNavigationAuth(snapshot);
  return resolveDefaultRoute(snapshot);
};

const useEntranceAnimation = () => {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const [logo] = useState(
    () => new Animated.Value(reducedMotionEnabled ? 1 : 0),
  );
  const [form] = useState(
    () => new Animated.Value(reducedMotionEnabled ? 1 : 0),
  );

  useEffect(() => {
    if (reducedMotionEnabled) {
      return;
    }

    Animated.parallel([
      Animated.timing(logo, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(form, {
        delay: 80,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [form, logo, reducedMotionEnabled]);

  return {
    formStyle: {
      opacity: form,
      transform: [
        {
          translateY: form.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          }),
        },
      ],
    },
    logoStyle: {
      opacity: logo,
      transform: [
        {
          scale: logo.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          }),
        },
      ],
    },
  };
};

const useShake = (triggerKey: number) => {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const [animated] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotionEnabled || triggerKey === 0) {
      animated.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(animated, {
        duration: 55,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(animated, {
        duration: 55,
        toValue: -1,
        useNativeDriver: true,
      }),
      Animated.timing(animated, {
        duration: 55,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animated, reducedMotionEnabled, triggerKey]);

  return {
    transform: [
      {
        translateX: animated.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-8, 0, 8],
        }),
      },
    ],
  };
};

const useKeyboardVisible = () => {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardVisible;
};

const BrandMark = ({
  compact = false,
  subtitle,
}: {
  compact?: boolean;
  subtitle?: string;
}) => {
  const { logoStyle } = useEntranceAnimation();

  return (
    <Animated.View
      style={[
        styles.brandWrap,
        compact ? styles.brandWrapCompact : null,
        logoStyle,
      ]}
    >
      <View
        accessibilityLabel="Connecto brand pulse"
        accessibilityRole="image"
        style={[
          styles.brandLottie,
          styles.brandPulseFallback,
          compact ? styles.brandLottieCompact : null,
        ]}
      />
      <View
        style={[styles.brandSeal, compact ? styles.brandSealCompact : null]}
      >
        <Sparkles
          color={ui.color.brand.primary}
          size={compact ? 22 : 28}
          strokeWidth={2.2}
        />
      </View>
      <Text
        style={[styles.brandName, compact ? styles.brandNameCompact : null]}
      >
        Connecto
      </Text>
      {subtitle === undefined ? null : (
        <Text
          style={[
            styles.brandSubtitle,
            compact ? styles.brandSubtitleCompact : null,
          ]}
        >
          {subtitle}
        </Text>
      )}
    </Animated.View>
  );
};

function CompactConnectoLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Text
      accessibilityLabel="Connecto logo"
      style={[
        styles.loginWordmark,
        compact ? styles.loginWordmarkCompact : null,
      ]}
    >
      <Text style={styles.loginWordmarkStart}>Connecto</Text>
      <Text style={styles.loginWordmarkBang}>!</Text>
    </Text>
  );
}

const FieldMessage = ({
  message,
  tone = 'neutral',
}: {
  message: string | null;
  tone?: 'neutral' | 'positive';
}) =>
  message === null ? null : (
    <Text
      style={[
        styles.fieldMessage,
        tone === 'positive' ? styles.fieldMessagePositive : null,
      ]}
    >
      {message}
    </Text>
  );

function ReferenceCropImage({
  borderRadius = 0,
  crop,
  height,
  source,
  sourceHeight,
  sourceWidth,
  width,
}: {
  borderRadius?: number;
  crop: { height: number; width: number; x: number; y: number };
  height: number;
  source: ImageSourcePropType;
  sourceHeight: number;
  sourceWidth: number;
  width: number;
}) {
  const scale = width / crop.width;

  return (
    <View
      style={[
        styles.referenceCrop,
        {
          borderRadius,
          height,
          width,
        },
      ]}
    >
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

const AuthScaffold = ({
  bottomAction,
  brandCompact = false,
  children,
  contentStyle,
  formCardStyle,
  onBack,
  title,
}: {
  bottomAction?: React.ReactNode;
  brandCompact?: boolean;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  formCardStyle?: StyleProp<ViewStyle>;
  onBack?: () => void;
  title: string;
}) => {
  const { formStyle } = useEntranceAnimation();

  return (
    <KeyboardScreen
      bottomAction={bottomAction}
      contentStyle={[styles.keyboardContent, contentStyle]}
    >
      {onBack === undefined ? (
        <BrandMark compact={brandCompact} subtitle={title} />
      ) : (
        <BackHeader onPress={onBack} title={title} />
      )}
      <Animated.View style={formStyle}>
        <GlassSurface
          borderColor="rgba(255,255,255,0.96)"
          overlayColor="rgba(255,255,255,0.86)"
          style={[styles.formCard, formCardStyle]}
          variant="strong"
        >
          {children}
        </GlassSurface>
      </Animated.View>
    </KeyboardScreen>
  );
};

export function BootstrapScreen() {
  const router = useRouter();
  const [state, setState] = useState<
    { kind: 'error'; message: string } | { kind: 'loading' } | { kind: 'ready' }
  >({ kind: 'loading' });

  const performBootstrap = useCallback(() => {
    loadPersistedAuthSnapshot()
      .then(async (persistedSnapshot) => {
        let snapshot = persistedSnapshot;

        if (
          isSamvadAuthEnabled &&
          persistedSnapshot.accountStatus === 'active' &&
          persistedSnapshot.sessionId !== null
        ) {
          const restored = await restoreSamvadAuthSession(persistedSnapshot);

          if (restored === null) {
            snapshot = resetAuthStore();
            await clearPersistedAuthSnapshot();
          } else {
            snapshot = hydrateAuthStore(restored);
            await persistAuthSnapshot(snapshot);
          }
        }

        const route = authRuntimeConfig.mandatoryUpdateRequired
          ? '/mandatory-update'
          : routeFromSnapshot(snapshot);

        setState({ kind: 'ready' });
        router.replace(route);
      })
      .catch((error: unknown) => {
        const normalized = normalizeApiError(error);
        setState({ kind: 'error', message: normalized.message });
      });
  }, [router]);

  const runBootstrap = () => {
    setState({ kind: 'loading' });
    queueMicrotask(() => {
      performBootstrap();
    });
  };

  useEffect(() => {
    performBootstrap();
  }, [performBootstrap]);

  return (
    <Screen contentStyle={styles.centeredScreen}>
      <BrandMark subtitle="Starting your account flow" />
      {state.kind === 'loading' ? (
        <Text style={styles.bootstrapMessage}>
          Restoring your session and checking entry requirements.
        </Text>
      ) : null}
      {state.kind === 'error' ? (
        <ErrorState
          message={state.message}
          onRetry={runBootstrap}
          title="We could not start the app"
        />
      ) : null}
    </Screen>
  );
}

export function MandatoryUpdateScreen() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateDestination =
    Platform.OS === 'android'
      ? mobileRuntimeConfig.androidUpdateUrl
      : Platform.OS === 'ios'
        ? mobileRuntimeConfig.iosUpdateUrl
        : (mobileRuntimeConfig.androidUpdateUrl ??
          mobileRuntimeConfig.iosUpdateUrl);

  const openUpdateDestination = async () => {
    if (updateDestination === null) {
      return;
    }

    setOpening(true);
    setError(null);

    try {
      await Linking.openURL(updateDestination);
    } catch (error: unknown) {
      setError(normalizeApiError(error).message);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Screen contentStyle={styles.centeredScreen}>
      <BrandMark subtitle="A newer app build is required" />
      <Card style={styles.statusCard}>
        <Text style={styles.statusTitle}>Update required</Text>
        <Text style={styles.statusBody}>
          Install the latest approved build before continuing. This screen uses
          the platform-specific destination configured in runtime env.
        </Text>
        {updateDestination === null ? (
          <Banner
            message={`No update destination is configured for ${Platform.OS}. Add the store URL to the mobile runtime env before forcing a mandatory update.`}
            title="Update destination missing"
            tone="warning"
          />
        ) : null}
        {error === null ? null : (
          <Banner
            message={error}
            title="Could not open update destination"
            tone="error"
          />
        )}
        <Button
          disabled={updateDestination === null}
          loading={opening}
          onPress={() => {
            void openUpdateDestination();
          }}
          title="Open update"
        />
      </Card>
    </Screen>
  );
}

function AccountStatusScreen({
  status,
}: {
  status: 'blocked' | 'suspended' | 'underage';
}) {
  const router = useRouter();
  const copy = authCopy[status];

  return (
    <Screen contentStyle={styles.centeredScreen}>
      <BrandMark subtitle={copy.title} />
      <Card style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <ShieldAlert color={ui.color.status.warning} size={28} />
        </View>
        <Text style={styles.statusTitle}>{copy.title}</Text>
        <Text style={styles.statusBody}>{copy.body}</Text>
        <Button
          onPress={() => {
            const route =
              status === 'underage'
                ? '/(auth)/login'
                : clearNavigationSession();
            Promise.all([clearPersistedAuthSnapshot(), clearSamvadTokens()])
              .then(() => {
                router.replace(route);
              })
              .catch(() => {
                router.replace(route);
              });
          }}
          title={copy.cta}
        />
      </Card>
    </Screen>
  );
}

export function UnderageBlockScreen() {
  return <AccountStatusScreen status="underage" />;
}

export function SuspendedAccountScreen() {
  return <AccountStatusScreen status="suspended" />;
}

export function BlockedAccountScreen() {
  return <AccountStatusScreen status="blocked" />;
}

export function LoginScreen() {
  const router = useRouter();
  const {
    country,
    nationalNumber,
    referralCode,
    setNationalNumber,
    setReferralValidation,
  } = useAuthFlowStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const keyboardVisible = useKeyboardVisible();
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [phoneHintLoading, setPhoneHintLoading] = useState(false);
  const haptics = useHaptics();
  const shakeStyle = useShake(shakeKey);

  const normalizedNationalNumber = normalizePhoneDigits(nationalNumber);
  const phoneError =
    normalizedNationalNumber.length === 0
      ? 'Enter your mobile number.'
      : normalizedNationalNumber.length !== country.nationalNumberLength
        ? `Use a ${String(country.nationalNumberLength)} digit number for ${country.displayName}.`
        : null;
  const isPhoneReady = phoneError === null;
  const heroHeight = keyboardVisible ? 108 : 168;

  const updateHeroIndex = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / loginHeroWidth,
    );
    setActiveHeroIndex(Math.min(loginHeroSlides.length - 1, nextIndex));
  };

  const validateNationalNumber = (candidate: string) => {
    const normalizedCandidate = normalizePhoneDigits(candidate);

    if (normalizedCandidate.length === 0) {
      return 'Enter your mobile number.';
    }

    if (normalizedCandidate.length !== country.nationalNumberLength) {
      return `Use a ${String(country.nationalNumberLength)} digit number for ${country.displayName}.`;
    }

    return null;
  };

  const nationalNumberFromHint = (phoneNumber: string) => {
    const digits = normalizePhoneDigits(phoneNumber);

    if (digits.length <= country.nationalNumberLength) {
      return digits;
    }

    return digits.slice(-country.nationalNumberLength);
  };

  const requestOtp = async (
    nationalNumberOverride = normalizedNationalNumber,
  ) => {
    const normalizedOverride = normalizePhoneDigits(nationalNumberOverride);
    const nextPhoneError = validateNationalNumber(normalizedOverride);

    if (nextPhoneError !== null) {
      setError(nextPhoneError);
      setShakeKey((current) => current + 1);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const phoneNumber = buildPhoneNumberFromDraft(
        country,
        normalizedOverride,
      );
      const result = await customerAuthAdapter.requestOtp({
        phoneNumber,
        referralCode: referralCode.length > 0 ? referralCode : null,
      });
      useAuthFlowStore.getState().setPendingOtpChallenge({
        invalidAttempts: 0,
        phoneNumber,
        requestId: result.requestId,
        resendAfterSeconds: result.resendAfterSeconds,
        sentAtMs: readCurrentTimeMs(),
      });
      router.replace('/(auth)/otp');
    } catch (error: unknown) {
      const normalized = normalizeApiError(error);
      setError(normalized.message);
      setShakeKey((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const requestGoogleNumberSignIn = async () => {
    setPhoneHintLoading(true);
    setError(null);

    try {
      const hintedPhoneNumber = await requestGooglePhoneNumberHint();

      if (hintedPhoneNumber === null) {
        return;
      }

      const hintedNationalNumber = nationalNumberFromHint(hintedPhoneNumber);
      setNationalNumber(hintedNationalNumber);
      setReferralValidation(null);
      await requestOtp(hintedNationalNumber);
    } catch (error: unknown) {
      const normalized = normalizeApiError(error);
      setError(formatGooglePhoneHintError(normalized.message));
      setShakeKey((current) => current + 1);
    } finally {
      setPhoneHintLoading(false);
    }
  };

  const renderOtpButton = (compact = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        busy: submitting,
        disabled: !isPhoneReady || phoneHintLoading,
      }}
      disabled={!isPhoneReady || submitting || phoneHintLoading}
      onPress={() => {
        haptics.mediumConfirm();
        void requestOtp();
      }}
      style={[
        styles.loginOtpButton,
        compact ? styles.loginOtpButtonCompact : null,
        isPhoneReady ? styles.loginOtpButtonReady : null,
      ]}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.76}
        numberOfLines={1}
        style={styles.loginOtpButtonText}
      >
        {submitting ? 'Sending...' : 'Get OTP'}
      </Text>
    </Pressable>
  );

  return (
    <KeyboardScreen
      contentStyle={[
        styles.loginReplicaContent,
        keyboardVisible ? styles.loginReplicaContentKeyboard : null,
      ]}
    >
      <View
        style={[
          styles.loginReplicaTop,
          keyboardVisible ? styles.loginReplicaTopKeyboard : null,
        ]}
      >
        <CompactConnectoLogo compact={keyboardVisible} />
      </View>
      <GlassSurface
        contentStyle={[
          styles.loginHeroPanel,
          keyboardVisible ? styles.loginHeroPanelKeyboard : null,
        ]}
        radius={24}
        shadow="soft"
        style={[
          styles.loginReplicaHeroWrap,
          keyboardVisible ? styles.loginReplicaHeroWrapKeyboard : null,
        ]}
        variant="subtle"
      >
        <ScrollView
          horizontal
          onMomentumScrollEnd={updateHeroIndex}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.loginHeroCarousel}
        >
          {loginHeroSlides.map((slide) => (
            <View key={slide.id} style={styles.loginHeroSlide}>
              <ReferenceCropImage
                borderRadius={12}
                crop={slide.crop}
                height={heroHeight}
                source={slide.source}
                sourceHeight={1600}
                sourceWidth={722}
                width={loginHeroWidth}
              />
            </View>
          ))}
        </ScrollView>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[
            styles.loginReplicaCaption,
            keyboardVisible ? styles.loginReplicaCaptionKeyboard : null,
          ]}
        >
          {loginHeroSlides[activeHeroIndex]?.caption ??
            loginHeroSlides[0]?.caption}
        </Text>
        <View
          style={[
            styles.loginReplicaDots,
            keyboardVisible ? styles.loginReplicaDotsKeyboard : null,
          ]}
        >
          {loginHeroSlides.map((slide, index) => (
            <View
              key={`${slide.id}-dot`}
              style={
                index === activeHeroIndex
                  ? styles.loginReplicaDotActive
                  : styles.loginReplicaDotMuted
              }
            />
          ))}
        </View>
      </GlassSurface>
      <GlassSurface
        radius={26}
        shadow="card"
        style={[
          styles.loginReplicaBottom,
          keyboardVisible ? styles.loginReplicaBottomKeyboard : null,
        ]}
        variant="strong"
      >
        <Animated.View style={shakeStyle}>
          <GlassSurface
            borderColor={
              error !== null
                ? ui.color.status.error
                : phoneFocused
                  ? ui.color.brand.primary
                  : 'rgba(201,54,116,0.48)'
            }
            contentStyle={[
              styles.loginPhoneWrap,
              keyboardVisible ? styles.loginPhoneWrapKeyboard : null,
            ]}
            overlayColor="rgba(255,255,255,0.9)"
            radius={12}
            shadow="soft"
            variant="strong"
          >
            <View style={styles.loginPhonePrefix}>
              <Text
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.1}
                numberOfLines={1}
                style={styles.loginFlag}
              >
                {country.isoCode}
              </Text>
              <Text
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.1}
                numberOfLines={1}
                style={styles.loginPrefixText}
              >
                {country.dialCode}
              </Text>
            </View>
            <View style={styles.loginDivider} />
            <TextInput
              accessibilityLabel="Your Mobile Number"
              keyboardType="number-pad"
              maxLength={country.nationalNumberLength}
              onChangeText={(value) => {
                setNationalNumber(normalizePhoneDigits(value));
                setError(null);
                setReferralValidation(null);
              }}
              onBlur={() => {
                setPhoneFocused(false);
              }}
              onFocus={() => {
                setPhoneFocused(true);
              }}
              placeholder="Your Mobile Number"
              placeholderTextColor="#8b7d86"
              maxFontSizeMultiplier={1.15}
              style={[
                styles.loginPhoneInput,
                keyboardVisible ? styles.loginPhoneInputKeyboard : null,
              ]}
              value={normalizedNationalNumber}
            />
          </GlassSurface>
        </Animated.View>
        <FieldMessage message={error} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            busy: phoneHintLoading,
            disabled: submitting || phoneHintLoading,
          }}
          disabled={submitting || phoneHintLoading}
          onPress={() => {
            haptics.selection();
            void requestGoogleNumberSignIn();
          }}
          style={[
            styles.googlePhoneButton,
            keyboardVisible ? styles.googlePhoneButtonKeyboard : null,
            submitting || phoneHintLoading
              ? styles.googlePhoneButtonDisabled
              : null,
          ]}
        >
          <View style={styles.googlePhoneBadge}>
            <Text style={styles.googlePhoneBadgeText}>G</Text>
          </View>
          <Text
            adjustsFontSizeToFit
            ellipsizeMode="tail"
            minimumFontScale={0.72}
            numberOfLines={1}
            style={styles.googlePhoneButtonText}
          >
            {phoneHintLoading
              ? 'Checking Google number...'
              : 'Sign in with Google number'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Add referral code"
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={() => {
            haptics.selection();
            router.push({
              params: { returnTo: appRoutes.authLogin.path },
              pathname: appRoutes.authReferralCode.path,
            });
          }}
          style={[
            styles.loginReferralButton,
            keyboardVisible ? styles.loginReferralButtonKeyboard : null,
          ]}
        >
          <Gift color={ui.color.brand.primary} size={16} strokeWidth={2.3} />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.loginReferralButtonText}
          >
            {referralCode.trim().length > 0
              ? `Referral: ${referralCode.trim().toUpperCase()}`
              : 'Add referral code'}
          </Text>
        </Pressable>
        {renderOtpButton(keyboardVisible)}
        {keyboardVisible ? null : (
          <Text style={styles.loginTerms}>
            By tapping, you agree to our{' '}
            <Text style={styles.loginTermsLink}>Terms of Use</Text> and{' '}
            <Text style={styles.loginTermsLink}>Privacy Policy</Text>.{'\n'}All
            your details are 100% safe & secure.
          </Text>
        )}
      </GlassSurface>
    </KeyboardScreen>
  );
}

export function ReferralCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string | string[];
    returnTo?: string | string[];
  }>();
  const haptics = useHaptics();
  const {
    country,
    nationalNumber,
    referralCode,
    referralValidation,
    setReferralCode,
    setReferralValidation,
  } = useAuthFlowStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefilledCode = useMemo(() => {
    const raw = Array.isArray(params.code) ? params.code[0] : params.code;
    return raw?.trim().toUpperCase() ?? '';
  }, [params.code]);

  const phoneNumber = buildPhoneNumberFromDraft(
    country,
    normalizePhoneDigits(nationalNumber),
  );

  useEffect(() => {
    if (prefilledCode.length === 0 || prefilledCode === referralCode) {
      return;
    }

    setReferralCode(prefilledCode);
    setReferralValidation(null);
  }, [prefilledCode, referralCode, setReferralCode, setReferralValidation]);

  const applyReferral = async () => {
    const normalizedCode = referralCode.trim().toUpperCase();

    if (normalizedCode.length === 0) {
      setError('Enter a referral code or skip this step.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await customerAuthAdapter.validateReferralCode({
        code: normalizedCode,
        phoneNumber,
      });
      setReferralCode(result.code);
      setReferralValidation(result);
      haptics.selection();
    } catch (error: unknown) {
      const normalized = normalizeApiError(error);
      setError(normalized.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardScreen
      bottomAction={
        <View style={styles.sheetActions}>
          <Button
            loading={submitting}
            onPress={() => {
              void applyReferral();
            }}
            title="Apply code"
          />
          <Button
            disabled={submitting}
            onPress={() => {
              const returnTo = Array.isArray(params.returnTo)
                ? params.returnTo[0]
                : params.returnTo;
              router.replace(returnTo ?? appRoutes.authLogin.path);
            }}
            title={referralCode.trim().length > 0 ? 'Done' : 'Skip for now'}
            variant="secondary"
          />
        </View>
      }
      contentStyle={styles.sheetScreen}
      edges={['bottom']}
    >
      <View style={styles.sheetBackdrop} />
      <GlassSurface
        radius={ui.radii.xxl}
        shadow="floating"
        style={styles.sheetCard}
        variant="modal"
      >
        <Text style={styles.formTitle}>Referral code</Text>
        <Text style={styles.formBody}>
          Referral rewards are optional. You can apply a code now or continue
          without one.
        </Text>
        {prefilledCode.length === 0 ? null : (
          <Banner
            message={`Invite link detected. Review ${prefilledCode} and apply it before you continue with signup.`}
            title="Referral prefilled"
            tone="info"
          />
        )}
        <TextField
          autoCapitalize="characters"
          {...(error !== null ? { errorText: error } : {})}
          label="Code"
          onChangeText={(value) => {
            setReferralCode(value.toUpperCase());
            setError(null);
          }}
          placeholder="CONNECTO100"
          value={referralCode}
        />
        {referralValidation === null ? null : (
          <Banner
            message={referralValidation.message}
            title={
              referralValidation.outcome === 'valid'
                ? 'Referral applied'
                : referralValidation.outcome === 'pending-qualification'
                  ? 'Referral pending'
                  : 'Referral unavailable'
            }
            tone={
              referralValidation.outcome === 'valid'
                ? 'success'
                : referralValidation.outcome === 'pending-qualification'
                  ? 'warning'
                  : 'error'
            }
          />
        )}
      </GlassSurface>
    </KeyboardScreen>
  );
}

export function OtpVerificationScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const {
    pendingOtpChallenge,
    referralCode,
    resetFlow,
    setPendingOtpChallenge,
    updateInvalidAttempts,
  } = useAuthFlowStore();
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [shakeKey, setShakeKey] = useState(0);
  const keyboardVisible = useKeyboardVisible();
  const authNavigationInFlight = useRef(false);
  const shakeStyle = useShake(shakeKey);

  useEffect(() => {
    if (pendingOtpChallenge === null && !authNavigationInFlight.current) {
      router.replace('/(auth)/login');
      return;
    }

    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [pendingOtpChallenge, router]);

  const remainingSeconds = useMemo(
    () =>
      pendingOtpChallenge === null
        ? 0
        : getOtpResendRemainingSeconds(
            pendingOtpChallenge.sentAtMs,
            currentTimeMs,
            pendingOtpChallenge.resendAfterSeconds,
          ),
    [currentTimeMs, pendingOtpChallenge],
  );

  const submitVerification = async () => {
    if (pendingOtpChallenge === null) {
      router.replace('/(auth)/login');
      return;
    }

    if (otpCode.length !== 6) {
      setError('Enter the complete 6-digit code.');
      setShakeKey((current) => current + 1);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await customerAuthAdapter.verifyOtp({
        code: otpCode,
        phoneNumber: pendingOtpChallenge.phoneNumber,
        referralCode: referralCode.length > 0 ? referralCode : null,
        requestId: pendingOtpChallenge.requestId,
      });

      if (result.kind === 'failure') {
        const nextAttempts =
          result.reason === 'invalid'
            ? getNextInvalidAttemptCount(pendingOtpChallenge.invalidAttempts)
            : pendingOtpChallenge.invalidAttempts;
        updateInvalidAttempts(nextAttempts);
        setError(result.message);
        setShakeKey((current) => current + 1);

        if (result.reason === 'too-many-attempts') {
          setPendingOtpChallenge({
            ...pendingOtpChallenge,
            invalidAttempts: otpMaxInvalidAttempts,
            resendAfterSeconds:
              result.retryAfterSeconds ??
              pendingOtpChallenge.resendAfterSeconds,
            sentAtMs: Date.now(),
          });
        }

        return;
      }

      if (result.kind === 'account-status') {
        const route = completeAccountStatus({
          phoneNumber: result.phoneNumber,
          status: result.status,
        });
        await persistAuthSnapshot(getAuthSnapshot());
        authNavigationInFlight.current = true;
        resetFlow();
        router.replace(route);
        return;
      }

      const route = completeAuthSession({
        customerRouteTarget: result.customerRouteTarget,
        hostKycStatus: result.hostKycStatus,
        phoneNumber: result.phoneNumber,
        role: result.role,
        sessionId: result.sessionId,
      });
      haptics.success();
      if (result.tokens !== undefined) {
        await saveSamvadTokens(result.tokens);
      }
      await persistAuthSnapshot(getAuthSnapshot());
      authNavigationInFlight.current = true;
      resetFlow();
      router.replace(route);
    } catch (error: unknown) {
      const normalized = normalizeApiError(error);
      setError(normalized.message);
      setShakeKey((current) => current + 1);
    } finally {
      if (!authNavigationInFlight.current) {
        setSubmitting(false);
      }
    }
  };

  const resendOtp = async () => {
    if (pendingOtpChallenge === null || remainingSeconds > 0) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await customerAuthAdapter.requestOtp({
        phoneNumber: pendingOtpChallenge.phoneNumber,
        referralCode: referralCode.length > 0 ? referralCode : null,
      });
      setPendingOtpChallenge({
        ...pendingOtpChallenge,
        invalidAttempts: 0,
        requestId: result.requestId,
        resendAfterSeconds: result.resendAfterSeconds,
        sentAtMs: Date.now(),
      });
      setOtpCode('');
    } catch (error: unknown) {
      const normalized = normalizeApiError(error);
      setError(normalized.message);
    } finally {
      setSubmitting(false);
    }
  };

  const phoneNumber = pendingOtpChallenge?.phoneNumber ?? '';
  const verifyButton = (
    <Button
      compact={keyboardVisible}
      loading={submitting}
      onPress={() => {
        void submitVerification();
      }}
      style={styles.otpVerifyButton}
      title="Verify code"
    />
  );

  return (
    <AuthScaffold
      bottomAction={keyboardVisible ? undefined : verifyButton}
      brandCompact={keyboardVisible}
      contentStyle={keyboardVisible ? styles.otpKeyboardContent : null}
      formCardStyle={keyboardVisible ? styles.otpFormCardKeyboard : null}
      title="OTP verification"
    >
      <Text
        style={[
          styles.formTitle,
          keyboardVisible ? styles.otpFormTitleKeyboard : null,
        ]}
      >
        Enter the 6-digit OTP.
      </Text>
      <Text
        numberOfLines={keyboardVisible ? 2 : undefined}
        style={[
          styles.formBody,
          keyboardVisible ? styles.otpFormBodyKeyboard : null,
        ]}
      >
        We sent a code to {phoneNumber}.{' '}
        {isSamvadAuthEnabled
          ? 'Enter the code from Firebase to continue.'
          : 'Mock fixtures expect `246810`.'}
      </Text>
      <Animated.View style={shakeStyle}>
        <View
          style={[
            styles.fieldGroup,
            keyboardVisible ? styles.otpFieldGroupKeyboard : null,
          ]}
        >
          <Text style={styles.fieldLabel}>Verification code</Text>
          <OTPInput
            accessibilityLabel="One-time password"
            disabled={submitting}
            onChange={(value) => {
              setOtpCode(value);
              setError(null);
            }}
            testID="auth-otp"
            value={otpCode}
          />
          {error === null ? null : <InlineError message={error} />}
        </View>
      </Animated.View>
      {keyboardVisible ? (
        <View style={styles.otpVerifyInline}>{verifyButton}</View>
      ) : (
        <View style={styles.otpMetaRow}>
          <Button
            compact
            disabled={submitting}
            onPress={() => {
              router.replace('/(auth)/login');
            }}
            title="Change number"
            variant="ghost"
          />
          <Button
            compact
            disabled={remainingSeconds > 0 || submitting}
            onPress={() => {
              void resendOtp();
            }}
            title={
              remainingSeconds > 0
                ? `Resend in ${String(remainingSeconds)}s`
                : 'Resend code'
            }
            variant="secondary"
          />
        </View>
      )}
    </AuthScaffold>
  );
}

export function AccountStatusRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace(resolveDefaultRoute());
  }, [router]);

  return (
    <Screen contentStyle={styles.centeredScreen}>
      <View />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bootstrapMessage: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    marginTop: ui.spacing[4],
    textAlign: 'center',
  },
  brandLottie: {
    minHeight: 88,
    minWidth: 88,
  },
  brandLottieCompact: {
    height: 62,
    minHeight: 62,
    minWidth: 62,
    width: 62,
  },
  brandName: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.headline.fontSize,
    lineHeight: ui.type.headline.lineHeight,
    marginTop: ui.spacing[3],
  },
  brandNameCompact: {
    fontSize: 24,
    lineHeight: 30,
    marginTop: ui.spacing[2],
  },
  brandPulseFallback: {
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 88,
    width: 88,
  },
  brandSeal: {
    alignItems: 'center',
    backgroundColor: ui.color.background.surface,
    borderColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    marginTop: -44,
    width: 56,
  },
  brandSealCompact: {
    height: 40,
    marginTop: -31,
    width: 40,
  },
  brandSubtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    marginTop: ui.spacing[2],
    textAlign: 'center',
  },
  brandSubtitleCompact: {
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    marginTop: 0,
  },
  brandWrap: {
    alignItems: 'center',
    gap: ui.spacing[1],
    marginBottom: ui.spacing[2],
  },
  brandWrapCompact: {
    gap: 0,
    marginBottom: 0,
  },
  centeredScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  fieldGroup: {
    gap: ui.spacing[2],
  },
  fieldLabel: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  fieldMessage: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  fieldMessagePositive: {
    color: ui.color.status.success,
  },
  formBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  formCard: {
    gap: ui.spacing[4],
  },
  formTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  googlePhoneBadge: {
    alignItems: 'center',
    backgroundColor: ui.color.background.surface,
    borderColor: '#dadce0',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  googlePhoneBadgeText: {
    color: '#4285f4',
    fontFamily: ui.font.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  googlePhoneButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.borderStrong,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 52,
    justifyContent: 'center',
    marginTop: 12,
    width: '100%',
  },
  googlePhoneButtonKeyboard: {
    height: 40,
    marginTop: 4,
  },
  googlePhoneButtonDisabled: {
    opacity: 0.62,
  },
  googlePhoneButtonText: {
    color: ui.color.text.primary,
    flex: 1,
    flexShrink: 1,
    fontFamily: ui.font.bold,
    fontSize: 15,
    lineHeight: 20,
    minWidth: 0,
    paddingRight: 6,
    textAlign: 'center',
  },
  loginReferralButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 30,
    maxWidth: '100%',
    paddingHorizontal: 10,
  },
  loginReferralButtonKeyboard: {
    marginTop: 2,
    minHeight: 24,
  },
  loginReferralButtonText: {
    color: ui.color.brand.primary,
    flexShrink: 1,
    fontFamily: ui.font.bold,
    fontSize: 13,
    lineHeight: 17,
    minWidth: 0,
    textAlign: 'center',
  },
  inlineReferralActions: {
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  inlineReferralCard: {
    backgroundColor: ui.color.brand.primarySoft,
    borderColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.xl,
    borderWidth: 1,
    gap: ui.spacing[3],
    padding: ui.spacing[4],
  },
  loginDivider: {
    backgroundColor: '#b986b2',
    height: 42,
    width: 1,
  },
  loginFlag: {
    fontSize: 22,
    lineHeight: 26,
  },
  loginOtpButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(201,54,116,0.24)',
    borderColor: ui.glass.border,
    borderWidth: 1,
    borderRadius: 30,
    height: 58,
    justifyContent: 'center',
    marginTop: 28,
    width: '100%',
  },
  loginOtpButtonReady: {
    backgroundColor: ui.color.brand.primary,
  },
  loginOtpButtonCompact: {
    height: 44,
    marginTop: 6,
  },
  loginOtpButtonText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  loginPhoneInput: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.medium,
    fontSize: 20,
    height: 64,
    paddingHorizontal: 12,
  },
  loginPhoneInputKeyboard: {
    fontSize: 17,
    height: 50,
  },
  loginPhonePrefix: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 106,
    paddingLeft: 16,
  },
  loginPhoneWrap: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    minHeight: 70,
    overflow: 'hidden',
    padding: 0,
  },
  loginPhoneWrapKeyboard: {
    minHeight: 54,
  },
  loginPrefixText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  loginHeroCarousel: {
    width: loginHeroWidth,
  },
  loginHeroSlide: {
    alignItems: 'center',
    width: loginHeroWidth,
  },
  loginReplicaBottom: {
    gap: 8,
    marginTop: 'auto',
    maxWidth: 380,
    padding: 16,
    width: '100%',
  },
  loginReplicaBottomKeyboard: {
    gap: 4,
    marginBottom: 0,
    marginTop: 'auto',
    padding: 10,
  },
  loginReplicaCaption: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 18,
    textAlign: 'center',
  },
  loginReplicaCaptionKeyboard: {
    fontSize: 15,
    lineHeight: 18,
    marginTop: 6,
  },
  loginReplicaContent: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 18,
    paddingBottom: 16,
    paddingTop: 18,
  },
  loginReplicaContentKeyboard: {
    gap: 6,
    paddingBottom: 0,
    paddingTop: 2,
  },
  loginReplicaDotActive: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  loginReplicaDotMuted: {
    backgroundColor: '#c9c9c9',
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  loginReplicaDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 16,
  },
  loginReplicaDotsKeyboard: {
    marginTop: 6,
  },
  loginReplicaHeroWrap: {
    marginTop: 18,
    maxWidth: 380,
    width: '100%',
  },
  loginReplicaHeroWrapKeyboard: {
    marginTop: 0,
  },
  loginHeroPanel: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  loginHeroPanelKeyboard: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  loginReplicaTop: {
    alignItems: 'center',
  },
  loginReplicaTopKeyboard: {
    marginBottom: -2,
  },
  loginWordmark: {
    fontFamily: 'cursive',
    fontSize: 34,
    lineHeight: 42,
  },
  loginWordmarkCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  loginWordmarkBang: {
    color: '#e30d36',
  },
  loginWordmarkStart: {
    color: '#7869c8',
  },
  loginTerms: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 18,
    textAlign: 'center',
  },
  loginTermsLink: {
    color: ui.color.text.primary,
    textDecorationLine: 'underline',
  },
  keyboardContent: {
    gap: ui.spacing[5],
    justifyContent: 'center',
    paddingBottom: ui.spacing[8],
  },
  otpFieldGroupKeyboard: {
    gap: ui.spacing[1],
  },
  otpFormBodyKeyboard: {
    fontSize: 14,
    lineHeight: 19,
  },
  otpFormCardKeyboard: {
    gap: ui.spacing[3],
    padding: ui.spacing[4],
  },
  otpFormTitleKeyboard: {
    fontSize: 22,
    lineHeight: 28,
  },
  otpKeyboardContent: {
    flexGrow: 1,
    gap: ui.spacing[3],
    justifyContent: 'center',
    paddingBottom: 0,
    paddingTop: ui.spacing[2],
  },
  otpMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpVerifyButton: {
    alignSelf: 'stretch',
  },
  otpVerifyInline: {
    marginTop: ui.spacing[1],
  },
  referralSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  referenceCrop: {
    overflow: 'hidden',
  },
  sheetActions: {
    gap: ui.spacing[3],
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(25,18,28,0.30)',
  },
  sheetCard: {
    borderTopLeftRadius: ui.radii.xxl,
    borderTopRightRadius: ui.radii.xxl,
    gap: ui.spacing[4],
    marginTop: 'auto',
    padding: ui.spacing[5],
  },
  sheetScreen: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 0,
  },
  statusBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  statusCard: {
    alignItems: 'center',
    gap: ui.spacing[4],
    maxWidth: 360,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: ui.color.status.warningSoft,
    borderRadius: ui.radii.full,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  statusTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
});
