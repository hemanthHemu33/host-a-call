import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type LottieView from 'lottie-react-native';
import LottieNativeView from 'lottie-react-native';
import type { LottieViewProps } from 'lottie-react-native';

import { useMotion } from '@/motion/MotionProvider';

import { getLottieAsset, type LottieAssetId } from './registry';
import { ui } from '../ui/theme';

type LottieColorFilters = NonNullable<LottieViewProps['colorFilters']>;
type LottieViewComponent = typeof LottieView;

export type LottieIllustrationProps = {
  assetId: LottieAssetId;
  colorFilters?: LottieColorFilters;
  fallback?: ReactNode;
  fallbackLabel: string;
  loop?: boolean;
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const staticProgressFor = (
  source: NonNullable<LottieViewProps['source']>,
  frame: number,
) => {
  if (typeof source !== 'object' || 'uri' in source) {
    return 0;
  }

  const frameCount = Math.max(1, source.op - source.ip);

  return Math.max(0, Math.min(1, (frame - source.ip) / frameCount));
};

const durationMsFor = (source: NonNullable<LottieViewProps['source']>) => {
  if (
    typeof source === 'object' &&
    !('uri' in source) &&
    typeof source.fr === 'number' &&
    typeof source.ip === 'number' &&
    typeof source.op === 'number' &&
    source.fr > 0
  ) {
    return Math.max(
      600,
      Math.round(((source.op - source.ip) / source.fr) * 1000),
    );
  }

  return 1800;
};

const playFullTimeline = (
  animation: ComponentRef<LottieViewComponent>,
  source: NonNullable<LottieViewProps['source']>,
) => {
  if (
    typeof source === 'object' &&
    !('uri' in source) &&
    typeof source.ip === 'number' &&
    typeof source.op === 'number'
  ) {
    animation.play(source.ip, source.op);
    return;
  }

  animation.play();
};

export function LottieIllustration({
  assetId,
  colorFilters,
  fallback,
  fallbackLabel,
  loop,
  playing = true,
  style,
  testID = `lottie-${assetId}`,
}: LottieIllustrationProps) {
  const asset = getLottieAsset(assetId);
  const { motionPreference, reducedMotionEnabled, systemReducedMotionEnabled } =
    useMotion();
  const animationRef = useRef<ComponentRef<LottieViewComponent>>(null);
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [failed, setFailed] = useState(asset.source === null);
  const shouldAnimate =
    asset.source !== null && playing && !reducedMotionEnabled && !failed;
  const shouldUseJsTimeline =
    shouldAnimate && motionPreference === 'full' && systemReducedMotionEnabled;
  const shouldUseNativeTimeline = shouldAnimate && !shouldUseJsTimeline;
  const progress: LottieViewProps['progress'] | undefined =
    asset.source === null
      ? undefined
      : reducedMotionEnabled
        ? staticProgressFor(asset.source, asset.staticFrame)
        : shouldUseJsTimeline
          ? timelineProgress
          : undefined;

  useEffect(() => {
    if (asset.source === null || failed) {
      return undefined;
    }

    if (shouldUseNativeTimeline) {
      animationRef.current?.reset();
      const frame = requestAnimationFrame(() => {
        if (animationRef.current !== null && asset.source !== null) {
          playFullTimeline(animationRef.current, asset.source);
        }
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    }

    animationRef.current?.pause();
    return undefined;
  }, [asset.source, failed, shouldUseNativeTimeline]);

  useEffect(() => {
    if (asset.source === null || failed || !shouldUseJsTimeline) {
      return undefined;
    }

    let frame: number | null = null;
    let stopped = false;
    const duration = durationMsFor(asset.source);
    const looping = loop ?? asset.loop;
    const startedAt = Date.now();

    const tick = () => {
      if (stopped) {
        return;
      }

      const elapsed = Date.now() - startedAt;
      const nextProgress = looping
        ? (elapsed % duration) / duration
        : Math.min(1, elapsed / duration);

      setTimelineProgress(nextProgress);

      if (looping || nextProgress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      stopped = true;

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [asset.loop, asset.source, failed, loop, shouldUseJsTimeline]);

  if (asset.source === null || failed) {
    return (
      <View
        accessibilityLabel={fallbackLabel}
        accessibilityRole="image"
        style={[styles.container, styles.fallback, style]}
        testID={`${testID}-fallback`}
      >
        {fallback ?? <Text style={styles.fallbackText}>{fallbackLabel}</Text>}
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={fallbackLabel}
      accessibilityRole="image"
      collapsable={false}
      style={[styles.container, style]}
      testID={testID}
    >
      <LottieNativeView
        autoPlay={shouldUseNativeTimeline}
        cacheComposition
        colorFilters={colorFilters}
        enableSafeModeAndroid
        hardwareAccelerationAndroid
        loop={loop ?? asset.loop}
        onAnimationFailure={() => {
          setFailed(true);
        }}
        ref={animationRef}
        renderMode="HARDWARE"
        resizeMode="contain"
        source={asset.source}
        speed={1}
        style={StyleSheet.absoluteFill}
        testID={`${testID}-animation`}
        {...(progress === undefined ? {} : { progress })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 96,
    minWidth: 96,
    overflow: 'hidden',
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.xxl,
    justifyContent: 'center',
    padding: ui.spacing[4],
  },
  fallbackText: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
});
