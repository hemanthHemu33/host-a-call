import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import {
  cancelAnimation,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motionRuntime, springPresets } from './reanimated';

type TapScaleGestureOptions = {
  enabled?: boolean;
  onTap?: () => void;
  pressedScale?: number;
  scale: SharedValue<number>;
};

export const createTapScaleGesture = ({
  enabled = true,
  onTap,
  pressedScale = 0.96,
  scale,
}: TapScaleGestureOptions) =>
  Gesture.Tap()
    .enabled(enabled)
    .onBegin(() => {
      cancelAnimation(scale);
      scale.value = withSpring(pressedScale, springPresets.responsive);
    })
    .onFinalize((_event, success) => {
      cancelAnimation(scale);
      scale.value = withSpring(1, springPresets.responsive);

      if (success && onTap !== undefined) {
        scheduleOnRN(onTap);
      }
    });

type HorizontalSwipeGestureOptions = {
  dismissDistance?: number;
  enabled?: boolean;
  onDismiss?: () => void;
  translateX: SharedValue<number>;
};

export const createHorizontalSwipeGesture = ({
  dismissDistance = 96,
  enabled = true,
  onDismiss,
  translateX,
}: HorizontalSwipeGestureOptions) =>
  Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) >= dismissDistance) {
        translateX.value = withTiming(
          Math.sign(event.translationX) * dismissDistance * 1.8,
          {
            duration: motionRuntime.duration.control,
            easing: motionRuntime.easing.responsive,
          },
        );

        if (onDismiss !== undefined) {
          scheduleOnRN(onDismiss);
        }

        return;
      }

      translateX.value = withSpring(0, springPresets.responsive);
    })
    .onFinalize(() => {
      if (Math.abs(translateX.value) < dismissDistance) {
        translateX.value = withSpring(0, springPresets.responsive);
      }
    });
