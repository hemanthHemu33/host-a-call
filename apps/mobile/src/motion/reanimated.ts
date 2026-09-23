import { motion as motionTokens } from '@connecto/design-tokens';
import { useEffect, useState } from 'react';
import {
  Easing,
  LinearTransition,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useMotion, useReducedMotionEnabled } from './MotionProvider';

type MotionDurationName = keyof typeof motionTokens.duration;
type MotionEasingName = keyof typeof motionTokens.easing;
type MotionSpringName = keyof typeof motionTokens.spring;

export const motionRuntime = {
  duration: motionTokens.duration,
  easing: {
    expressive: Easing.bezier(0.16, 1, 0.3, 1),
    gentle: Easing.bezier(0.22, 1, 0.36, 1),
    noBounce: Easing.bezier(0.2, 0.8, 0.2, 1),
    responsive: Easing.bezier(0.2, 0, 0, 1),
  },
} as const;

export const springPresets = {
  expressive: motionTokens.spring.expressive,
  gentle: motionTokens.spring.gentle,
  noBounce: motionTokens.spring.noBounce,
  responsive: motionTokens.spring.responsive,
} as const satisfies Record<MotionSpringName, WithSpringConfig>;

export const layoutTransitions = {
  expressive: LinearTransition.springify()
    .damping(springPresets.expressive.damping)
    .mass(springPresets.expressive.mass)
    .stiffness(springPresets.expressive.stiffness),
  gentle: LinearTransition.springify()
    .damping(springPresets.gentle.damping)
    .mass(springPresets.gentle.mass)
    .stiffness(springPresets.gentle.stiffness),
  noBounce: LinearTransition.springify()
    .damping(springPresets.noBounce.damping)
    .mass(springPresets.noBounce.mass)
    .stiffness(springPresets.noBounce.stiffness),
  responsive: LinearTransition.springify()
    .damping(springPresets.responsive.damping)
    .mass(springPresets.responsive.mass)
    .stiffness(springPresets.responsive.stiffness),
} as const;

const resolveMotionDuration = (
  duration: MotionDurationName,
  reducedMotionEnabled: boolean,
) =>
  reducedMotionEnabled
    ? Math.min(motionTokens.duration[duration], motionTokens.duration.control)
    : motionTokens.duration[duration];

export function useCancelableSharedValue(initialValue: number) {
  const value = useSharedValue(initialValue);

  useEffect(
    () => () => {
      cancelAnimation(value);
    },
    [value],
  );

  return value;
}

type VisibilityMotionOptions = {
  duration?: MotionDurationName;
  easing?: MotionEasingName;
};

const useVisibilityProgress = (
  visible: boolean,
  options?: VisibilityMotionOptions,
) => {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const progress = useCancelableSharedValue(visible ? 1 : 0);
  const durationKey = options?.duration ?? 'component';
  const easingKey = options?.easing ?? 'responsive';

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: resolveMotionDuration(durationKey, reducedMotionEnabled),
      easing: motionRuntime.easing[easingKey],
    });
  }, [durationKey, easingKey, progress, reducedMotionEnabled, visible]);

  return { progress, reducedMotionEnabled };
};

export const useFadeStyle = (
  visible: boolean,
  options?: VisibilityMotionOptions,
) => {
  const { progress } = useVisibilityProgress(visible, options);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
};

type SlideMotionOptions = VisibilityMotionOptions & {
  axis?: 'x' | 'y';
  distance?: number;
};

export const useSlideStyle = (
  visible: boolean,
  options?: SlideMotionOptions,
) => {
  const axis = options?.axis ?? 'y';
  const distance = options?.distance ?? 20;
  const { progress, reducedMotionEnabled } = useVisibilityProgress(
    visible,
    options,
  );
  const travelDistance = reducedMotionEnabled
    ? Math.sign(distance || 1) * Math.min(Math.abs(distance), 6)
    : distance;

  return useAnimatedStyle(() => {
    const translate = interpolate(progress.value, [0, 1], [travelDistance, 0]);

    return {
      opacity: progress.value,
      transform:
        axis === 'x'
          ? [{ translateX: translate }]
          : [{ translateY: translate }],
    };
  });
};

type ScaleMotionOptions = VisibilityMotionOptions & {
  fromScale?: number;
};

export const useScaleStyle = (
  visible: boolean,
  options?: ScaleMotionOptions,
) => {
  const fromScale = options?.fromScale ?? 0.96;
  const { progress, reducedMotionEnabled } = useVisibilityProgress(
    visible,
    options,
  );

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale: reducedMotionEnabled
          ? 1
          : interpolate(progress.value, [0, 1], [fromScale, 1]),
      },
    ],
  }));
};

type StaggerMotionOptions = VisibilityMotionOptions & {
  distance?: number;
  stepMs?: number;
};

