import {
  Camera,
  CheckCircle2,
  Mic,
  Phone,
  RefreshCw,
  Video,
  Wallet,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { ScrollScreen } from '@/components/layout';
import {
  AppHeader,
  Banner,
  Button,
  Card,
  RadioCard,
  SectionHeader,
  StatusBadge,
  SwitchRow,
} from '@/components/ui';
import { ui } from '@/components/ui/theme';
import {
  createHorizontalSwipeGesture,
  createTapScaleGesture,
  layoutTransitions,
  motionRuntime,
  useAnimatedNumber,
  useCancelableSharedValue,
  useFadeStyle,
  useHaptics,
  useMotion,
  usePulseStyle,
  useScaleStyle,
  useSharedElementSubstituteStyle,
  useSharedValueScaleStyle,
  useSharedValueTranslateXStyle,
  useSkeletonShimmerStyle,
  useSlideStyle,
  useStaggeredListItemStyle,
  type MotionPreference,
} from '@/motion';

function LabSection({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        {...(subtitle === undefined ? {} : { subtitle })}
      />
      {children}
    </View>
  );
}

function MotionPreferenceCard({
  label,
  onPress,
  preference,
  selected,
}: {
  label: string;
  onPress: () => void;
  preference: MotionPreference;
  selected: boolean;
}) {
  const description =
    preference === 'system'
      ? 'Follows the OS accessibility setting.'
      : preference === 'reduced'
        ? 'Removes travel distance and looping pulse motion.'
        : 'Allows the full motion system.';

  return (
    <RadioCard
      description={description}
      label={label}
      onPress={onPress}
      selected={selected}
    />
  );
}

function StaggeredDemoRow({
  index,
  label,
  visible,
}: {
  index: number;
  label: string;
  visible: boolean;
}) {
  const style = useStaggeredListItemStyle(index, visible);

  return (
    <Animated.View style={style}>
      <Card style={styles.demoCard}>
        <Text style={styles.cardTitle}>{label}</Text>
      </Card>
    </Animated.View>
  );
}

function SharedElementDemo({ expanded }: { expanded: boolean }) {
  const style = useSharedElementSubstituteStyle(expanded);

  return (
    <Animated.View style={style}>
      <Card
        style={[
          styles.demoCard,
          expanded ? styles.sharedExpandedCard : styles.sharedCompactCard,
        ]}
      >
        <Text style={styles.cardTitle}>
          {expanded ? 'Expanded summary' : 'Compact summary'}
        </Text>
        <Text style={styles.body}>
          Uses a cross-fade plus restrained scale instead of a fragile shared
          element dependency.
        </Text>
      </Card>
    </Animated.View>
  );
}

function AnimatedBalanceCard({ value }: { value: number }) {
  const displayValue = useAnimatedNumber(value, { duration: 'screen' });

  return (
    <Card style={styles.demoCard}>
      <Text style={styles.label}>Animated number</Text>
      <Text style={styles.heroValue}>{`Rs ${String(displayValue)}`}</Text>
      <Text style={styles.body}>
        Numeric transitions stay readable when reduced motion is enabled.
      </Text>
    </Card>
  );
}

function SkeletonShimmerDemo() {
  const { reducedMotionEnabled, style } = useSkeletonShimmerStyle(true);

  return (
    <Card style={styles.demoCard}>
      <Text style={styles.label}>Skeleton shimmer</Text>
      <View style={styles.skeletonFrame}>
        <View style={styles.skeletonBase} />
        <Animated.View style={[styles.shimmerBar, style]} />
      </View>
      <Text style={styles.body}>
        {reducedMotionEnabled
          ? 'Reduced motion shows a static skeleton.'
          : 'Default motion keeps the shimmer slow and interruptible.'}
      </Text>
    </Card>
  );
}

function PulseDemo() {
  const style = usePulseStyle(true);

  return (
    <Card style={styles.demoCard}>
      <Text style={styles.label}>Pulse</Text>
      <Animated.View style={[styles.pulseDot, style]} />
      <Text style={styles.body}>
        Repeated pulse is disabled automatically when reduced motion is active.
      </Text>
    </Card>
  );
}

function TapGestureDemo() {
  const scale = useCancelableSharedValue(1);
  const animatedStyle = useSharedValueScaleStyle(scale);
  const gesture = createTapScaleGesture({ scale });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <Card style={styles.demoCard}>
          <Text style={styles.cardTitle}>Tap scale gesture</Text>
          <Text style={styles.body}>
            Gesture Handler drives the scale feedback instead of ad hoc
            per-screen responders.
          </Text>
        </Card>
      </Animated.View>
    </GestureDetector>
  );
}