export const useStaggeredListItemStyle = (
  index: number,
  visible: boolean,
  options?: StaggerMotionOptions,
) => {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const durationKey = options?.duration ?? 'component';
  const easingKey = options?.easing ?? 'gentle';
  const distance = options?.distance ?? 18;
  const stepMs = options?.stepMs ?? 36;
  const progress = useCancelableSharedValue(visible ? 1 : 0);
  const travelDistance = reducedMotionEnabled
    ? Math.sign(distance || 1) * Math.min(Math.abs(distance), 6)
    : distance;

  useEffect(() => {
    progress.value = withDelay(
      reducedMotionEnabled ? 0 : index * stepMs,
      withTiming(visible ? 1 : 0, {
        duration: resolveMotionDuration(durationKey, reducedMotionEnabled),
        easing: motionRuntime.easing[easingKey],
      }),
    );
  }, [
    durationKey,
    easingKey,
    index,
    progress,
    reducedMotionEnabled,
    stepMs,
    visible,
  ]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [travelDistance, 0]),
      },
      {
        scale: reducedMotionEnabled
          ? 1
          : interpolate(progress.value, [0, 1], [0.98, 1]),
      },
    ],
  }));
};

export const useSharedElementSubstituteStyle = (expanded: boolean) => {
  const { progress, reducedMotionEnabled } = useVisibilityProgress(expanded, {
    duration: 'screen',
    easing: 'expressive',
  });
  const travelDistance = reducedMotionEnabled ? 6 : 14;

  return useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.92, 1]),
    transform: [
      {
        scale: reducedMotionEnabled
          ? 1
          : interpolate(progress.value, [0, 1], [0.97, 1]),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [travelDistance, 0]),
      },
    ],
  }));
};

type AnimatedNumberOptions = {
  duration?: MotionDurationName;
};

export const useAnimatedNumber = (
  target: number,
  options?: AnimatedNumberOptions,
) => {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const durationKey = options?.duration ?? 'component';
  const [displayValue, setDisplayValue] = useState(target);
  const animatedValue = useCancelableSharedValue(target);

  useEffect(() => {
    if (reducedMotionEnabled) {
      cancelAnimation(animatedValue);
      animatedValue.value = target;
      setDisplayValue(target);
      return;
    }

    animatedValue.value = withTiming(target, {
      duration: resolveMotionDuration(durationKey, false),
      easing: motionRuntime.easing.gentle,
    });
  }, [animatedValue, durationKey, reducedMotionEnabled, target]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (current, previous) => {
      if (current !== previous) {
        scheduleOnRN(setDisplayValue, current);
      }
    },
  );

  return displayValue;
};

export const useSkeletonShimmerStyle = (enabled = true) => {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const translateX = useCancelableSharedValue(-140);

  useEffect(() => {
    if (!enabled || reducedMotionEnabled) {
      cancelAnimation(translateX);
      translateX.value = 0;
      return;
    }

    translateX.value = -140;
    translateX.value = withRepeat(
      withTiming(140, {
        duration: motionRuntime.duration.celebration,
        easing: motionRuntime.easing.gentle,
      }),
      -1,
      false,
    );
  }, [enabled, reducedMotionEnabled, translateX]);

  return {
    reducedMotionEnabled,
    style: useAnimatedStyle(() => ({
      opacity: reducedMotionEnabled ? 0.18 : 0.32,
      transform: [{ translateX: translateX.value }],
    })),
  };
};

export const usePulseStyle = (enabled = true) => {
  const { motionPreference, reducedMotionEnabled } = useMotion();
  const timingReduceMotion =
    motionPreference === 'full' ? ReduceMotion.Never : ReduceMotion.System;
  const pulse = useCancelableSharedValue(1);

  useEffect(() => {
    if (!enabled || reducedMotionEnabled) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, {
          duration: motionRuntime.duration.component,
          easing: motionRuntime.easing.gentle,
          reduceMotion: timingReduceMotion,
        }),
        withTiming(1, {
          duration: motionRuntime.duration.component,
          easing: motionRuntime.easing.gentle,
          reduceMotion: timingReduceMotion,
        }),
      ),
      -1,
      false,
    );
  }, [enabled, pulse, reducedMotionEnabled, timingReduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: reducedMotionEnabled
      ? 1
      : interpolate(pulse.value, [1, 1.04], [1, 0.88]),
    transform: [{ scale: pulse.value }],
  }));
};

export const useSharedValueScaleStyle = (scale: SharedValue<number>) =>
  useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

export const useSharedValueTranslateXStyle = (
  translateX: SharedValue<number>,
) =>
  useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-140, 0, 140], [0.55, 1, 0.55]),
    transform: [{ translateX: translateX.value }],
  }));