function SwipeGestureDemo({ onDismissed }: { onDismissed: () => void }) {
  const translateX = useCancelableSharedValue(0);
  const animatedStyle = useSharedValueTranslateXStyle(translateX);
  const gesture = createHorizontalSwipeGesture({
    onDismiss: onDismissed,
    translateX,
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <Card style={styles.demoCard}>
          <Text style={styles.cardTitle}>Horizontal swipe gesture</Text>
          <Text style={styles.body}>
            Swipe to dismiss and the animation cancels safely if the route
            unmounts first.
          </Text>
        </Card>
      </Animated.View>
    </GestureDetector>
  );
}

export function MotionLabScreen() {
  const haptics = useHaptics();
  const {
    cameraSessionActive,
    cameraUsesReliableHaptics,
    motionPreference,
    nonEssentialHapticsEnabled,
    reducedMotionEnabled,
    setCameraSessionActive,
    setMotionPreference,
    setNonEssentialHapticsEnabled,
    systemReducedMotionEnabled,
  } = useMotion();
  const [balanceTarget, setBalanceTarget] = useState(320);
  const [fadeVisible, setFadeVisible] = useState(true);
  const [scaleVisible, setScaleVisible] = useState(true);
  const [sharedExpanded, setSharedExpanded] = useState(false);
  const [showLayoutAlt, setShowLayoutAlt] = useState(false);
  const [showList, setShowList] = useState(true);
  const [slideVisible, setSlideVisible] = useState(true);
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const fadeStyle = useFadeStyle(fadeVisible);
  const slideStyle = useSlideStyle(slideVisible, { distance: 24 });
  const scaleStyle = useScaleStyle(scaleVisible, { fromScale: 0.94 });

  return (
    <ScrollScreen contentStyle={styles.content} testID="motion-lab-screen">
      <AppHeader
        actionIcon={RefreshCw}
        subtitle="Central motion and haptics verification"
        title="Motion lab"
      />

      <Banner
        message={`Durations: ${String(motionRuntime.duration.instant)}ms instant, ${String(motionRuntime.duration.control)}ms control, ${String(motionRuntime.duration.component)}ms component, ${String(motionRuntime.duration.screen)}ms screen, ${String(motionRuntime.duration.sheet)}ms sheet, ${String(motionRuntime.duration.celebration)}ms celebration.`}
        title="Approved motion scale"
      />

      <LabSection
        subtitle="System accessibility plus app-level override"
        title="Preferences"
      >
        <View style={styles.statusRow}>
          <StatusBadge
            label={
              systemReducedMotionEnabled ? 'System reduced' : 'System normal'
            }
            tone={systemReducedMotionEnabled ? 'warning' : 'success'}
          />
          <StatusBadge
            label={
              reducedMotionEnabled ? 'Effective reduced' : 'Effective full'
            }
            tone={reducedMotionEnabled ? 'warning' : 'info'}
          />
          <StatusBadge
            label={
              cameraUsesReliableHaptics
                ? 'Camera haptics allowed'
                : 'Camera haptics suppressed'
            }
            tone={cameraUsesReliableHaptics ? 'success' : 'warning'}
          />
        </View>

        <View style={styles.preferenceColumn}>
          <MotionPreferenceCard
            label="Follow system"
            onPress={() => {
              setMotionPreference('system');
            }}
            preference="system"
            selected={motionPreference === 'system'}
          />
          <MotionPreferenceCard
            label="Reduce motion"
            onPress={() => {
              setMotionPreference('reduced');
            }}
            preference="reduced"
            selected={motionPreference === 'reduced'}
          />
          <MotionPreferenceCard
            label="Full motion"
            onPress={() => {
              setMotionPreference('full');
            }}
            preference="full"
            selected={motionPreference === 'full'}
          />
        </View>

        <SwitchRow
          label="Allow nonessential haptics"
          onValueChange={setNonEssentialHapticsEnabled}
          value={nonEssentialHapticsEnabled}
        />
        <SwitchRow
          label="Simulate camera session"
          onValueChange={setCameraSessionActive}
          value={cameraSessionActive}
        />
        {cameraSessionActive && !cameraUsesReliableHaptics ? (
          <Banner
            message="Android camera sessions suppress haptics here because delivery is not reliable enough for production feedback."
            title="Camera policy"
            tone="warning"
          />
        ) : null}
      </LabSection>

      <LabSection
        subtitle="Feature screens should call semantic events, not Expo APIs."
        title="Haptics"
      >
        <View style={styles.buttonWrap}>
          <Button
            compact
            onPress={() => {
              haptics.selection();
            }}
            title="Selection"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              haptics.lightImpact();
            }}
            title="Light impact"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              haptics.mediumConfirm();
            }}
            title="Medium confirm"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              haptics.warning();
            }}
            title="Warning"
            variant="tonal"
          />
          <Button
            compact
            onPress={() => {
              haptics.reject();
            }}
            title="Reject"
            variant="destructive"
          />
          <Button
            compact
            onPress={() => {
              haptics.success();
            }}
            title="Success"
            variant="primary"
          />
          <Button
            compact
            onPress={() => {
              haptics.callAccepted();
            }}
            title="Call accepted"
            variant="primary"
          />
          <Button
            compact
            onPress={() => {
              haptics.videoUnlocked();
            }}
            title="Video unlocked"
            variant="primary"
          />
          <Button
            compact
            onPress={() => {
              haptics.paymentResult('success');
            }}
            title="Payment success"
            variant="primary"
          />
          <Button
            compact
            onPress={() => {
              haptics.paymentResult('failure');
            }}
            title="Payment failure"
            variant="destructive"
          />
          <Button
            compact
            onPress={() => {
              haptics.lowBalance();
            }}
            title="Low balance"
            variant="tonal"
          />
          <Button
            compact
            onPress={() => {
              haptics.rankUp();
            }}
            title="Rank up"
            variant="secondary"
          />
        </View>
      </LabSection>

      <LabSection
        subtitle="Each helper uses token durations and reduced-motion fallback."
        title="Transitions"
      >
        <View style={styles.buttonWrap}>
          <Button
            compact
            onPress={() => {
              setFadeVisible((current) => !current);
            }}
            title="Toggle fade"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              setSlideVisible((current) => !current);
            }}
            title="Toggle slide"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              setScaleVisible((current) => !current);
            }}
            title="Toggle scale"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              setSharedExpanded((current) => !current);
            }}
            title="Shared substitute"
            variant="secondary"
          />
        </View>

        <Animated.View style={fadeStyle}>
          <Card style={styles.demoCard}>
            <Text style={styles.cardTitle}>Fade helper</Text>
            <Text style={styles.body}>
              Use for inline status changes and small messaging swaps.
            </Text>
          </Card>
        </Animated.View>

        <Animated.View style={slideStyle}>
          <Card style={styles.demoCard}>
            <Text style={styles.cardTitle}>Slide helper</Text>
            <Text style={styles.body}>
              Reduced motion trims the travel distance instead of hiding state.
            </Text>
          </Card>
        </Animated.View>

        <Animated.View style={scaleStyle}>
          <Card style={styles.demoCard}>
            <Text style={styles.cardTitle}>Scale helper</Text>
            <Text style={styles.body}>
              Small scale is reserved for controls and compact card reveals.
            </Text>
          </Card>
        </Animated.View>

        <SharedElementDemo expanded={sharedExpanded} />
      </LabSection>

      <LabSection
        subtitle="List, number, skeleton, pulse, and layout utilities."
        title="Patterns"
      >
        <View style={styles.buttonWrap}>
          <Button
            compact
            onPress={() => {
              setShowList((current) => !current);
            }}
            title="Toggle stagger"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              setBalanceTarget((current) =>
                current === 320 ? 780 : current === 780 ? 1120 : 320,
              );
            }}
            title="Advance number"
            variant="secondary"
          />
          <Button
            compact
            onPress={() => {
              setShowLayoutAlt((current) => !current);
            }}
            title="Toggle layout"
            variant="secondary"
          />
        </View>

        <View style={styles.staggerColumn}>
          {['Host card', 'Wallet tile', 'Call row'].map((label, index) => (
            <StaggeredDemoRow
              index={index}
              key={label}
              label={label}
              visible={showList}
            />
          ))}
        </View>

        <AnimatedBalanceCard value={balanceTarget} />
        <SkeletonShimmerDemo />
        <PulseDemo />

        <Animated.View
          layout={layoutTransitions.gentle}
          style={styles.layoutWrap}
        >
          {(showLayoutAlt
            ? [Camera, Video, Wallet, CheckCircle2]
            : [Mic, Phone, Video]
          ).map((Icon, index) => (
            <Animated.View
              key={`${showLayoutAlt ? 'alt' : 'base'}-${String(index)}`}
              layout={layoutTransitions.responsive}
              style={styles.layoutTile}
            >
              <Icon color={ui.color.brand.primary} size={22} />
            </Animated.View>
          ))}
        </Animated.View>
      </LabSection>

      <LabSection
        subtitle="Gesture Handler utilities wrap repeatable interaction policies."
        title="Gestures"
      >
        <TapGestureDemo />
        <SwipeGestureDemo
          key={swipeResetKey}
          onDismissed={() => {
            setSwipeResetKey((current) => current + 1);
          }}
        />
      </LabSection>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  buttonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  content: {
    gap: ui.spacing[7],
  },
  demoCard: {
    gap: ui.spacing[2],
  },
  heroValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.display.fontSize,
    lineHeight: ui.type.display.lineHeight,
  },
  label: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
    textTransform: 'uppercase',
  },
  layoutTile: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.lg,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  layoutWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  preferenceColumn: {
    gap: ui.spacing[3],
  },
  pulseDot: {
    alignSelf: 'flex-start',
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    height: 28,
    width: 28,
  },
  section: {
    gap: ui.spacing[4],
  },
  sharedCompactCard: {
    minHeight: 120,
  },
  sharedExpandedCard: {
    minHeight: 164,
  },
  shimmerBar: {
    backgroundColor: ui.color.text.inverse,
    borderRadius: ui.radii.full,
    height: '100%',
    width: '40%',
  },
  skeletonBase: {
    backgroundColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  skeletonFrame: {
    backgroundColor: ui.color.background.surfaceMuted,
    borderRadius: ui.radii.full,
    height: 18,
    overflow: 'hidden',
    width: '100%',
  },
  staggerColumn: {
    gap: ui.spacing[3],
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
});
